/**
 * AI Prompts for Intelligent Data Mapping & Transformation
 * 
 * PHILOSOPHY:
 * - The canonical 张莉.xlsx structure is IMMUTABLE - AI transforms TO it, never modifies it
 * - AI must truly UNDERSTAND the data semantically, not just pattern match
 * - AI analyzes both HEADERS and DATA VALUES to make intelligent decisions
 * - Transformation is deterministic: same input → same canonical output
 * 
 * @version 2.0.0
 */

import { generateMetricReferenceForAI, generateColumnStructureForAI, METRIC_DICTIONARY } from '@/lib/schema/metric-dictionary';
import { SCHEMA_VERSION, ROW_INDICES } from '@/lib/schema/oncology-dataset.schema';

// =============================================================================
// CANONICAL SCHEMA DEFINITION (IMMUTABLE)
// =============================================================================

/**
 * The canonical schema is NEVER modified by AI. This is the target structure.
 */
export const CANONICAL_SCHEMA = {
  version: SCHEMA_VERSION,

  // Row structure (0-indexed)
  rows: {
    TITLE: 0,        // "患者名 - 肿瘤病程周期表"
    CATEGORIES: 1,   // "分类", "节拍", "", "", "", "事件", "", "体能负荷"...
    HEADERS: 2,      // "子类", "项目", "周期", "", "方案", "处置", "方案", "Weight"...
    UNITS: 3,        // "日期\单位", "", "当下周期", "前序周期", "", "", "", "KG"...
    DATA_START: 4,   // First data row
  },

  // Fixed columns (0-indexed) - NEVER CHANGE THESE
  fixedColumns: {
    DATE: { index: 0, header: '子类', unit: '日期\\单位', description: 'Date in Excel serial or ISO format' },
    PHASE: { index: 1, header: '项目', unit: '', description: 'Treatment phase (e.g., 新辅助, 腹腔镜, AS)' },
    CYCLE: { index: 2, header: '周期', unit: '当下周期', description: 'Current cycle (e.g., C1D1, AS17)' },
    PREV_CYCLE: { index: 3, header: '', unit: '前序周期', description: 'Previous cycle reference' },
    SCHEME: { index: 4, header: '方案', unit: '', description: 'Treatment scheme/regimen' },
    EVENT: { index: 5, header: '处置', unit: '', description: 'Event or procedure' },
    SCHEME_DETAIL: { index: 6, header: '方案', unit: '', description: 'Detailed scheme information' },
  },

  // Metric columns start at index 7 and follow this exact order
  metricOrder: [
    'Weight', 'Handgrip', 'ECOG',  // Performance (index 7-9)
    'MRD', 'aMRD', 'CEA', 'HE4', 'CA19-9', 'CA724', 'ROMA绝经后指数', 'ROMA绝经前指数', 'CA125', 'AFP',  // Molecular (10-19)
    '肺', '肝脏', '淋巴', '盆腔',  // Imaging (20-23)
    '白细胞', '血小板', '中性粒细胞', '谷草转氨酶', '谷丙转氨酶',  // Side effects (24-28)
  ],
} as const;

// =============================================================================
// INTELLIGENT ANALYSIS SYSTEM PROMPT
// =============================================================================

