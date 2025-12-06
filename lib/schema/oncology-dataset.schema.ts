/**
 * OncoTracker Canonical Dataset Schema
 * 
 * This file defines the SINGLE SOURCE OF TRUTH for all patient data structures.
 * Based on: 张莉.xlsx (the canonical reference file)
 * 
 * All data uploads—manual or AI-processed—MUST conform to this schema.
 * 
 * @version 1.0.0
 * @lastUpdated 2025-12-03
 */

import { z } from 'zod';

// =============================================================================
// SCHEMA VERSION
// =============================================================================

export const SCHEMA_VERSION = '1.0.0';

// =============================================================================
// FIXED COLUMN INDICES (Columns A-G)
// =============================================================================

/**
 * Fixed column positions that MUST exist in all datasets.
 * These columns define the temporal and contextual structure of the patient journey.
 */
export const FIXED_COLUMNS = {
  DATE: 0,           // Column A: Date (Excel serial or ISO string)
  PHASE: 1,          // Column B: Phase/项目 (e.g., "新辅助", "辅助", "腹腔镜")
  CYCLE: 2,          // Column C: Current Cycle/周期 (e.g., "C1D1", "AS0")
  PREV_CYCLE: 3,     // Column D: Previous Cycle/前序周期 (optional reference)
  SCHEME: 4,         // Column E: Treatment Scheme/方案 (e.g., "nab-PTX 0.8 & OXA 0.7")
  EVENT: 5,          // Column F: Event/处置 (e.g., "Dx lap", "HEPIC x3")
  SCHEME_DETAIL: 6,  // Column G: Scheme Detail/方案详情 (additional notes)
} as const;

/**
 * Column key mappings for data-loader.ts compatibility
 */
export const COLUMN_KEYS = {
  DATE: 'Unnamed: 0',
  PHASE: 'Unnamed: 1',
  CYCLE: 'Unnamed: 2',
  PREV_CYCLE: 'Unnamed: 3',
  SCHEME: 'Unnamed: 4',
  EVENT: 'Unnamed: 5',
  SCHEME_DETAIL: 'Unnamed: 6',
} as const;

/**
 * First metric column index (Column H = index 7)
 */
export const FIRST_METRIC_COLUMN = 7;

// =============================================================================
// ROW STRUCTURE
// =============================================================================

/**
 * Row indices in the canonical Excel format
 */
export const ROW_INDICES = {
  TITLE: 0,          // Row 0: Title row (e.g., "肿瘤病程周期表")
  CATEGORIES: 1,     // Row 1: Category headers (分类, 节拍, 事件, 体能负荷, etc.)
  HEADERS: 2,        // Row 2: Column headers/Metric names
  UNITS: 3,          // Row 3: Units and thresholds
  DATA_START: 4,     // Row 4+: Data rows
} as const;

// =============================================================================
// METRIC CATEGORIES
// =============================================================================

/**
 * Metric categories as defined in 张莉.xlsx Row 1
 */
export const METRIC_CATEGORIES = {
  CLASSIFICATION: '分类',      // Classification/Rhythm
  RHYTHM: '节拍',              // Rhythm/Timeline
  EVENTS: '事件',              // Events/Treatments
  PERFORMANCE: '体能负荷',     // Performance Status (Weight, ECOG, etc.)
  MOLECULAR: '分子负荷',       // Molecular Markers (MRD, CEA, CA125, etc.)
  IMAGING: '影像负荷',         // Imaging Metrics (Lung, Liver, Lymph, etc.)
  SIDE_EFFECTS: '副作用',      // Side Effects (WBC, Platelets, etc.)
} as const;

/**
 * Default metrics to include in empty templates
 */
export const DEFAULT_TEMPLATE_METRICS = [
  'Weight', 'Handgrip', 'ECOG',
  'MRD', 'aMRD', 'CEA', 'HE4', 'CA19-9', 'CA125', 'CA724', 'AFP', 'ROMA',
  '白细胞', '血小板', '中性粒细胞', '谷草转氨酶', '谷丙转氨酶',
  '肺', '肝脏', '淋巴', '盆腔'
];

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Schema for a single data row
 */
export const DataRowSchema = z.object({
  // Fixed columns
  date: z.union([z.date(), z.number(), z.string()]).describe('Date (Excel serial, ISO string, or Date object)'),
  phase: z.string().optional().describe('Treatment phase (e.g., 新辅助, 辅助)'),
  cycle: z.string().regex(/^(C\d+D?\d*|AS\d+)?$/).optional().describe('Current cycle (e.g., C1D1, AS0)'),
  prevCycle: z.string().optional().describe('Previous cycle reference'),
  scheme: z.string().optional().describe('Treatment scheme'),
  event: z.string().optional().describe('Event or procedure'),
  schemeDetail: z.string().optional().describe('Additional scheme details'),

  // Dynamic metrics (key-value pairs)
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional(),
});

/**
 * Schema for the header row (Row 2)
 */
export const HeaderRowSchema = z.object({
  date: z.literal('子类').or(z.literal('Date')),
  phase: z.literal('项目').or(z.literal('Phase')),
  cycle: z.literal('周期').or(z.literal('Cycle')),
  // Other headers are dynamic
}).passthrough();

/**
 * Schema for the complete dataset structure
 */
