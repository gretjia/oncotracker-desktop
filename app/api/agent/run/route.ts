import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runIngestionAgent } from '@/lib/ai/agents/ingestion';
import { runJourneyExplainerAgent } from '@/lib/ai/agents/journey_explainer';

// Schema for the agent run request
const AgentRunSchema = z.object({
    agent: z.enum(['ingestion', 'journey_explainer', 'safety', 'care']),
    task: z.string(),
    payload: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { agent, task, payload } = AgentRunSchema.parse(body);

        console.log(`[Agent Runtime] Running agent: ${agent}, task: ${task}`);

        let result;

        switch (agent) {
            case 'ingestion':
                result = await runIngestionAgent(task, payload);
                break;
            case 'journey_explainer':
                result = await runJourneyExplainerAgent(task, payload?.context);
                break;
            case 'safety':
                return NextResponse.json({ error: 'Safety Agent not implemented yet' }, { status: 501 });
            case 'care':
                return NextResponse.json({ error: 'Care Agent not implemented yet' }, { status: 501 });
            default:
                return NextResponse.json({ error: 'Invalid agent' }, { status: 400 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('[Agent Runtime] Error:', error);
        if (error instanceof z.ZodError) {
            console.error('[Agent Runtime] Zod Error:', JSON.stringify((error as any).errors, null, 2));
            return NextResponse.json({ error: 'Invalid request body', details: (error as any).errors }, { status: 400 });
        }
        console.error('[Agent Runtime] Internal Error:', String(error));
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
