/**
 * Data Transformer: Converts any input format to canonical 张莉.xlsx structure
 * 
 * This module handles the transformation of uploaded data to the canonical format,
 * ensuring all saved files conform to the established schema.
 * 
 * @version 1.0.0
 */

import * as XLSX from 'xlsx';
import {
  COLUMN_KEYS,
  FIXED_COLUMNS,
  ROW_INDICES,
  SCHEMA_VERSION,
  validateDatasetStructure,
  detectDataFormat
} from './oncology-dataset.schema';
import {
  METRIC_DICTIONARY,
  lookupMetric,
  getCanonicalMetricName,
  isKnownMetric,
  MetricDefinition
} from './metric-dictionary';

// =============================================================================
// TYPES
// =============================================================================

export interface TransformResult {
  success: boolean;
  data: any[][];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    dataRows: number;
    metricsFound: number;
    eventsFound: number;
  };
}

export interface MappingConfig {
  date_col: string | null;
  date_col_index?: number;  // Explicit column index for dates (preferred over name lookup)
  metrics: Record<string, string>;
  events: string[];
}

// =============================================================================
// CANONICAL TEMPLATE
// =============================================================================

/**
 * Generates the canonical header structure (Rows 0-3)
 */
export function generateCanonicalHeaders(metrics: string[]): any[][] {
  // Row 0: Title
  const titleRow = new Array(FIXED_COLUMNS.SCHEME_DETAIL + 1 + metrics.length).fill('');
  titleRow[0] = '肿瘤病程周期表';

  // Row 1: Category headers
  const categoryRow = new Array(titleRow.length).fill('');
  categoryRow[FIXED_COLUMNS.DATE] = '分类';
  categoryRow[FIXED_COLUMNS.PHASE] = '节拍';
  categoryRow[FIXED_COLUMNS.EVENT] = '事件';

  // Add category headers for metrics based on their category
  let currentIdx = FIXED_COLUMNS.SCHEME_DETAIL + 1;
  let lastCategory = '';
  let hasCustomCategory = false;

  metrics.forEach(metricName => {
    const def = lookupMetric(metricName);
    const category = def?.category || 'CUSTOM';

    if (category !== lastCategory) {
      const categoryLabel = {
        'PERFORMANCE': '体能负荷',
        'MOLECULAR': '分子负荷',
        'IMAGING': '影像负荷',
        'SIDE_EFFECTS': '副作用',
        'EVENTS': '事件',
        'RHYTHM': '节拍',
        'CLASSIFICATION': '其他指标',
        'CUSTOM': '其他指标',  // Custom metrics get "Other Metrics" category
      }[category] || '其他指标';

      categoryRow[currentIdx] = categoryLabel;
      lastCategory = category;

      if (category === 'CUSTOM') hasCustomCategory = true;
    }
    currentIdx++;
  });

  if (hasCustomCategory) {
    console.log('[Transform] Custom/unknown metrics detected - added "其他指标" category');
  }

  // Row 2: Column headers
  const headerRow = new Array(titleRow.length).fill('');
  headerRow[FIXED_COLUMNS.DATE] = '子类';
  headerRow[FIXED_COLUMNS.PHASE] = '项目';
  headerRow[FIXED_COLUMNS.CYCLE] = '周期';
  // Column D (PREV_CYCLE) is empty in header row
  headerRow[FIXED_COLUMNS.SCHEME] = '方案';
  headerRow[FIXED_COLUMNS.EVENT] = '处置';
  headerRow[FIXED_COLUMNS.SCHEME_DETAIL] = '方案';

  // Add metric headers
  metrics.forEach((metricName, idx) => {
    headerRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = metricName;
  });

  // Row 3: Unit row
  const unitRow = new Array(titleRow.length).fill('');
  unitRow[FIXED_COLUMNS.DATE] = '日期\\单位';
  unitRow[FIXED_COLUMNS.CYCLE] = '当下周期';
  unitRow[FIXED_COLUMNS.PREV_CYCLE] = '前序周期';

  // Add metric units
  metrics.forEach((metricName, idx) => {
    const def = lookupMetric(metricName);
    if (def) {
      unitRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = def.threshold || def.unit;
    }
  });

  return [titleRow, categoryRow, headerRow, unitRow];
}

/**
 * Transforms raw data to canonical format
 */