export const DatasetSchema = z.object({
  version: z.string().default(SCHEMA_VERSION),
  patientName: z.string().optional(),
  titleRow: z.array(z.any()).length(1).optional(),
  categoryRow: z.array(z.any()).optional(),
  headerRow: z.record(z.string(), z.string()),
  unitRow: z.record(z.string(), z.string()),
  dataRows: z.array(DataRowSchema),
  metadata: z.object({
    sourceFile: z.string().optional(),
    createdAt: z.string().datetime().optional(),
    schemaVersion: z.string().default(SCHEMA_VERSION),
  }).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DataRow = z.infer<typeof DataRowSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;
export type FixedColumnKey = keyof typeof FIXED_COLUMNS;
export type MetricCategory = keyof typeof METRIC_CATEGORIES;

// =============================================================================
// CANONICAL HEADER DEFINITIONS
// =============================================================================

/**
 * Canonical header structure for the fixed columns
 * This is what Row 2 should look like for columns A-G
 */
export const CANONICAL_HEADERS = {
  [COLUMN_KEYS.DATE]: '子类',
  [COLUMN_KEYS.PHASE]: '项目',
  [COLUMN_KEYS.CYCLE]: '周期',
  [COLUMN_KEYS.PREV_CYCLE]: '',  // Empty in Row 2, defined in Row 3
  [COLUMN_KEYS.SCHEME]: '方案',
  [COLUMN_KEYS.EVENT]: '处置',
  [COLUMN_KEYS.SCHEME_DETAIL]: '方案',
} as const;

/**
 * Canonical unit row structure for fixed columns
 * This is what Row 3 should look like for columns A-G
 */
export const CANONICAL_UNITS = {
  [COLUMN_KEYS.DATE]: '日期\\单位',
  [COLUMN_KEYS.PHASE]: '',
  [COLUMN_KEYS.CYCLE]: '当下周期',
  [COLUMN_KEYS.PREV_CYCLE]: '前序周期',
  [COLUMN_KEYS.SCHEME]: '',
  [COLUMN_KEYS.EVENT]: '',
  [COLUMN_KEYS.SCHEME_DETAIL]: '',
} as const;

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validates that a dataset conforms to the canonical schema
 * @param data - Raw dataset array from Excel
 * @returns Validation result with errors if any
 */
export function validateDatasetStructure(data: any[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check minimum rows
  if (data.length < ROW_INDICES.DATA_START + 1) {
    errors.push(`Dataset must have at least ${ROW_INDICES.DATA_START + 1} rows (4 header rows + 1 data row). Found: ${data.length}`);
    return { valid: false, errors, warnings };
  }

  // Check title row
  const titleRow = data[ROW_INDICES.TITLE];
  if (!titleRow || !Object.values(titleRow).some(v => v && String(v).includes('病程'))) {
    warnings.push('Title row (Row 0) should contain "病程" or similar identifier');
  }

  // Check header row has required columns
  const headerRow = data[ROW_INDICES.HEADERS];
  if (!headerRow) {
    errors.push('Header row (Row 2) is missing');
  } else {
    const hasPhase = Object.values(headerRow).some(v => v === '项目' || v === 'Phase');
    const hasCycle = Object.values(headerRow).some(v => v === '周期' || v === 'Cycle');

    if (!hasPhase) warnings.push('Header row should contain "项目" or "Phase" column');
    if (!hasCycle) warnings.push('Header row should contain "周期" or "Cycle" column');
  }

  // Check unit row exists
  const unitRow = data[ROW_INDICES.UNITS];
  if (!unitRow) {
    warnings.push('Unit row (Row 3) is missing');
  }

  // Check data rows have dates
  let validDataRows = 0;
  for (let i = ROW_INDICES.DATA_START; i < data.length; i++) {
    const row = data[i];
    const dateValue = row?.[COLUMN_KEYS.DATE] || row?.['A'];
    if (dateValue !== undefined && dateValue !== null && dateValue !== '') {
      validDataRows++;
    }
  }

  if (validDataRows === 0) {
    errors.push('No valid data rows found (rows with dates)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Checks if a dataset is in canonical format vs standardized (AI) format
 * @param headerRow - The header row (Row 2) from the dataset
 * @returns Format type
 */
export function detectDataFormat(headerRow: Record<string, any>): 'canonical' | 'standardized' | 'unknown' {
  if (!headerRow) return 'unknown';

  // Canonical format has "方案" in column E (Unnamed: 4) and "处置" in column F (Unnamed: 5)
  const hasCanonicalScheme = headerRow['Unnamed: 4'] === '方案' || headerRow['E'] === '方案';
  const hasCanonicalEvent = headerRow['Unnamed: 5'] === '处置' || headerRow['F'] === '处置';

  // Standardized format has "Scheme" in column D (Unnamed: 3) and "Event" in column E (Unnamed: 4)
  const hasStandardizedScheme = headerRow['Unnamed: 3'] === 'Scheme' || headerRow['D'] === 'Scheme';
  const hasStandardizedEvent = headerRow['Unnamed: 4'] === 'Event' || headerRow['E'] === 'Event';

  if (hasCanonicalScheme && hasCanonicalEvent) return 'canonical';
  if (hasStandardizedScheme && hasStandardizedEvent) return 'standardized';

  return 'unknown';
}

/**
 * Gets the correct column key for Scheme based on detected format
 */
export function getSchemeColumnKey(format: 'canonical' | 'standardized' | 'unknown'): string {
  return format === 'standardized' ? 'Unnamed: 3' : 'Unnamed: 4';
}

/**
 * Gets the correct column key for Event based on detected format
 */
export function getEventColumnKey(format: 'canonical' | 'standardized' | 'unknown'): string {
  return format === 'standardized' ? 'Unnamed: 4' : 'Unnamed: 5';
}
