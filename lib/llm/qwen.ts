/**
 * Qwen LLM Integration for Intelligent Data Analysis
 * 
 * This module provides AI-powered data analysis using the Qwen model.
 * 
 * PHILOSOPHY:
 * - AI MUST be used for non-canonical data - no shortcuts
 * - Quick mapping ONLY for files that EXACTLY match 张莉.xlsx structure
 * - The canonical schema is IMMUTABLE - AI transforms TO it
 * 
 * @version 3.0.0 - Intelligent Analysis
 */

import { generateText } from 'ai';
import { qwen } from '@/lib/ai/model';
import { 
  getDataMappingSystemPrompt, 
  getDataMappingUserPrompt,
  CANONICAL_SCHEMA
} from '@/lib/ai/prompts/data-mapping';
import { 
  lookupMetric, 
  getCanonicalMetricName, 
  isKnownMetric,
  METRIC_DICTIONARY 
} from '@/lib/schema/metric-dictionary';
import { SCHEMA_VERSION } from '@/lib/schema/oncology-dataset.schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * AI Analysis Result - the structured output from AI
 */
export interface AIAnalysisResult {
  analysis: {
    detectedHeaderRow: number;
    detectedDataStartRow: number;
    totalColumns: number;
    dataQuality: 'good' | 'acceptable' | 'poor';
  };
  dateColumn: {
    sourceIndex: number;
    sourceName: string | null;
    confidence: number;
    reasoning: string;
  };
  fixedColumnMappings: {
    phase: { sourceIndex: number; sourceName: string; confidence: number } | null;
    cycle: { sourceIndex: number; sourceName: string; confidence: number } | null;
    prevCycle: { sourceIndex: number; sourceName: string; confidence: number } | null;
    scheme: { sourceIndex: number; sourceName: string; confidence: number } | null;
    event: { sourceIndex: number; sourceName: string; confidence: number } | null;
    schemeDetail: { sourceIndex: number; sourceName: string; confidence: number } | null;
  };
  metricMappings: Record<string, {
    sourceIndex: number;
    canonicalName: string;
    category: string;
    confidence: number;
    reasoning: string;
  }>;
  unmappedColumns: Array<{ index: number; name: string; reason: string }>;
  warnings: string[];
  transformationNotes: string;
}

/**
 * Legacy format for backward compatibility with transformer
 */
