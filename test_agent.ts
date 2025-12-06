import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env BEFORE importing anything that uses it
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    // Now import the agent dynamically to avoid hoisting issues
    const { runIngestionAgent } = await import('@/lib/ai/agents/ingestion');

    const sampleText = `
    Patient: John Doe (MRN: 12345)
    Date: 2024-06-01
    Weight: 65kg
    CEA: 4.5 ng/mL
    Notes: Patient started Cycle 1 of FLOT chemotherapy.
  `;

    console.log('Testing Ingestion Agent...');
    try {
        const result = await runIngestionAgent('parse_text', { text: sampleText });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
