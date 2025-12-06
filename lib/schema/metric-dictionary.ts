/**
 * OncoTracker Metric Dictionary
 * 
 * Bilingual (Chinese/English) dictionary for standardizing metric names.
 * Used by AI ingestion to map user-provided column names to canonical names.
 * 
 * Based on: 张莉.xlsx canonical structure
 * 
 * @version 1.0.0
 */

import { METRIC_CATEGORIES } from './oncology-dataset.schema';

// =============================================================================
// METRIC DEFINITION TYPE
// =============================================================================

export interface MetricDefinition {
  /** Canonical English name (used in code and storage) */
  canonical: string;
  /** Chinese name for display */
  chinese: string;
  /** Unit of measurement */
  unit: string;
  /** Normal range threshold (e.g., "<5" means values above 5 are abnormal) */
  threshold?: string;
  /** Category this metric belongs to */
  category: keyof typeof METRIC_CATEGORIES;
  /** Column index in canonical format (starting from 0) */
  canonicalColumn: number;
  /** Common aliases (for AI matching) */
  aliases: string[];
}

// =============================================================================
// CANONICAL METRICS (from 张莉.xlsx)
// =============================================================================

/**
 * Complete dictionary of canonical metrics.
 * Key is the canonical name (case-insensitive matching supported)
 */
