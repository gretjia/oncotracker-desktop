import fs from 'fs';
import path from 'path';

// In production (Electron), process.cwd() is .../resources
// In dev, it is the project root.
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function uploadFile(
    subfolder: string, // e.g., 'patient-data'
    filename: string,
    buffer: Buffer
): Promise<{ path: string; error?: string }> {
    try {
        const folderPath = path.join(DATA_DIR, subfolder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const filePath = path.join(folderPath, filename);
        await fs.promises.writeFile(filePath, buffer);

        return { path: filePath };
    } catch (err: any) {
        console.error('Local storage write failed:', err);
        return { path: '', error: err.message };
    }
}

export async function deleteFile(subfolder: string, filename: string) {
    try {
        const filePath = path.join(DATA_DIR, subfolder, filename);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