export function getDataMappingSystemPrompt(): string {
  return `
# OncoTracker Intelligent Data Mapping System

You are an expert medical data analyst with deep understanding of oncology data structures. Your task is to ANALYZE uploaded patient data and create a mapping to transform it into the CANONICAL OncoTracker schema.

## CRITICAL PRINCIPLE: CANONICAL SCHEMA IS IMMUTABLE

The target schema (张莉.xlsx structure) is FIXED and CANNOT be modified. Your job is to:
1. UNDERSTAND the uploaded data's structure through semantic analysis
2. CREATE a mapping that transforms the data TO the canonical structure
3. NEVER suggest changes to the canonical schema

## CANONICAL SCHEMA DEFINITION

${JSON.stringify(CANONICAL_SCHEMA, null, 2)}

## METRIC DICTIONARY

The following metrics must be mapped to their EXACT canonical names:

${Object.entries(METRIC_DICTIONARY).map(([canonical, def]) =>
    `- **${canonical}** (${def.chinese}): aliases=[${def.aliases.join(', ')}], unit=${def.unit || 'none'}, category=${def.category}`
  ).join('\n')}

## ANALYSIS METHODOLOGY

### Step 1: Data Type Analysis
For each column, analyze the ACTUAL DATA VALUES to determine:
- Is it TEMPORAL? (dates, timestamps, Excel serial numbers 40000-50000)
- Is it CATEGORICAL? (treatment phases, cycle codes like C1D1, AS17)
- Is it NUMERIC? (lab values, measurements)
- Is it TEXT? (event descriptions, scheme names)

### Step 2: Semantic Understanding
Don't just match column names - understand the MEANING:
- "体重" and "Weight" both mean body weight → map to canonical "Weight"
- "握力" and "Handgrip" both mean grip strength → map to canonical "Handgrip"  
- Numbers like 45941, 45449 are Excel serial dates (days since 1900-01-01)

### IMPORTANT: Allow NEW/UNKNOWN Metrics
Different patients may have different metrics being monitored. If you encounter a metric not in the dictionary:
- **PRESERVE IT** - do NOT ignore or mark as unmapped
- Use the EXACT original header name from the file as the canonical name (whether Chinese, English, or mixed)
- Assign category "CUSTOM" 
- Example: If header is "细胞角蛋白19片段", map to "细胞角蛋白19片段". If header is "NewMetric", map to "NewMetric".

### Step 3: Structure Detection
Identify the uploaded file's structure:
- Where is the header row? (look for metric names, not units)
- Where does data start? (look for dates or numeric values)
- Are there merged cells or multi-row headers?

## OUTPUT FORMAT

Return a JSON object:

\`\`\`json
{
  "analysis": {
    "detectedHeaderRow": <number>,
    "detectedDataStartRow": <number>,
    "totalColumns": <number>,
    "dataQuality": "good" | "acceptable" | "poor"
  },
  "dateColumn": {
    "sourceIndex": <number>,
    "sourceName": "<original header or null if empty>",
    "confidence": <0.0-1.0>,
    "reasoning": "<why this column contains dates>"
  },
  "fixedColumnMappings": {
    "phase": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null,
    "cycle": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null,
    "prevCycle": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null,
    "scheme": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null,
    "event": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null,
    "schemeDetail": { "sourceIndex": <number>, "sourceName": "<name>", "confidence": <0.0-1.0> } | null
  },
  "metricMappings": {
    "<SourceColumnName>": {
      "sourceIndex": <number>,
      "canonicalName": "<canonical name OR original name if not in dictionary>",
      "category": "PERFORMANCE" | "MOLECULAR" | "IMAGING" | "SIDE_EFFECTS" | "CUSTOM",
      "confidence": <0.0-1.0>,
      "reasoning": "<why this mapping>",
      "isCustomMetric": <boolean - true if not in standard dictionary>
    }
  },
  "unmappedColumns": [
    { "index": <number>, "name": "<name>", "reason": "<why couldn't map - ONLY for non-metric columns>" }
  ],
  "warnings": ["<any data quality issues>"],
  "transformationNotes": "<summary of how to transform this data>"
}
\`\`\`

## RULES (NEVER VIOLATE)

1. **Date column detection**: Look for 5-digit numbers (Excel serial) or date strings in DATA, not headers
2. **Known metrics**: Map to canonical names from dictionary. "体重" → "Weight"
3. **UNKNOWN metrics**: PRESERVE with original name EXACTLY as it appears in the dataset (Chinese or English). Do NOT translate or normalize. Example: "CustomMetric" → keep as "CustomMetric", "细胞角蛋白19片段" → keep as "细胞角蛋白19片段". Category="CUSTOM".
4. **Column order**: Known metrics follow canonical order. Custom metrics go at the end.
5. **Confidence scores**: Be honest. If unsure, use low confidence and explain why.
6. **Never drop data**: Every numeric metric column MUST be preserved, whether known or custom.
`.trim();
}