export const METRIC_DICTIONARY: Record<string, MetricDefinition> = {
  // =========================================================================
  // 体能负荷 (Performance Status) - Columns H-J
  // =========================================================================
  'Weight': {
    canonical: 'Weight',
    chinese: '体重',
    unit: 'KG',
    category: 'PERFORMANCE',
    canonicalColumn: 7, // Column H
    aliases: ['体重', 'weight', 'wt', 'BW', 'body weight', '重量'],
  },
  'Handgrip': {
    canonical: 'Handgrip',
    chinese: '握力',
    unit: 'KG',
    category: 'PERFORMANCE',
    canonicalColumn: 8, // Column I
    aliases: ['握力', 'handgrip', 'grip strength', 'hand grip', '手握力'],
  },
  'ECOG': {
    canonical: 'ECOG',
    chinese: 'ECOG评分',
    unit: '',
    category: 'PERFORMANCE',
    canonicalColumn: 9, // Column J
    aliases: ['ECOG', 'ecog', 'ECOG评分', 'PS评分', 'performance status', 'ECOG PS'],
  },

  // =========================================================================
  // 分子负荷 (Molecular Markers) - Columns K-T
  // =========================================================================
  'MRD': {
    canonical: 'MRD',
    chinese: 'MRD',
    unit: 'mtm/ml',
    category: 'MOLECULAR',
    canonicalColumn: 10, // Column K
    aliases: ['MRD', 'mrd', '微小残留病灶', 'minimal residual disease', 'Molecular Residual Disease'],
  },
  'aMRD': {
    canonical: 'aMRD',
    chinese: 'aMRD',
    unit: 'mtm/ml',
    category: 'MOLECULAR',
    canonicalColumn: 11, // Column L
    aliases: ['aMRD', 'amrd', 'adjusted MRD'],
  },
  'CEA': {
    canonical: 'CEA',
    chinese: '癌胚抗原',
    unit: 'ng/ml',
    threshold: '<5',
    category: 'MOLECULAR',
    canonicalColumn: 12, // Column M
    aliases: ['CEA', 'cea', '癌胚抗原', 'carcinoembryonic antigen', 'Carcinoembryonic Antigen'],
  },
  'HE4': {
    canonical: 'HE4',
    chinese: 'HE4',
    unit: 'pmol/L',
    threshold: '<76.2',
    category: 'MOLECULAR',
    canonicalColumn: 13, // Column N
    aliases: ['HE4', 'he4', 'Human Epididymis Protein 4', '人附睾蛋白4'],
  },
  'CA19-9': {
    canonical: 'CA19-9',
    chinese: '糖类抗原19-9',
    unit: 'U/ml',
    threshold: '<30',
    category: 'MOLECULAR',
    canonicalColumn: 14, // Column O
    aliases: ['CA19-9', 'CA199', 'ca19-9', 'ca199', '糖类抗原19-9', 'carbohydrate antigen 19-9'],
  },
  'CA724': {
    canonical: 'CA724',
    chinese: '糖类抗原724',
    unit: 'U/ml',
    threshold: '<8.94',
    category: 'MOLECULAR',
    canonicalColumn: 15, // Column P
    aliases: ['CA724', 'CA72-4', 'ca724', 'ca72-4', '糖类抗原724', '糖类抗原72-4'],
  },
  'ROMA绝经后指数': {
    canonical: 'ROMA绝经后指数',
    chinese: 'ROMA绝经后指数',
    unit: '%',
    threshold: '<29.9',
    category: 'MOLECULAR',
    canonicalColumn: 16, // Column Q
    aliases: ['ROMA绝经后指数', 'ROMA postmenopausal', 'ROMA post', 'ROMA绝经后'],
  },
  'ROMA绝经前指数': {
    canonical: 'ROMA绝经前指数',
    chinese: 'ROMA绝经前指数',
    unit: '%',
    threshold: '<11.4',
    category: 'MOLECULAR',
    canonicalColumn: 17, // Column R
    aliases: ['ROMA绝经前指数', 'ROMA premenopausal', 'ROMA pre', 'ROMA绝经前'],
  },
  'CA125': {
    canonical: 'CA125',
    chinese: '糖类抗原125',
    unit: 'U/ml',
    threshold: '<35',
    category: 'MOLECULAR',
    canonicalColumn: 18, // Column S
    aliases: ['CA125', 'ca125', 'CA-125', 'ca-125', '糖类抗原125', '卵巢癌抗原'],
  },
  'AFP': {
    canonical: 'AFP',
    chinese: '甲胎蛋白',
    unit: 'ng/ml',
    threshold: '<7',
    category: 'MOLECULAR',
    canonicalColumn: 19, // Column T
    aliases: ['AFP', 'afp', '甲胎蛋白', 'alpha-fetoprotein', 'Alpha Fetoprotein'],
  },
  'CYFRA21-1': {
    canonical: 'CYFRA21-1',
    chinese: '细胞角蛋白19片段',
    unit: 'ng/ml',
    threshold: '<3.3',
    category: 'MOLECULAR',
    canonicalColumn: -1, // Dynamic column - not in base schema
    aliases: ['CYFRA21-1', 'CYFRA', 'cyfra21-1', 'cyfra', '细胞角蛋白19片段', '角蛋白19', 'Cytokeratin 19 fragment'],
  },
  'NSE': {
    canonical: 'NSE',
    chinese: '神经元特异性烯醇化酶',
    unit: 'ng/ml',
    threshold: '<16.3',
    category: 'MOLECULAR',
    canonicalColumn: -1, // Dynamic column
    aliases: ['NSE', 'nse', '神经元特异性烯醇化酶', 'Neuron-specific enolase'],
  },
  'SCC': {
    canonical: 'SCC',
    chinese: '鳞状细胞癌抗原',
    unit: 'ng/ml',
    threshold: '<1.5',
    category: 'MOLECULAR',
    canonicalColumn: -1, // Dynamic column
    aliases: ['SCC', 'scc', 'SCCA', '鳞状细胞癌抗原', 'Squamous cell carcinoma antigen'],
  },

  // =========================================================================
  // 影像负荷 (Imaging Metrics) - Columns U-X
  // =========================================================================
  '肺': {
    canonical: '肺',
    chinese: '肺部病灶',
    unit: 'mm',
    category: 'IMAGING',
    canonicalColumn: 20, // Column U
    aliases: ['肺', 'Lung', 'lung', '肺部', '肺部病灶', 'pulmonary', 'lung lesion'],
  },
  '肝脏': {
    canonical: '肝脏',
    chinese: '肝脏病灶',
    unit: 'mm',
    category: 'IMAGING',
    canonicalColumn: 21, // Column V
    aliases: ['肝脏', 'Liver', 'liver', '肝', '肝脏病灶', 'hepatic', 'liver lesion'],
  },
  '淋巴': {
    canonical: '淋巴',
    chinese: '淋巴结',
    unit: 'mm',
    category: 'IMAGING',
    canonicalColumn: 22, // Column W
    aliases: ['淋巴', 'Lymph', 'lymph', '淋巴结', 'lymph node', 'LN', 'lymphatic'],
  },
  '盆腔': {
    canonical: '盆腔',
    chinese: '盆腔病灶',
    unit: 'mm',
    category: 'IMAGING',
    canonicalColumn: 23, // Column X
    aliases: ['盆腔', 'Pelvic', 'pelvic', '盆腔病灶', 'pelvis', 'pelvic lesion'],
  },

  // =========================================================================
  // 副作用 (Side Effects / Lab Values) - Columns Y-AC
  // =========================================================================
  '白细胞': {
    canonical: '白细胞',
    chinese: '白细胞计数',
    unit: '10^9/L',
    category: 'SIDE_EFFECTS',
    canonicalColumn: 24, // Column Y
    aliases: ['白细胞', 'WBC', 'wbc', 'White Blood Cell', 'leukocyte', '白细胞计数'],
  },
  '血小板': {
    canonical: '血小板',
    chinese: '血小板计数',
    unit: '10^9/L',
    category: 'SIDE_EFFECTS',
    canonicalColumn: 25, // Column Z
    aliases: ['血小板', 'PLT', 'plt', 'Platelet', 'platelet', '血小板计数', 'thrombocyte'],
  },
  '中性粒细胞': {
    canonical: '中性粒细胞',
    chinese: '中性粒细胞计数',
    unit: '10^9/L',
    category: 'SIDE_EFFECTS',
    canonicalColumn: 26, // Column AA
    aliases: ['中性粒细胞', 'NEU', 'neu', 'Neutrophil', 'neutrophil', 'ANC', '中性粒细胞计数'],
  },
  '谷草转氨酶': {
    canonical: '谷草转氨酶',
    chinese: '谷草转氨酶',
    unit: 'U/L',
    category: 'SIDE_EFFECTS',
    canonicalColumn: 27, // Column AB
    aliases: ['谷草转氨酶', 'AST', 'ast', 'GOT', 'aspartate aminotransferase', 'SGOT'],
  },
  '谷丙转氨酶': {
    canonical: '谷丙转氨酶',
    chinese: '谷丙转氨酶',
    unit: 'U/L',
    category: 'SIDE_EFFECTS',
    canonicalColumn: 28, // Column AC
    aliases: ['谷丙转氨酶', 'ALT', 'alt', 'GPT', 'alanine aminotransferase', 'SGPT'],
  },
};

