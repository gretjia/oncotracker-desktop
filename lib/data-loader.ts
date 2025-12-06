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

/**
 * Loads the most recent Excel dataset for a patient from local storage.
 * If no patientId is provided, it returns an empty array as we enforce patient context in Desktop.
 */
export async function loadDataset(patientId?: string): Promise<any[]> {
    try {
        if (!patientId) {
            console.warn("[DataLoader] No patientId provided. Returning empty dataset.");
            return [];
        }

        const files = await listFiles(patientId);
        if (files.length === 0) {
            return [];
        }

        // Return empty array as placeholder.
        // The actual spreadsheet parsing logic is handed off to the frontend/ingestion agent in this architecture.
        // This function exists mainly to satisfy the API contract of /api/data/current
        return [];
    } catch (error) {
        console.error("Local loadDataset error:", error);
        return [];
    }
}