// =============================================================================
// USER PROMPT WITH DATA
// =============================================================================

export function getDataMappingUserPrompt(headers: any[], sampleRows: any[]): string {
  // Analyze the data to provide hints to the AI
  const dataAnalysis = analyzeDataForAI(headers, sampleRows);

  return `
## Data Analysis Task

Analyze this uploaded data and create a mapping to the CANONICAL schema.

### Uploaded File Structure

**Detected Header Row:**
\`\`\`json
${JSON.stringify(headers, null, 2)}
\`\`\`

**Sample Data Rows (for value analysis):**
\`\`\`json
${JSON.stringify(sampleRows, null, 2)}
\`\`\`

### Pre-Analysis Hints

${dataAnalysis}

### Your Task

1. **Analyze each column** by looking at BOTH the header AND the sample values
2. **Identify the date column** - look for Excel serial numbers (40000-50000 range) or date strings
3. **Map metrics** to their canonical names using semantic understanding
4. **Identify fixed columns** (Phase, Cycle, Scheme, Event) by their content patterns
5. **Flag unmapped columns** with reasons

Remember: The canonical schema is FIXED. You are creating a MAPPING, not modifying the target.

Return ONLY the JSON object. No markdown, no explanations outside the JSON.
`.trim();
}

/**
 * Pre-analyzes the data to provide hints to the AI
 */
function analyzeDataForAI(headers: any[], sampleRows: any[]): string {
  const hints: string[] = [];

  // Check each column
  headers.forEach((header, idx) => {
    const values = sampleRows.map(row => row?.[idx]).filter(v => v !== undefined && v !== null && v !== '');

    if (values.length === 0) {
      hints.push(`- Column ${idx} ("${header || 'empty'}"): No data values found`);
      return;
    }

    // Check if values look like dates (Excel serial OR string dates)
    const numericValues = values.filter(v => typeof v === 'number');
    const stringValues = values.filter(v => typeof v === 'string');

    // 1. Excel Serial Dates (approx 1900-2100)
    if (numericValues.length > 0) {
      const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      if (avg > 35000 && avg < 60000) { // Expanded range
        hints.push(`- Column ${idx} ("${header || 'empty'}"): Contains Excel serial dates (values: ${numericValues.slice(0, 3).join(', ')}...)`);
      } else if (avg < 1000) {
        hints.push(`- Column ${idx} ("${header || 'empty'}"): Contains small numbers, likely lab values (values: ${numericValues.slice(0, 3).join(', ')}...)`);
      }
    }

    // 2. String Dates (YYYY-MM-DD, YYYY/MM/DD, etc.)
    if (stringValues.length > 0) {
      const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/;
      if (stringValues.some(v => datePattern.test(v) || !isNaN(Date.parse(v)))) {
        hints.push(`- Column ${idx} ("${header || 'empty'}"): Contains string dates (values: ${stringValues.slice(0, 3).join(', ')}...)`);
      }
    }

    // 3. Header Keyword Match (Strong Signal)
    if (header && typeof header === 'string') {
      if (/date|日期|time|时间/i.test(header)) {
        hints.push(`- Column ${idx} ("${header}"): Header suggests DATE column`);
      }
    }

    // Check if values look like cycle codes
    if (stringValues.some(v => /^C\d+D\d+|^AS\d+/i.test(v))) {
      hints.push(`- Column ${idx} ("${header || 'empty'}"): Contains cycle codes (values: ${stringValues.slice(0, 3).join(', ')}...)`);
    }

    // Check if header matches known metrics
    if (header && typeof header === 'string') {
      const headerLower = header.toLowerCase();
      const matchedMetric = Object.entries(METRIC_DICTIONARY).find(([canonical, def]) =>
        canonical.toLowerCase() === headerLower ||
        def.aliases.some(a => a.toLowerCase() === headerLower)
      );
      if (matchedMetric) {
        hints.push(`- Column ${idx} ("${header}"): Matches metric "${matchedMetric[0]}" (category: ${matchedMetric[1].category})`);
      }
    }
  });

  return hints.length > 0 ? hints.join('\n') : 'No specific patterns detected in pre-analysis.';
}