// =============================================================================
// LOOKUP UTILITIES
// =============================================================================

/**
 * Normalized alias map for fast O(1) lookup
 * Maps lowercase alias -> canonical metric name
 */
const ALIAS_MAP: Map<string, string> = new Map();

// Build the alias map at module load time
Object.entries(METRIC_DICTIONARY).forEach(([canonical, def]) => {
  // Add canonical name itself
  ALIAS_MAP.set(canonical.toLowerCase(), canonical);
  // Add all aliases
  def.aliases.forEach(alias => {
    ALIAS_MAP.set(alias.toLowerCase(), canonical);
  });
});

/**
 * Looks up a metric by name (case-insensitive, supports aliases)
 * @param name - Any name or alias for the metric
 * @returns The canonical metric definition, or undefined if not found
 */
export function lookupMetric(name: string): MetricDefinition | undefined {
  if (!name) return undefined;
  const canonical = ALIAS_MAP.get(name.toLowerCase().trim());
  return canonical ? METRIC_DICTIONARY[canonical] : undefined;
}

/**
 * Gets the canonical name for a metric (case-insensitive, supports aliases)
 * @param name - Any name or alias for the metric
 * @returns The canonical name, or the original name if not found
 */
export function getCanonicalMetricName(name: string): string {
  if (!name) return name;
  const canonical = ALIAS_MAP.get(name.toLowerCase().trim());
  return canonical || name;
}

