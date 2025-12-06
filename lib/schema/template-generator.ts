/**
 * Template Generator: Creates blank canonical XLSX templates
 * 
 * Use this to generate empty templates for manual data entry that
 * conform to the 张莉.xlsx canonical structure.
 * 
 * @version 1.0.0
 */

import * as XLSX from 'xlsx';
import {
  FIXED_COLUMNS,
  ROW_INDICES,
  SCHEMA_VERSION,
  METRIC_CATEGORIES
} from './oncology-dataset.schema';
import {
  METRIC_DICTIONARY,
  getMetricsByCategory,
  MetricDefinition
} from './metric-dictionary';

// =============================================================================
// TEMPLATE GENERATION
// =============================================================================

export interface TemplateOptions {
  /** Patient name to include in title (optional) */
  patientName?: string;
  /** Include all canonical metrics (default: true) */
  includeAllMetrics?: boolean;
  /** Specific metrics to include (if not includeAllMetrics) */
  metrics?: string[];
  /** Number of empty data rows to include (default: 20) */
  emptyRows?: number;
}

/**
 * Generates a blank canonical template
 */
export function generateCanonicalTemplate(options: TemplateOptions = {}): Buffer {
  const {
    patientName,
    includeAllMetrics = true,
    metrics = [],
    emptyRows = 20,
  } = options;

  // Determine which metrics to include
  let selectedMetrics: MetricDefinition[];

  if (includeAllMetrics) {
    // Include all metrics from dictionary, sorted by column order
    selectedMetrics = Object.values(METRIC_DICTIONARY)
      .sort((a, b) => a.canonicalColumn - b.canonicalColumn);
  } else {
    // Include only specified metrics
    selectedMetrics = metrics
      .map(name => METRIC_DICTIONARY[name])
      .filter(Boolean) as MetricDefinition[];
  }

  const metricNames = selectedMetrics.map(m => m.canonical);
  const totalColumns = FIXED_COLUMNS.SCHEME_DETAIL + 1 + metricNames.length;

  // Build template data
  const data: any[][] = [];

  // Row 0: Title
  const titleRow = new Array(totalColumns).fill('');
  titleRow[0] = patientName
    ? `${patientName} - 肿瘤病程周期表`
    : '肿瘤病程周期表';
  data.push(titleRow);

  // Row 1: Category headers
  const categoryRow = new Array(totalColumns).fill('');
  categoryRow[FIXED_COLUMNS.DATE] = '分类';
  categoryRow[FIXED_COLUMNS.PHASE] = '节拍';
  categoryRow[FIXED_COLUMNS.EVENT] = '事件';

  // Add category headers for metrics
  let currentCategory = '';
  selectedMetrics.forEach((metric, idx) => {
    if (metric.category !== currentCategory) {
      const categoryLabel = {
        'PERFORMANCE': '体能负荷',
        'MOLECULAR': '分子负荷',
        'IMAGING': '影像负荷',
        'SIDE_EFFECTS': '副作用',
        'EVENTS': '事件',
        'RHYTHM': '节拍',
        'CLASSIFICATION': '其他指标',
      }[metric.category] || '';
      categoryRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = categoryLabel;
      currentCategory = metric.category;
    }
  });
  data.push(categoryRow);

  // Row 2: Column headers
  const headerRow = new Array(totalColumns).fill('');
  headerRow[FIXED_COLUMNS.DATE] = '子类';
  headerRow[FIXED_COLUMNS.PHASE] = '项目';
  headerRow[FIXED_COLUMNS.CYCLE] = '周期';
  headerRow[FIXED_COLUMNS.PREV_CYCLE] = '';  // Empty
  headerRow[FIXED_COLUMNS.SCHEME] = '方案';
  headerRow[FIXED_COLUMNS.EVENT] = '处置';
  headerRow[FIXED_COLUMNS.SCHEME_DETAIL] = '方案';

  selectedMetrics.forEach((metric, idx) => {
    headerRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = metric.canonical;
  });
  data.push(headerRow);

  // Row 3: Units
  const unitRow = new Array(totalColumns).fill('');
  unitRow[FIXED_COLUMNS.DATE] = '日期\\单位';
  unitRow[FIXED_COLUMNS.CYCLE] = '当下周期';
  unitRow[FIXED_COLUMNS.PREV_CYCLE] = '前序周期';

  selectedMetrics.forEach((metric, idx) => {
    unitRow[FIXED_COLUMNS.SCHEME_DETAIL + 1 + idx] = metric.threshold || metric.unit;
  });
  data.push(unitRow);

  // Empty data rows
  for (let i = 0; i < emptyRows; i++) {
    data.push(new Array(totalColumns).fill(''));
  }

  // Create workbook
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 },  // Date
    { wch: 10 },  // Phase
    { wch: 8 },   // Cycle
    { wch: 8 },   // Prev Cycle
    { wch: 30 },  // Scheme
    { wch: 15 },  // Event
    { wch: 20 },  // Scheme Detail
    ...selectedMetrics.map(() => ({ wch: 10 })),  // Metrics
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Generates a minimal template with only the most common metrics
 */