// =============================================================================
// TRANSFORMATION VALIDATION PROMPT
// =============================================================================

export function getValidationPrompt(): string {
  return `
## Post-Transformation Validation

After transformation, verify the output matches the CANONICAL schema EXACTLY:

### Required Structure
- Row 0: Title row with patient name
- Row 1: Category headers (分类, 节拍, ..., 事件, ..., 体能负荷, ...)
- Row 2: Column headers (子类, 项目, 周期, [empty], 方案, 处置, 方案, Weight, Handgrip, ...)
- Row 3: Units row (日期\\单位, [empty], 当下周期, 前序周期, ..., KG, KG, ...)
- Row 4+: Data rows

### Required Columns (in order)
0: Date (子类)
1: Phase (项目)
2: Cycle (周期)
3: Previous Cycle ([empty header])
4: Scheme (方案)
5: Event (处置)
6: Scheme Detail (方案)
7+: Metrics in canonical order

### Validation Checks
1. ✓ All fixed columns present in correct order?
2. ✓ Metric columns use EXACT canonical names?
3. ✓ Date values are Excel serial numbers or valid ISO strings?
4. ✓ No data loss during transformation?
5. ✓ Category headers match canonical structure?

Return validation result as JSON:
{
  "valid": boolean,
  "errors": ["list of validation errors"],
  "warnings": ["list of warnings"],
  "stats": {
    "inputRows": number,
    "outputRows": number,
    "metricsPreserved": number,
    "dataLossPercent": number
  }
}
`.trim();
}

// =============================================================================
// COMPACT SCHEMA REFERENCE (for token efficiency)
// =============================================================================

export function getCompactSchemaReference(): string {
  return `
CANONICAL SCHEMA v${SCHEMA_VERSION} (张莉.xlsx) - IMMUTABLE TARGET

STRUCTURE:
Row0=Title | Row1=Categories | Row2=Headers | Row3=Units | Row4+=Data

FIXED COLUMNS (indices 0-6):
0:Date(子类) | 1:Phase(项目) | 2:Cycle(周期) | 3:PrevCycle | 4:Scheme(方案) | 5:Event(处置) | 6:SchemeDetail(方案)

METRICS (indices 7+, in order):
Performance: Weight, Handgrip, ECOG
Molecular: MRD, aMRD, CEA, HE4, CA19-9, CA724, ROMA绝经后指数, ROMA绝经前指数, CA125, AFP
Imaging: 肺, 肝脏, 淋巴, 盆腔
SideEffects: 白细胞, 血小板, 中性粒细胞, 谷草转氨酶, 谷丙转氨酶

DATE FORMAT: Excel serial (e.g., 45449) or ISO string
CYCLE FORMAT: C#D# (e.g., C1D1) or AS# (e.g., AS17)
`.trim();
}

// =============================================================================
// LEGACY COMPATIBILITY EXPORTS
// =============================================================================

export const FIXED_COLUMN_NAMES = CANONICAL_SCHEMA.fixedColumns;
export const ROW_STRUCTURE = CANONICAL_SCHEMA.rows;

// For backward compatibility with existing code
export function getCanonicalTransformPrompt(): string {
  return getValidationPrompt();
}