export function transformToCanonicalFormat(
  rawData: any[][],
  mapping: MappingConfig,
  options: { patientName?: string } = {}
): TransformResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = { totalRows: 0, dataRows: 0, metricsFound: 0, eventsFound: 0 };

  try {
    // 1. Detect header row in raw data
    let headerRowIndex = findHeaderRow(rawData);
    if (headerRowIndex === -1) {
      errors.push('Could not detect header row in input data');
      return { success: false, data: [], errors, warnings, stats };
    }

    const rawHeaders = rawData[headerRowIndex] as string[];

    // 2. Build column index map
    const colMap: Record<string, number> = {};
    rawHeaders.forEach((h, i) => {
      if (h) colMap[String(h).trim()] = i;
    });

    // 3. Determine which metrics are present
    const foundMetrics: string[] = [];
    const metricColMap: Record<string, number> = {};

    Object.entries(mapping.metrics || {}).forEach(([originalCol, canonicalName]) => {
      if (colMap[originalCol] !== undefined) {
        const canonical = getCanonicalMetricName(canonicalName);
        foundMetrics.push(canonical);
        metricColMap[canonical] = colMap[originalCol];
        stats.metricsFound++;
      }
    });

    // Sort metrics by canonical column order
    // Standard metrics (0-28) come first, dynamic/custom metrics (-1 or undefined) come last
    foundMetrics.sort((a, b) => {
      const defA = lookupMetric(a);
      const defB = lookupMetric(b);

      const colA = (defA?.canonicalColumn !== undefined && defA.canonicalColumn !== -1) ? defA.canonicalColumn : 999;
      const colB = (defB?.canonicalColumn !== undefined && defB.canonicalColumn !== -1) ? defB.canonicalColumn : 999;

      // If both are dynamic/custom, sort alphabetically
      if (colA === 999 && colB === 999) {
        return a.localeCompare(b);
      }

      return colA - colB;
    });

    // 4. Generate canonical header rows
    const headerRows = generateCanonicalHeaders(foundMetrics);

    // Update title with patient name if provided
    if (options.patientName) {
      headerRows[0][0] = `${options.patientName} - 肿瘤病程周期表`;
    }

    // 5. Transform data rows
    const dataRows: any[][] = [];
    const dateColIdx = findDateColumn(rawHeaders, colMap, mapping.date_col, mapping.date_col_index);

    console.log(`[Transform] Date column resolved to index: ${dateColIdx}`);

    if (dateColIdx === undefined) {
      errors.push('Could not identify date column');
      return { success: false, data: [], errors, warnings, stats };
    }

    // Find fixed column indices in raw data
    const phaseColIdx = findColumn(colMap, ['项目', 'Phase', '阶段']);
    const cycleColIdx = findColumn(colMap, ['周期', 'Cycle', '当下周期']);
    const prevCycleColIdx = findColumn(colMap, ['前序周期', 'Previous Cycle']);
    const eventColIdx = findColumn(colMap, ['处置', 'Event', '事件']);

    // IMPORTANT: In 张莉.xlsx canonical format, there are TWO columns named '方案':
    // - Col 4 (index 4): Main scheme (方案)
    // - Col 6 (index 6): Scheme detail (方案) - AFTER '处置'
    // We need to find BOTH, not just the first one.
    const schemeColIdx = findColumn(colMap, ['方案', 'Scheme']);

    // For scheme detail, look for the SECOND occurrence of '方案' in raw headers
    // In canonical format, it's at col 6 (after '处置' at col 5)
    const schemeDetailColIdx = findSecondOccurrence(rawHeaders, '方案', schemeColIdx);

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !Array.isArray(row)) continue;

      stats.totalRows++;

      // Parse date
      const rawDate = row[dateColIdx];
      const dateValue = parseDate(rawDate);

      if (!dateValue) {
        // Skip rows without valid dates (might be empty rows)
        continue;
      }

      stats.dataRows++;

      // Build canonical row
      const canonicalRow = new Array(FIXED_COLUMNS.SCHEME_DETAIL + 1 + foundMetrics.length).fill('');

      // Fixed columns
      canonicalRow[FIXED_COLUMNS.DATE] = dateValue;
      canonicalRow[FIXED_COLUMNS.PHASE] = phaseColIdx !== undefined ? (row[phaseColIdx] || '') : '';
      canonicalRow[FIXED_COLUMNS.CYCLE] = cycleColIdx !== undefined ? (row[cycleColIdx] || '') : '';
      canonicalRow[FIXED_COLUMNS.PREV_CYCLE] = prevCycleColIdx !== undefined ? (row[prevCycleColIdx] || '') : '';
      canonicalRow[FIXED_COLUMNS.SCHEME] = schemeColIdx !== undefined ? (row[schemeColIdx] || '') : '';
      canonicalRow[FIXED_COLUMNS.EVENT] = eventColIdx !== undefined ? (row[eventColIdx] || '') : '';
      canonicalRow[FIXED_COLUMNS.SCHEME_DETAIL] = schemeDetailColIdx !== undefined ? (row[schemeDetailColIdx] || '') : '';

      // Track events
      if (canonicalRow[FIXED_COLUMNS.EVENT]) stats.eventsFound++;

      // Metric columns
      foundMetrics.forEach((metricName, idx) => {
        const sourceColIdx = metricColMap[metricName];
        if (sourceColIdx !== undefined) {
          const value = row[sourceColIdx];
          canonicalRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = value !== undefined ? value : '';
        }
      });

      dataRows.push(canonicalRow);
    }

    if (dataRows.length === 0) {
      errors.push('No valid data rows found');
      return { success: false, data: [], errors, warnings, stats };
    }

    // Combine headers and data
    const canonicalData = [...headerRows, ...dataRows];

    return {
      success: true,
      data: canonicalData,
      errors,
      warnings,
      stats,
    };

  } catch (error: any) {
    errors.push(`Transform error: ${error.message}`);
    return { success: false, data: [], errors, warnings, stats };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Finds the header row in raw data
 * 
 * IMPORTANT: The original dataset structure is:
 * - Row 3: HEADERS ("子类", "项目", "Weight", "CEA", "MRD"...)  <-- WE WANT THIS
 * - Row 4: UNITS ("日期\单位", "KG", "<5"...)  <-- NOT THIS
 * 
 * We look for METRIC HEADERS to identify the correct row.
 */
function findHeaderRow(rawData: any[][]): number {
  // METRIC_HEADERS are definitive indicators of the header row
  // These are actual column names, not units like "<5", "KG", "mm"
  const metricHeaders = [
    'Weight', 'Handgrip', 'ECOG', 'MRD', 'aMRD', 'CEA', 'HE4',
    'CA19-9', 'CA125', 'CA724', 'AFP', 'ROMA',
    '白细胞', '血小板', '中性粒细胞', '谷草转氨酶', '谷丙转氨酶',
    '肺', '肝脏', '淋巴', '盆腔'
  ];

  // Fixed column headers (more reliable than "日期" which appears in units row too)
  const fixedHeaders = ['子类', '项目', '周期', '方案', '处置'];

  // Unit patterns to AVOID - these indicate it's the UNITS row, not the HEADER row
  const unitPatterns = ['日期\\单位', 'KG', 'mtm/ml', '<5', '<35', '<76', 'mm', '当下周期', '前序周期'];

  for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    const row = rawData[i];
    if (!Array.isArray(row) || row.length < 5) continue;

    const rowStr = row.map(c => String(c || '')).join(' ');

    // Check if row has metric headers (Weight, CEA, etc.)
    const hasMetricHeaders = metricHeaders.some(m => rowStr.includes(m));

    // Check if row has fixed headers (子类, 项目, etc.)
    const hasFixedHeaders = fixedHeaders.filter(f => rowStr.includes(f)).length >= 2;

    // Check if row looks like a UNITS row (has <5, KG, mm, 日期\单位)
    const looksLikeUnits = unitPatterns.filter(u => rowStr.includes(u)).length >= 2;

    // Accept if it has metric headers OR multiple fixed headers AND doesn't look like units
    if ((hasMetricHeaders || hasFixedHeaders) && !looksLikeUnits) {
      console.log('[findHeaderRow] Found header row at index:', i);
      return i;
    }
  }

  // Fallback: if no clear header found, try the old method as last resort
  const fallbackKeywords = ['Phase', 'Cycle', 'Scheme', 'Event'];
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) continue;
    const rowStr = JSON.stringify(row).toLowerCase();
    if (fallbackKeywords.filter(k => rowStr.includes(k.toLowerCase())).length >= 2) {
      console.log('[findHeaderRow] Fallback: found header row at index:', i);
      return i;
    }
  }

  return -1;
}