export function generateMinimalTemplate(patientName?: string): Buffer {
  const commonMetrics = [
    'Weight',
    'ECOG',
    'MRD',
    'CEA',
    'CA125',
    'AFP',
  ];

  return generateCanonicalTemplate({
    patientName,
    includeAllMetrics: false,
    metrics: commonMetrics,
    emptyRows: 30,
  });
}

/**
 * Generates a template with only molecular markers
 */
export function generateMolecularTemplate(patientName?: string): Buffer {
  const molecularMetrics = getMetricsByCategory('MOLECULAR').map(m => m.canonical);

  return generateCanonicalTemplate({
    patientName,
    includeAllMetrics: false,
    metrics: molecularMetrics,
    emptyRows: 30,
  });
}

/**
 * Lists all available metrics for template customization
 */
export function listAvailableMetrics(): Array<{
  name: string;
  chinese: string;
  category: string;
  unit: string;
}> {
  return Object.values(METRIC_DICTIONARY).map(m => ({
    name: m.canonical,
    chinese: m.chinese,
    category: METRIC_CATEGORIES[m.category as keyof typeof METRIC_CATEGORIES] || m.category,
    unit: m.unit,
  }));
}

/**
 * Creates a reference sheet explaining the template structure
 */
export function generateReferenceSheet(): string {
  const lines: string[] = [
    '# OncoTracker 数据模板说明',
    '',
    `## 模板版本: ${SCHEMA_VERSION}`,
    '',
    '## 基于标准: 张莉.xlsx 规范格式',
    '',
    '---',
    '',
    '## 固定列 (A-G)',
    '',
    '| 列 | 代码 | 中文名 | 说明 |',
    '|---|------|--------|------|',
    '| A | 子类 | 日期 | 数据记录日期 (Excel日期格式或ISO字符串) |',
    '| B | 项目 | 阶段 | 治疗阶段 (如: 新辅助, 辅助, 腹腔镜) |',
    '| C | 周期 | 当下周期 | 当前治疗周期 (如: C1D1, C2D14, AS0) |',
    '| D | - | 前序周期 | 上一个周期 (可选) |',
    '| E | 方案 | 方案 | 治疗方案 (如: nab-PTX 0.8 & OXA 0.7) |',
    '| F | 处置 | 事件 | 治疗事件 (如: Dx lap, HEPIC x3) |',
    '| G | 方案 | 方案详情 | 详细方案说明 |',
    '',
    '---',
    '',
    '## 指标列 (H 起)',
    '',
    '### 体能负荷 (Performance)',
  ];

  // Add performance metrics
  getMetricsByCategory('PERFORMANCE').forEach(m => {
    lines.push(`- **${m.canonical}** (${m.chinese}) - 单位: ${m.unit}`);
  });

  lines.push('');
  lines.push('### 分子负荷 (Molecular)');

  getMetricsByCategory('MOLECULAR').forEach(m => {
    const threshold = m.threshold ? ` - 正常值: ${m.threshold}` : '';
    lines.push(`- **${m.canonical}** (${m.chinese}) - 单位: ${m.unit}${threshold}`);
  });

  lines.push('');
  lines.push('### 影像负荷 (Imaging)');

  getMetricsByCategory('IMAGING').forEach(m => {
    lines.push(`- **${m.canonical}** (${m.chinese}) - 单位: ${m.unit}`);
  });

  lines.push('');
  lines.push('### 副作用 (Side Effects)');

  getMetricsByCategory('SIDE_EFFECTS').forEach(m => {
    lines.push(`- **${m.canonical}** (${m.chinese}) - 单位: ${m.unit}`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 行结构');
  lines.push('');
  lines.push('- **第0行**: 标题行 (肿瘤病程周期表)');
  lines.push('- **第1行**: 分类行 (分类, 节拍, 事件, 体能负荷, 分子负荷, ...)');
  lines.push('- **第2行**: 列名行 (子类, 项目, 周期, ...)');
  lines.push('- **第3行**: 单位行 (日期\\单位, 当下周期, 前序周期, KG, ...)');
  lines.push('- **第4行起**: 数据行');

  return lines.join('\n');
}