export interface LegacyMappingResult {
  date_col: string | null;
  date_col_index: number;  // Added: explicit index for date column
  metrics: Record<string, string>;
  events: string[];
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyzes file structure and maps columns to canonical schema
 * 
 * @param fileHeader - Array of column headers from the file
 * @param sampleRows - First few data rows for context
 * @returns Mapping result with canonical column assignments
 */
export async function analyzeStructure(
  fileHeader: any[], 
  sampleRows: any[]
): Promise<LegacyMappingResult> {
  console.log('[Qwen] Starting data analysis...');
  console.log('[Qwen] Headers:', fileHeader.slice(0, 10));
  console.log('[Qwen] Sample row 0:', sampleRows[0]?.slice?.(0, 10));
  
  // Step 1: Check if file is EXACTLY in canonical format
  // This is the ONLY case where we skip AI
  const canonicalCheck = isExactlyCanonical(fileHeader);
  if (canonicalCheck.isCanonical) {
    console.log('[Qwen] File is EXACTLY canonical format - using direct mapping');
    return canonicalCheck.mapping!;
  }
  
  console.log('[Qwen] File needs AI transformation - calling Qwen...');
  
  // Step 2: Use AI for intelligent analysis
  try {
    const aiResult = await callAIForAnalysis(fileHeader, sampleRows);
    console.log('[Qwen] AI analysis complete');
    
    // Step 3: Convert to legacy format
    const mapping = convertAIResultToLegacy(aiResult, fileHeader);
    
    // Step 4: Validate the mapping
    const validation = validateMapping(mapping);
    if (!validation.valid) {
      console.warn('[Qwen] Mapping validation warnings:', validation.warnings);
    }
    
    return mapping;
    
  } catch (error) {
    console.error('[Qwen] AI analysis failed:', error);
    
    // Step 5: Last resort - rule-based fallback (but log warning)
    console.warn('[Qwen] Using rule-based fallback - this may be less accurate');
    return ruleBasedFallback(fileHeader, sampleRows);
  }
}

// =============================================================================
// CANONICAL FORMAT DETECTION
// =============================================================================

/**
 * Checks if a file is EXACTLY in canonical 张莉.xlsx format.
 * This is very strict - ANY deviation means AI must be used.
 */
function isExactlyCanonical(headers: any[]): { isCanonical: boolean; mapping?: LegacyMappingResult } {
  // Must have at least 10 columns
  if (!Array.isArray(headers) || headers.length < 10) {
    return { isCanonical: false };
  }
  
  // EXACT header matches required for fixed columns
  const fixedColumnChecks = [
    headers[0] === '子类',        // Date column
    headers[1] === '项目',        // Phase
    headers[2] === '周期',        // Cycle
    headers[3] === '' || headers[3] === null || headers[3] === undefined,  // PrevCycle (empty header)
    headers[4] === '方案',        // Scheme
    headers[5] === '处置',        // Event
    headers[6] === '方案',        // SchemeDetail (second 方案)
  ];
  
  const passedFixedChecks = fixedColumnChecks.filter(Boolean).length;
  
  // Must pass ALL fixed column checks
  if (passedFixedChecks < 6) {  // Allow one mismatch for flexibility
    console.log(`[Canonical Check] Failed: only ${passedFixedChecks}/7 fixed columns match`);
    return { isCanonical: false };
  }
  
  // Check metric columns (starting at index 7)
  const expectedMetrics = CANONICAL_SCHEMA.metricOrder;
  let matchedMetrics = 0;
  
  for (let i = 0; i < expectedMetrics.length && (7 + i) < headers.length; i++) {
    if (headers[7 + i] === expectedMetrics[i]) {
      matchedMetrics++;
    }
  }
  
  // Must have at least 5 metrics in correct positions
  if (matchedMetrics < 5) {
    console.log(`[Canonical Check] Failed: only ${matchedMetrics} metrics in correct positions`);
    return { isCanonical: false };
  }
  
  console.log(`[Canonical Check] PASSED: ${passedFixedChecks}/7 fixed, ${matchedMetrics} metrics`);
  
  // Build mapping for canonical file - include ALL metrics, not just known ones
  const metrics: Record<string, string> = {};
  for (let i = 7; i < headers.length; i++) {
    const h = headers[i];
    if (h && typeof h === 'string' && h.trim()) {
      // Use canonical name if known, otherwise preserve original
      metrics[h] = isKnownMetric(h) ? getCanonicalMetricName(h) : h;
    }
  }
  
  return {
    isCanonical: true,
    mapping: {
      date_col: '子类',
      date_col_index: 0,
      metrics,
      events: ['项目', '处置'],
    },
  };
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

/**
 * Calls the AI for intelligent data analysis
 */
async function callAIForAnalysis(headers: any[], sampleRows: any[]): Promise<AIAnalysisResult> {
  const systemPrompt = getDataMappingSystemPrompt();
  const userPrompt = getDataMappingUserPrompt(headers, sampleRows);
  
  const { text } = await generateText({
    model: qwen,
    prompt: `${systemPrompt}\n\n${userPrompt}`,
    temperature: 0.1,  // Low temperature for consistent analysis
  });
  
  // Parse AI response
  let jsonStr = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  
  // Try to extract JSON if there's extra text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  try {
    const result = JSON.parse(jsonStr);
    console.log('[Qwen] Parsed AI result:', JSON.stringify(result, null, 2).slice(0, 500));
    return result as AIAnalysisResult;
  } catch (parseError) {
    console.error('[Qwen] Failed to parse AI response:', text.slice(0, 500));
    throw new Error('AI returned invalid JSON');
  }
}

/**
 * Converts AI analysis result to legacy format for transformer
 */
function convertAIResultToLegacy(aiResult: AIAnalysisResult, headers: any[]): LegacyMappingResult {
  const metrics: Record<string, string> = {};
  const events: string[] = [];
  
  // Process metric mappings - include ALL metrics, even custom ones with low confidence
  if (aiResult.metricMappings) {
    Object.entries(aiResult.metricMappings).forEach(([sourceName, mapping]) => {
      // Include metric if:
      // 1. High confidence (>= 0.5) for known metrics
      // 2. ANY custom metric (isCustomMetric = true) - we don't want to lose patient data
      // 3. Has a canonical name assigned
      const isCustom = (mapping as any).isCustomMetric === true;
      const hasCanonicalName = mapping.canonicalName && mapping.canonicalName.trim();
      
      if ((mapping.confidence >= 0.5 || isCustom) && hasCanonicalName) {
        metrics[sourceName] = mapping.canonicalName;
        if (isCustom) {
          console.log(`[Qwen] Preserving custom metric: ${sourceName} → ${mapping.canonicalName}`);
        }
      }
    });
  }
  
  // Process fixed column mappings for events
  const fixedMappings = aiResult.fixedColumnMappings;
  if (fixedMappings) {
    if (fixedMappings.phase?.sourceName) events.push(fixedMappings.phase.sourceName);
    if (fixedMappings.event?.sourceName) events.push(fixedMappings.event.sourceName);
    if (fixedMappings.cycle?.sourceName) events.push(fixedMappings.cycle.sourceName);
    if (fixedMappings.scheme?.sourceName) events.push(fixedMappings.scheme.sourceName);
  }
  
  // Determine date column
  let dateCol: string | null = null;
  let dateColIndex = 0;
  
  if (aiResult.dateColumn) {
    dateCol = aiResult.dateColumn.sourceName || 'column_0';
    dateColIndex = aiResult.dateColumn.sourceIndex ?? 0;
    
    // If dateCol is a non-date column name, force to column 0
    const nonDateNames = ['项目', 'Phase', '处置', 'Event', '周期', 'Cycle'];
    if (dateCol && nonDateNames.includes(dateCol)) {
      console.warn(`[Qwen] AI suggested "${dateCol}" as date column - overriding to column 0`);
      dateCol = headers[0] || 'column_0';
      dateColIndex = 0;
    }
  }
  
  return {
    date_col: dateCol,
    date_col_index: dateColIndex,
    metrics,
    events,
  };
}

// =============================================================================
// RULE-BASED FALLBACK
// =============================================================================

/**
 * Last resort fallback using rules
 * This should rarely be used - AI should handle most cases
 */
function ruleBasedFallback(headers: any[], sampleRows: any[]): LegacyMappingResult {
  const metrics: Record<string, string> = {};
  const events: string[] = [];
  let dateCol: string | null = null;
  let dateColIndex = 0;
  
  // Analyze sample data to find date column
  // Look for Excel serial dates (numbers 40000-50000) or date strings
  for (let colIdx = 0; colIdx < Math.min(10, headers.length); colIdx++) {
    const values = sampleRows.map(row => row?.[colIdx]).filter(v => v !== undefined && v !== null);
    const numValues = values.filter(v => typeof v === 'number');
    
    if (numValues.length > 0) {
      const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
      // Excel dates for years 2020-2030 are roughly 43831-47483
      if (avg > 40000 && avg < 50000) {
        dateCol = headers[colIdx] || `column_${colIdx}`;
        dateColIndex = colIdx;
        console.log(`[Fallback] Found date column at index ${colIdx} (avg value: ${avg})`);
        break;
      }
    }
  }
  
  // If no date found by value analysis, default to column 0
  if (!dateCol) {
    dateCol = headers[0] || 'column_0';
    dateColIndex = 0;
    console.log('[Fallback] No date column detected, defaulting to column 0');
  }
  
  // Map headers to metrics - preserve ALL numeric columns, not just known ones
  const fixedColumnKeywords = ['项目', '处置', 'Phase', 'Event', '周期', 'Cycle', '方案', 'Scheme', '子类', 'Date'];
  
  headers.forEach((h, idx) => {
    if (!h || typeof h !== 'string') return;
    if (idx === dateColIndex) return; // Skip date column
    
    const headerName = h.trim();
    
    // Check for event/fixed columns
    if (fixedColumnKeywords.some(kw => headerName.includes(kw))) {
      events.push(headerName);
      return;
    }
    
    // Check for known metrics (including Chinese aliases)
    const metric = lookupMetric(headerName);
    if (metric) {
      metrics[headerName] = metric.canonical;
    } else {
      // Check if this column has numeric data (likely a metric)
      const values = sampleRows.map(row => row?.[idx]).filter(v => v !== undefined && v !== null && v !== '');
      const hasNumericData = values.some(v => typeof v === 'number' || !isNaN(parseFloat(v)));
      
      if (hasNumericData) {
        // Preserve unknown metric with original name
        metrics[headerName] = headerName;
        console.log(`[Fallback] Preserving unknown metric: ${headerName}`);
      }
    }
  });
  
  return {
    date_col: dateCol,
    date_col_index: dateColIndex,
    metrics,
    events,
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates a mapping result
 */
function validateMapping(mapping: LegacyMappingResult): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check date column
  if (!mapping.date_col) {
    warnings.push('No date column identified - will default to column 0');
  }
  
  // Check metrics count
  const metricCount = Object.keys(mapping.metrics).length;
  if (metricCount === 0) {
    warnings.push('No metrics mapped - data may be incomplete');
  } else if (metricCount < 3) {
    warnings.push(`Only ${metricCount} metrics mapped - expected more`);
  }
  
  // Check for required metrics
  const mappedCanonical = new Set(Object.values(mapping.metrics));
  const importantMetrics = ['Weight', 'CEA', 'CA125'];
  importantMetrics.forEach(m => {
    if (!mappedCanonical.has(m)) {
      warnings.push(`Important metric "${m}" not found in mapping`);
    }
  });
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { validateMapping };
export function getSchemaVersion(): string {
  return SCHEMA_VERSION;
}