/**
 * Finds the date column index
 * 
 * Priority:
 * 1. Use explicit date_col_index if provided (most reliable)
 * 2. If hint is "column_0" or similar, use column 0
 * 3. If hint matches a known column (and is not a non-date column), use it
 * 4. Try common date keywords
 * 5. Fallback to column 0 (dates are typically in first column)
 */
function findDateColumn(
  headers: string[],
  colMap: Record<string, number>,
  hintCol: string | null,
  explicitIndex?: number
): number | undefined {
  // Priority 1: Use explicit index if provided
  if (explicitIndex !== undefined && explicitIndex >= 0) {
    console.log(`[findDateColumn] Using explicit index: ${explicitIndex}`);
    return explicitIndex;
  }

  // Priority 2: Special case "column_0" or similar indicates first column
  if (hintCol === 'column_0' || hintCol === 'Unnamed: 0' || hintCol === '') {
    console.log('[findDateColumn] Using column 0 (column_0 hint)');
    return 0;
  }

  // Priority 3: Try hint if it exists and is not a non-date column
  // IMPORTANT: Don't use Phase/Event columns as date columns!
  const nonDateColumns = ['项目', 'Phase', '处置', 'Event', '周期', 'Cycle', '方案', 'Scheme'];
  if (hintCol && colMap[hintCol] !== undefined && !nonDateColumns.includes(hintCol)) {
    console.log(`[findDateColumn] Using hint column: ${hintCol}`);
    return colMap[hintCol];
  }

  // Priority 4: Try common date column names
  const dateKeywords = ['日期', 'date', 'time', '时间', '子类'];
  for (const keyword of dateKeywords) {
    const match = Object.keys(colMap).find(k => k.toLowerCase().includes(keyword.toLowerCase()));
    if (match) {
      console.log(`[findDateColumn] Found by keyword "${keyword}": ${match}`);
      return colMap[match];
    }
  }

  // Priority 5: Fallback to first column (dates are typically in column 0)
  console.log('[findDateColumn] Fallback to column 0');
  return 0;
}

