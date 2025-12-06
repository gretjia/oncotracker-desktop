
import { qwen, qwenMax } from '@/lib/ai/model';
import { streamObject } from 'ai';
import { z } from 'zod';
import { getDataMappingSystemPrompt, getDataMappingUserPrompt } from '@/lib/ai/prompts/data-mapping';

export const maxDuration = 60;

import { AnalysisResultSchema } from '@/lib/schema/ai-mapping.schema';

export async function POST(req: Request) {
    try {
        const { headers, samples, useDeepAnalysis } = await req.json();

        if (!headers || !samples) {
            return new Response('Missing headers or samples', { status: 400 });
        }

        // Prepare Prompts
        const systemPrompt = getDataMappingSystemPrompt();
        const userPrompt = getDataMappingUserPrompt(headers, samples);

        // Stream Response
        const model = useDeepAnalysis ? qwenMax : qwen;

        const result = streamObject({
            model,
            schema: AnalysisResultSchema,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.1,
        });

        return result.toTextStreamResponse();

    } catch (error: any) {
        console.error('Analysis Error:', error);
        return new Response(error.message, { status: 500 });
    }
}
