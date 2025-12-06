import fs from 'fs';
import path from 'path';
import { DATA_ROOT } from '@/lib/storage-helper';

// Define return type matching the previous simplified structure or loose for now
export type FileMeta = {
    name: string;
    created_at: string;
};

/**
 * Lists available data files for a patient from local storage.
 */
export async function listFiles(patientId: string): Promise<FileMeta[]> {
    try {
        const patientDir = path.join(DATA_ROOT, patientId);
        if (!fs.existsSync(patientDir)) {
            return [];
        }

        const files = fs.readdirSync(patientDir)
            .filter(file => file.endsWith('.xlsx'))
            .map(file => ({
                name: file,
                created_at: fs.statSync(path.join(patientDir, file)).birthtime.toISOString()
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return files;
    } catch (error) {
        console.error("Error listing files:", error);
        return [];
    }
}

import { FormalDataset } from '@/lib/types';

// ... (existing imports)

/**
 * Loads the most recent Excel dataset for a patient from local storage.
 * If no patientId is provided, it returns an empty dataset object.
 */
export async function loadDataset(patientId?: string): Promise<FormalDataset> {
    const emptyResult: FormalDataset = { FormalDataset: [], patientName: '' };
    try {
        if (!patientId) {
            console.warn("[DataLoader] No patientId provided. Returning empty dataset.");
            return emptyResult;
        }

        const files = await listFiles(patientId);
        if (files.length === 0) {
            return emptyResult;
        }

        // Return placeholder object matching FormalDataset interface
        // Real parsing would happen here or in ingestion service
        return {
            FormalDataset: [],
            patientName: patientId // fallback logic
        };
    } catch (error) {
        console.error("Local loadDataset error:", error);
        return emptyResult;
    }
}