/**
 * Finds a column by possible names
 */
function findColumn(colMap: Record<string, number>, possibleNames: string[]): number | undefined {
  for (const name of possibleNames) {
    if (colMap[name] !== undefined) return colMap[name];
    // Try case-insensitive
    const match = Object.keys(colMap).find(k => k.toLowerCase() === name.toLowerCase());
    if (match) return colMap[match];
  }
  return undefined;
}

/**
 * Finds the SECOND occurrence of a column name in raw headers
 * Used for handling duplicate column names like '方案' in 张莉.xlsx format
 * where Col 4 = '方案' (scheme) and Col 6 = '方案' (scheme detail)
 */
function findSecondOccurrence(headers: string[], targetName: string, firstOccurrenceIdx: number | undefined): number | undefined {
  if (!Array.isArray(headers) || firstOccurrenceIdx === undefined) return undefined;

  // Look for another occurrence AFTER the first one
  for (let i = firstOccurrenceIdx + 1; i < headers.length; i++) {
    const h = headers[i];
    if (h && typeof h === 'string' && h.trim() === targetName) {
      return i;
    }
  }

  return undefined;
}

/**
 * Parses a date value (Excel serial or string)
 */
function parseDate(value: any): number | string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    // Excel serial date - keep as is for XLSX output
    return value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Convert to Excel serial for consistency
      return dateToExcelSerial(date);
    }
  }

  if (value instanceof Date) {
    return dateToExcelSerial(value);
  }

  return null;
}

/**
 * Converts a JavaScript Date to Excel serial number
 */
function dateToExcelSerial(date: Date): number {
  // Excel serial date: days since 1899-12-30
  const excelEpoch = new Date(1899, 11, 30);
  const days = Math.floor((date.getTime() - excelEpoch.getTime()) / (24 * 60 * 60 * 1000));
  return days;
}

/**
 * Validates that data conforms to canonical schema
 */
export function validateCanonicalData(data: any[][]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check minimum structure
  if (data.length < ROW_INDICES.DATA_START + 1) {
    errors.push(`Insufficient rows: need at least ${ROW_INDICES.DATA_START + 1}, got ${data.length}`);
  }

  // Check header row
  const headerRow = data[ROW_INDICES.HEADERS];
  if (headerRow) {
    const hasDateHeader = headerRow[FIXED_COLUMNS.DATE] === '子类' || headerRow[FIXED_COLUMNS.DATE] === 'Date';
    const hasPhaseHeader = headerRow[FIXED_COLUMNS.PHASE] === '项目' || headerRow[FIXED_COLUMNS.PHASE] === 'Phase';

    if (!hasDateHeader) warnings.push('Missing or incorrect date header (expected "子类")');
    if (!hasPhaseHeader) warnings.push('Missing or incorrect phase header (expected "项目")');
  }

  // Check for valid data rows
  let validDataRows = 0;
  for (let i = ROW_INDICES.DATA_START; i < data.length; i++) {
    const row = data[i];
    if (row && row[FIXED_COLUMNS.DATE]) validDataRows++;
  }

  if (validDataRows === 0) {
    errors.push('No valid data rows (rows with dates)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Writes canonical data to XLSX buffer
 */
export function writeCanonicalXLSX(data: any[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

