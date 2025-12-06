import { generateObject } from 'ai';
import { qwen } from '@/lib/ai/model';
import { z } from 'zod';
import { getCanonicalMetricName, isKnownMetric, METRIC_DICTIONARY } from '@/lib/schema/metric-dictionary';
import { SCHEMA_VERSION } from '@/lib/schema/oncology-dataset.schema';
import { getCompactSchemaReference } from '@/lib/ai/prompts/data-mapping';

// Define the FormalDataset Schema (Simplified mCODE subset)
// This matches the structure we want to extract from medical reports.
// Updated to enforce canonical metric names from the dictionary.
const FormalDatasetSchema = z.object({
  patient: z.object({
    mrn: z.string().optional(),
    name: z.string().optional(),
  }),
  observations: z.array(z.object({
    date: z.string().describe('ISO 8601 date string (YYYY-MM-DD)'),
    category: z.enum(['laboratory', 'vital-signs', 'tumor-marker', 'procedure', 'event']),
    name: z.string().describe('Use CANONICAL metric name from dictionary'),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    originalText: z.string().optional().describe('The original text snippet from the report'),
  })),
  summary: z.string().describe('A brief summary of the clinical findings in this report'),
});

export async function runIngestionAgent(task: string, payload: any) {
  if (task === 'parse_text') {
    const { text } = payload;

    if (!text) {
      throw new Error('Payload must contain "text" for parse_text task');
    }

    console.log('[Ingestion Agent] Parsing text with schema v' + SCHEMA_VERSION);

    // Get canonical metric names for the prompt
    const metricList = Object.keys(METRIC_DICTIONARY).join(', ');

    const result = await generateObject({
      model: qwen,
      schema: FormalDatasetSchema,
      prompt: `
        You are an expert oncology data specialist.
        Your task is to extract structured clinical data from the following medical report text.
        
        ## CRITICAL: Use CANONICAL Metric Names
        
        ${getCompactSchemaReference()}
        
        Use ONLY these canonical metric names: ${metricList}
        
        The output MUST follow this structure:
        {
          "patient": { "mrn": "...", "name": "..." },
          "observations": [
            {
              "date": "YYYY-MM-DD",
              "category": "laboratory" | "vital-signs" | "tumor-marker" | "procedure" | "event",
              "name": "CANONICAL_METRIC_NAME",
              "value": number | string,
              "unit": "...",
              "originalText": "..."
            }
          ],
          "summary": "..."
        }

        Category mapping:
        - Performance metrics (Weight, ECOG, Handgrip) -> 'vital-signs'
        - Molecular markers (CEA, CA125, MRD, AFP, etc.) -> 'tumor-marker' 
        - Imaging metrics (肺, 肝脏, 淋巴, 盆腔) -> 'laboratory'
        - Side effects (白细胞, 血小板, 谷草转氨酶, etc.) -> 'laboratory'
        - Procedures (Surgery, HEPIC, etc.) -> 'procedure'
        - Treatment cycles (C1D1, AS0, etc.) -> 'event'
        
        Report Text:
        """
        ${text}
        """
      `,
    });

    // Post-process: Normalize metric names to canonical
    const normalizedResult = {
      ...result.object,
      observations: result.object.observations.map((obs: any) => ({
        ...obs,
        name: getCanonicalMetricName(obs.name),
      })),
    };

    console.log('[Ingestion Agent] Parsing complete.');
    return normalizedResult;
  } else if (task === 'map_columns') {
    const { headers } = payload;

    if (!headers || !Array.isArray(headers)) {
      throw new Error('Payload must contain "headers" array for map_columns task');
    }

    console.log('[Ingestion Agent] Mapping columns with schema v' + SCHEMA_VERSION);

    // First, try direct dictionary lookup
    const directMappings: any[] = [];
    const unmapped: string[] = [];

    headers.forEach((h: string) => {
      if (!h || typeof h !== 'string') return;
      
      if (isKnownMetric(h)) {
        directMappings.push({
          original: h,
          target: getCanonicalMetricName(h),
          confidence: 1.0,
        });
      } else {
        unmapped.push(h);
      }
    });

    // If all headers were mapped directly, skip AI call
    if (unmapped.length === 0) {
      console.log('[Ingestion Agent] All columns mapped via dictionary');
      return { mappings: directMappings };
    }

    // Use AI for remaining unmapped columns
    const MappingSchema = z.object({
      mappings: z.array(z.object({
        original: z.string(),
        target: z.string().describe('The CANONICAL metric name from dictionary, or null if no match'),
        confidence: z.number().describe('Confidence score 0-1'),
      })),
    });

    // Get canonical metric list for prompt
    const canonicalMetrics = Object.keys(METRIC_DICTIONARY);

    const result = await generateObject({
      model: qwen,
      schema: MappingSchema,
      prompt: `
        You are an expert oncology data analyst.
        Map the following Excel column headers to the CANONICAL OncoTracker schema.
        
        ## CANONICAL METRIC DICTIONARY (use ONLY these names):
        ${canonicalMetrics.map(m => `- "${m}" (${METRIC_DICTIONARY[m].chinese})`).join('\n')}
        
        ## FIXED COLUMNS (not metrics, map to null):
        - Date columns: 日期, Date, 子类
        - Phase columns: 项目, Phase
        - Cycle columns: 周期, Cycle
        - Scheme columns: 方案, Scheme
        - Event columns: 处置, Event
        
        ## Input Headers to Map:
        ${JSON.stringify(unmapped)}
        
        RULES:
        1. Use EXACT canonical names from the dictionary above
        2. If a header is a known alias (e.g., "体重" -> "Weight"), use the canonical name
        3. If a header cannot be mapped to any canonical metric, set target to null
        4. Set confidence based on match quality (1.0 = exact match, 0.5-0.9 = likely match, <0.5 = uncertain)
      `,
    });

    // Combine direct mappings with AI mappings
    const aiMappings = result.object.mappings.map((m: any) => ({
      ...m,
      target: m.target ? getCanonicalMetricName(m.target) : null, // Normalize AI output
    }));

    return { mappings: [...directMappings, ...aiMappings] };
  }

  throw new Error(`Unknown task: ${task}`);
}