/**
 * Checks if a name is a known metric
 * @param name - Any name or alias
 * @returns true if the name is recognized
 */
export function isKnownMetric(name: string): boolean {
  return ALIAS_MAP.has(name.toLowerCase().trim());
}

/**
 * Gets all metrics for a specific category
 * @param category - The category key
 * @returns Array of metric definitions in that category
 */
export function getMetricsByCategory(category: keyof typeof METRIC_CATEGORIES): MetricDefinition[] {
  return Object.values(METRIC_DICTIONARY).filter(m => m.category === category);
}

/**
 * Gets all canonical metric names
 * @returns Array of canonical metric names
 */
export function getAllCanonicalMetricNames(): string[] {
  return Object.keys(METRIC_DICTIONARY);
}

/**
 * Gets the column index for a metric
 * @param name - Metric name or alias
 * @returns Column index (0-based), or -1 if not found
 */
export function getMetricColumnIndex(name: string): number {
  const metric = lookupMetric(name);
  return metric ? metric.canonicalColumn : -1;
}

// =============================================================================
// AI PROMPT HELPERS
// =============================================================================

/**
 * Generates a compact metric reference for AI prompts
 * @returns String representation of all metrics for AI context
 */
export function generateMetricReferenceForAI(): string {
  const lines: string[] = [
    '## Canonical Metric Dictionary',
    '',
    'Map user column names to these EXACT canonical names:',
    '',
  ];

  // Group by category
  const categories = ['PERFORMANCE', 'MOLECULAR', 'IMAGING', 'SIDE_EFFECTS'] as const;
  
  for (const cat of categories) {
    const metrics = getMetricsByCategory(cat);
    lines.push(`### ${METRIC_CATEGORIES[cat]} (${cat})`);
    lines.push('| Canonical | Chinese | Unit | Aliases |');
    lines.push('|-----------|---------|------|---------|');
    
    for (const m of metrics) {
      const aliasStr = m.aliases.slice(0, 3).join(', ') + (m.aliases.length > 3 ? '...' : '');
      lines.push(`| ${m.canonical} | ${m.chinese} | ${m.unit} | ${aliasStr} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates the expected column structure for AI prompts
 * @returns String representation of canonical column structure
 */
export function generateColumnStructureForAI(): string {
  return `
## Canonical Column Structure (张莉.xlsx Standard)

### Fixed Columns (A-G) - MUST be in this order:
| Col | Index | Header (Row 2) | Unit (Row 3) | Content |
|-----|-------|----------------|--------------|---------|
| A | 0 | 子类 | 日期\\单位 | Date (Excel serial or ISO) |
| B | 1 | 项目 | - | Phase (治疗阶段) |
| C | 2 | 周期 | 当下周期 | Current Cycle (C1D1, AS0, etc.) |
| D | 3 | - | 前序周期 | Previous Cycle (optional) |
| E | 4 | 方案 | - | Treatment Scheme |
| F | 5 | 处置 | - | Event/Procedure |
| G | 6 | 方案 | - | Scheme Detail |

### Metric Columns (H onwards) - Order by category:
| Col | Category | Example Metrics |
|-----|----------|-----------------|
| H-J | 体能负荷 | Weight, Handgrip, ECOG |
| K-T | 分子负荷 | MRD, aMRD, CEA, HE4, CA19-9, CA724, ROMA, CA125, AFP |
| U-X | 影像负荷 | 肺, 肝脏, 淋巴, 盆腔 |
| Y-AC | 副作用 | 白细胞, 血小板, 中性粒细胞, 谷草转氨酶, 谷丙转氨酶 |

### Row Structure:
- Row 0: Title (e.g., "肿瘤病程周期表")
- Row 1: Category headers
- Row 2: Column headers (metric names)
- Row 3: Units and thresholds
- Row 4+: Data rows
`.trim();
}

