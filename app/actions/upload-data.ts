'use server';

import { runIngestionAgent } from '@/lib/ai/agents/ingestion';
import * as XLSX from 'xlsx';

export async function uploadData(formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file uploaded');
    }

    const buffer = await file.arrayBuffer();
    let rawData: any[][] = [];

    if (file.name.endsWith('.json')) {
        const text = new TextDecoder().decode(buffer);
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
            rawData = json;
        } else {
            // Handle case where JSON might be wrapped or single object
            rawData = [json];
        }
        // If it's an array of objects, we need to convert to array of arrays for consistency if that's what the rest of the logic expects,
        // OR we adapt the logic below. The current logic expects array of arrays (sheet_to_json with header:1).
        // Let's normalize JSON to array of objects and skip the array-of-arrays step if possible, 
        // BUT the downstream logic uses `potentialHeaders = rawData[2]`.
        // Actually, `sheet_to_json` with `header: 1` returns array of arrays.
        // If we have JSON objects, we should probably convert them to that format or adjust downstream.

        // Simpler approach: If JSON, assume it's already an array of objects matching the final structure, 
        // and we just need to extract headers.

        // Let's convert array-of-objects to array-of-arrays to reuse the header extraction logic
        if (rawData.length > 0 && typeof rawData[0] === 'object') {
            const headers = Object.keys(rawData[0]);
            const rows = rawData.map(obj => headers.map(h => (obj as any)[h]));
            rawData = [headers, ...rows]; // Prepend headers

            // Adjust for the "row 2" assumption in the existing code?
            // The existing code assumes row 2 (index 2) is headers. 
            // If we just parsed JSON, row 0 is headers.
            // We might need to pad it or adjust the logic.
            // Let's just pad it with empty rows to match the "Excel" structure expected by the Agent logic if we want to reuse it exactly.
            rawData = [[], [], headers, ...rows];
        }
    } else {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    }

    if (rawData.length < 1) { // Relaxed check
        throw new Error('File too short to be a valid dataset');
    }

    // Extract headers
    // If it was JSON/CSV with simple structure, headers might be at 0.
    // If it was our Excel template, headers might be at 2.
    // We can try to detect "Date" or "Phase" or similar keywords.

    let headerRowIndex = 0;
    const knownHeaders = ['Date', 'Phase', 'Cycle', 'Scheme', 'Event', 'Metric'];

    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i];
        if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && knownHeaders.some(h => cell.includes(h)))) {
            headerRowIndex = i;
            break;
        }
        // Fallback for JSON padding we added: if row is empty, skip. 
        // If we find a row with string keys that look like headers.
    }

    // If we padded JSON, we know where it is (index 2), but the loop above should find it too.

    const potentialHeaders = rawData[headerRowIndex] as string[];

    console.log('Potential Headers:', potentialHeaders);

    // Call Agent to map columns
    const mappingResult = await runIngestionAgent('map_columns', { headers: potentialHeaders });

    console.log('Mapping Result:', mappingResult);

    // Construct FormalDataset
    // We start from headerRowIndex + 1
    const formalDataset = rawData.slice(headerRowIndex + 1).map((row, idx) => {
        const obj: any = {};
        row.forEach((cell: any, i: number) => {
            const key = potentialHeaders[i] || `Unnamed: ${i}`;
            obj[key] = cell;
        });
        return obj;
    });

    return {
        dataset: { FormalDataset: formalDataset },
        mapping: mappingResult
    };
}
