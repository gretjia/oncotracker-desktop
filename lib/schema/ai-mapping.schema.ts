
import { z } from 'zod';

export const AnalysisResultSchema = z.object({
    thought_process: z.string().describe("Step-by-step reasoning about the file structure, column identification, and mapping decisions."),
    analysis: z.object({
        detectedHeaderRow: z.number(),
        detectedDataStartRow: z.number(),
        totalColumns: z.number(),
        dataQuality: z.enum(['good', 'acceptable', 'poor']),
    }),
    dateColumn: z.object({
        sourceIndex: z.number(),
        sourceName: z.string().nullable(),
        confidence: z.number(),
        reasoning: z.string(),
    }),
    fixedColumnMappings: z.object({
        phase: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
        cycle: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
        prevCycle: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
        scheme: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
        event: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
        schemeDetail: z.object({ sourceIndex: z.number(), sourceName: z.string(), confidence: z.number() }).nullable(),
    }),
    metricMappings: z.record(z.string(), z.object({
        sourceIndex: z.number(),
        canonicalName: z.string(),
        category: z.string(),
        confidence: z.number(),
        reasoning: z.string(),
        isCustomMetric: z.boolean(),
    })),
    unmappedColumns: z.array(z.object({
        index: z.number(),
        name: z.string(),
        reason: z.string(),
    })),
    warnings: z.array(z.string()),
    transformationNotes: z.string(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
