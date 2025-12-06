import { generateText } from 'ai';
import { z } from 'zod';
import { qwen } from '@/lib/ai/model';

// Schema for the agent's response (kept for reference/validation)
const JourneyResponseSchema = z.object({
    message: z.string().describe('The text response to the user'),
    showChart: z.boolean().describe('Whether to show the patient journey chart'),
    chartConfig: z.object({
        viewMode: z.enum(['full', 'compact']).optional(),
        highlightMetric: z.string().optional(),
    }).optional(),
});

export async function runJourneyExplainerAgent(task: string, context?: any) {
    const contextStr = context ? JSON.stringify(context, null, 2) : 'No data context provided.';

    const { text } = await generateText({
        model: qwen,
        prompt: `
      You are an expert oncology data specialist.
      The user is asking about the patient's journey.
      
      Patient Data Context (Metrics):
      ${contextStr}
      
      User Query: "${task}"
      
      Instructions:
      1. Analyze the provided Patient Data Context if relevant to the query.
      2. If the user asks for specific values or trends (e.g., "weight trend"), USE THE DATA to provide a specific answer (e.g., "Weight decreased from X to Y").
      3. Decide if you should show the Patient Journey Chart.
      4. If the user asks about trends, timeline, treatment history, weight, or tumor markers, you SHOULD show the chart.
      
      Respond with a message and the chart configuration in JSON format.
      Example JSON:
      {
        "message": "The patient's weight has been stable around 60kg...",
        "showChart": true,
        "chartConfig": { "highlightMetric": "Weight" }
      }
    `,
    });

    console.log('[Journey Agent] Raw Output:', text);

    try {
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);
        return JourneyResponseSchema.parse(data);
    } catch (error) {
        console.error('[Journey Agent] Parse Error:', error);
        // Fallback response
        return {
            message: text || "I couldn't process the data correctly, but here is what I found.",
            showChart: false,
        };
    }
}
