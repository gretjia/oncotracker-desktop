/**
 * Migration Script: Convert non-canonical files to 张莉.xlsx format
 * 
 * Usage:
 *   npx ts-node --esm scripts/migrate-to-canonical.ts [filename]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// =============================================================================
// INLINE CONSTANTS (to avoid module resolution issues)
// =============================================================================

const SCHEMA_VERSION = '1.0.0';

const FIXED_COLUMNS = {
  DATE: 0,
  PHASE: 1,
  CYCLE: 2,
  PREV_CYCLE: 3,
  SCHEME: 4,
  EVENT: 5,
  SCHEME_DETAIL: 6,
} as const;

const ROW_INDICES = {
  TITLE: 0,
  CATEGORIES: 1,
  HEADERS: 2,
  UNITS: 3,
  DATA_START: 4,
} as const;

// Simplified metric dictionary for migration
const METRIC_MAP: Record<string, { canonical: string; unit: string; threshold?: string }> = {
  'Weight': { canonical: 'Weight', unit: 'KG' },
  'Tumor Burden': { canonical: 'MRD', unit: 'mtm/ml' },
  'Lab Result': { canonical: 'CEA', unit: 'ng/ml', threshold: '<5' },
  'Tumor Size': { canonical: '肺', unit: 'mm' },
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(process.cwd(), 'data', '_backup');

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

interface MigrationResult {
  file: string;
  success: boolean;
  originalFormat: string;
  message: string;
}

function detectFormat(headerRow: Record<string, any>): 'canonical' | 'standardized' | 'unknown' {
  if (!headerRow) return 'unknown';
  
  // Canonical format markers
  const hasCanonicalPhase = Object.values(headerRow).includes('项目');
  const hasCanonicalCycle = Object.values(headerRow).includes('周期');
  
  // Standardized format markers  
  const hasStdScheme = Object.values(headerRow).includes('Scheme');
  const hasStdEvent = Object.values(headerRow).includes('Event');
  
  if (hasCanonicalPhase && hasCanonicalCycle) return 'canonical';
  if (hasStdScheme && hasStdEvent) return 'standardized';
  
  return 'unknown';
}

function migrateFile(filePath: string): MigrationResult {
  const fileName = path.basename(filePath);
  
  try {
    // Read the file
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '' }) as any[];

    // Detect format from row 2
    const headerRow = data[2];
    const format = detectFormat(headerRow);

    if (format === 'canonical') {
      return {
        file: fileName,
        success: true,
        originalFormat: 'canonical',
        message: 'Already in canonical format - skipped',
      };
    }

    if (format === 'unknown') {
      return {
        file: fileName,
        success: false,
        originalFormat: 'unknown',
        message: 'Unknown format - manual review needed',
      };
    }

    // Migrate from standardized to canonical
    console.log(`  Migrating ${fileName}...`);

    const patientName = path.parse(fileName).name;
    const srcHeaders = data[2];
    const srcUnits = data[3];

    // Count metrics in source
    const metricCols: { col: string; name: string }[] = [];
    Object.entries(srcHeaders).forEach(([col, name]) => {
      if (name && !['Date', 'Phase', 'Cycle', 'Scheme', 'Event'].includes(name as string)) {
        metricCols.push({ col, name: name as string });
      }
    });

    // Build canonical output
    const totalCols = FIXED_COLUMNS.SCHEME_DETAIL + 1 + metricCols.length;
    const output: any[][] = [];

    // Row 0: Title
    const titleRow = new Array(totalCols).fill('');
    titleRow[0] = `${patientName} - 肿瘤病程周期表`;
    output.push(titleRow);

    // Row 1: Categories
    const catRow = new Array(totalCols).fill('');
    catRow[0] = '分类';
    catRow[1] = '节拍';
    catRow[5] = '事件';
    if (metricCols.length > 0) catRow[7] = '指标';
    output.push(catRow);

    // Row 2: Headers
    const hdrRow = new Array(totalCols).fill('');
    hdrRow[FIXED_COLUMNS.DATE] = '子类';
    hdrRow[FIXED_COLUMNS.PHASE] = '项目';
    hdrRow[FIXED_COLUMNS.CYCLE] = '周期';
    hdrRow[FIXED_COLUMNS.PREV_CYCLE] = '';
    hdrRow[FIXED_COLUMNS.SCHEME] = '方案';
    hdrRow[FIXED_COLUMNS.EVENT] = '处置';
    hdrRow[FIXED_COLUMNS.SCHEME_DETAIL] = '方案';
    metricCols.forEach((m, i) => {
      hdrRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + i] = m.name;
    });
    output.push(hdrRow);

    // Row 3: Units
    const unitRow = new Array(totalCols).fill('');
    unitRow[FIXED_COLUMNS.DATE] = '日期\\单位';
    unitRow[FIXED_COLUMNS.CYCLE] = '当下周期';
    unitRow[FIXED_COLUMNS.PREV_CYCLE] = '前序周期';
    metricCols.forEach((m, i) => {
      const def = METRIC_MAP[m.name];
      unitRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + i] = def?.threshold || def?.unit || '';
    });
    output.push(unitRow);

    // Data rows
    for (let i = 4; i < data.length; i++) {
      const src = data[i];
      const dst = new Array(totalCols).fill('');

      // Standardized format: A=Date, B=Phase, C=Cycle, D=Scheme, E=Event
      dst[FIXED_COLUMNS.DATE] = src['A'] || '';
      dst[FIXED_COLUMNS.PHASE] = src['B'] || '';
      dst[FIXED_COLUMNS.CYCLE] = src['C'] || '';
      dst[FIXED_COLUMNS.PREV_CYCLE] = '';
      dst[FIXED_COLUMNS.SCHEME] = src['D'] || '';
      dst[FIXED_COLUMNS.EVENT] = src['E'] || '';
      dst[FIXED_COLUMNS.SCHEME_DETAIL] = '';

      // Map metrics
      metricCols.forEach((m, idx) => {
        dst[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = src[m.col] || '';
      });

      output.push(dst);
    }

    // Backup original
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.copyFileSync(filePath, path.join(BACKUP_DIR, `${fileName}.bak`));

    // Write canonical
    const ws = XLSX.utils.aoa_to_sheet(output);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    fs.writeFileSync(filePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    return {
      file: fileName,
      success: true,
      originalFormat: 'standardized',
      message: `Migrated ${data.length - 4} rows, ${metricCols.length} metrics`,
    };

  } catch (error: any) {
    return {
      file: fileName,
      success: false,
      originalFormat: 'error',
      message: error.message,
    };
  }
}

// =============================================================================
// MAIN
// =============================================================================

console.log('='.repeat(50));
console.log(`OncoTracker Migration (Schema v${SCHEMA_VERSION})`);
console.log('='.repeat(50));

const files = fs.readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

console.log(`\nFound ${files.length} files in ${DATA_DIR}\n`);

let success = 0, failed = 0;

for (const file of files) {
  const result = migrateFile(path.join(DATA_DIR, file));
  const icon = result.success ? '✓' : '✗';
  console.log(`${icon} ${result.file}: ${result.message}`);
  result.success ? success++ : failed++;
}

console.log(`\nDone: ${success} succeeded, ${failed} failed`);
