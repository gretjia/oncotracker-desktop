import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { FormalDataset } from './types';
import { createClient } from '@supabase/supabase-js';

// Admin client for reading user metadata
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Loads dataset for a specific patient by ID, or falls back to newest file
 * @param patientId - Optional patient ID to load specific patient's data
 */
export async function loadDataset(patientId?: string): Promise<FormalDataset> {
    // const dataDir = path.resolve(process.cwd(), 'data');
    let xlsxFile: string | null = null;
    let patientName: string | null = null;
    let fileBuffer: Buffer | null = null;

    // List all files in the bucket once
    const { data: fileList, error: listError } = await supabaseAdmin
        .storage
        .from('patient-data')
        .list();

    if (listError || !fileList) {
        console.error('[data-loader] Error listing files from storage:', listError);
        throw new Error('Failed to list patient data files');
    }

    // 1. Try loading by patientId (New Standard)
    if (patientId) {
        const idFilename = `${patientId}.xlsx`;
        const foundById = fileList.find(f => f.name === idFilename);
        if (foundById) {
            xlsxFile = foundById.name;
            console.log(`[data-loader] Found patient file by ID: ${xlsxFile}`);

            // Fetch patient name for return value if not already set
            if (!patientName) {
                const { data: patient } = await supabaseAdmin
                    .from('patients')
                    .select('family_name, given_name')
                    .eq('id', patientId)
                    .single();
                if (patient) {
                    patientName = `${patient.family_name}${patient.given_name}`;
                }
            }
        }
    }

    // 2. Fallback: Look up by name (Legacy)
    if (!xlsxFile && patientId) {
        try {
            // First, get the original full name from auth.users (stored in user_metadata)
            const { data: authData } = await supabaseAdmin.auth.admin.getUserById(patientId);
            const originalFullName = authData?.user?.user_metadata?.full_name;

            // Also get patient record for fallback
            const { data: patient } = await supabaseAdmin
                .from('patients')
                .select('family_name, given_name')
                .eq('id', patientId)
                .single();

            // Build list of possible file names to check
            const possibleNames: string[] = [];

            // Priority 1: Original full name (Chinese characters like "高玉修")
            if (originalFullName) {
                possibleNames.push(originalFullName);
                // Also try with underscores replacing special chars
                possibleNames.push(originalFullName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_'));
            }

            // Priority 2: Pinyin combinations from patient record
            if (patient) {
                possibleNames.push(
                    `${patient.family_name}${patient.given_name}`,
                    `${patient.given_name}${patient.family_name}`,
                    `${patient.family_name}_${patient.given_name}`,
                    `${patient.given_name} ${patient.family_name}`,
                );
            }

            // Try each possible name
            for (const name of possibleNames) {
                if (!name) continue;
                const targetName = `${name}.xlsx`;
                const foundFile = fileList.find(f => f.name === targetName);

                if (foundFile) {
                    xlsxFile = foundFile.name;
                    patientName = name;
                    console.log(`[data-loader] Found patient file by Name (Legacy): ${xlsxFile}`);
                    break;
                }
            }

            // Fallback: search for files containing any part of the name
            if (!xlsxFile && (originalFullName || patient)) {
                const searchTerms = [originalFullName, patient?.family_name, patient?.given_name].filter(Boolean);

                for (const file of fileList) {
                    if (!file.name.endsWith('.xlsx')) continue;
                    const baseName = path.parse(file.name).name;
                    if (searchTerms.some(term => term && baseName.includes(term))) {
                        xlsxFile = file.name;
                        patientName = baseName;
                        console.log(`[data-loader] Found patient file by partial match in storage: ${xlsxFile}`);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('[data-loader] Error looking up patient:', error);
        }
    }

    // Fallback: Find newest .xlsx file if no specific patient found
    if (!xlsxFile) {
        const sortedFiles = fileList
            .filter(f => f.name.endsWith('.xlsx'))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (sortedFiles.length > 0) {
            xlsxFile = sortedFiles[0].name;
            // patientName = path.parse(xlsxFile).name; // Don't overwrite if we have better info
            console.log(`[data-loader] Fallback to newest file in storage: ${xlsxFile}`);
        }
    }

    if (!xlsxFile) {
        throw new Error(`No .xlsx dataset file found in storage`);
    }

    // Download file content
    const { data: fileData, error: downloadError } = await supabaseAdmin
        .storage
        .from('patient-data')
        .download(xlsxFile);

    if (downloadError || !fileData) {
        throw new Error(`Failed to download file ${xlsxFile}: ${downloadError?.message}`);
    }

    // Convert Blob/File to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);

    // const filePath = path.join(dataDir, xlsxFile);
    // const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with raw values (defval: null ensures empty cells are present if needed, but "Unnamed" keys come from header: A)
    // Actually, the HTML expects "Unnamed: 0", etc. This usually happens when pandas reads without a header.
    // We need to emulate this structure.

    // Convert to JSON with raw values (defval: null ensures empty cells are present if needed)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    // DEBUG: Log to file since console.log might be swallowed
    const logPath = path.join(process.cwd(), 'debug-log.txt');
    const log = (msg: string) => {
        try {
            fs.appendFileSync(logPath, `[DataLoader] ${msg}\n`);
        } catch (e) {
            // ignore
        }
    };

    log(`Loading dataset for patient...`);
    log(`Raw Data Preview (First 5 rows):`);
    rawData.slice(0, 5).forEach((r, i) => log(`Row ${i}: ${JSON.stringify(r)}`));

    // Find the header row
    // Strategy:
    // 1. Look for canonical headers "子类" and "项目" (Strongest signal)
    // 2. Look for category headers "分类" and "节拍" (Row 1)
    // 3. Look for known metric names (Weight, CEA, etc.) as a fallback
    let headerRowIndex = -1;

    const knownMetrics = ['Weight', 'CEA', 'MRD', 'AFP', 'CA19-9', 'CYFRA21-1', '细胞角蛋白19片段'];

    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        // Check for canonical headers
        if (row.includes('子类') && row.includes('项目')) {
            log(`Found canonical headers at row ${i}`);
            headerRowIndex = i;
            break;
        }

        // Check for category headers
        if (row.includes('分类') && row.includes('节拍')) {
            log(`Found category headers at row ${i}`);
            // If we find categories, the next row is likely headers
            if (rawData[i + 1] && rawData[i + 1].includes('子类')) {
                headerRowIndex = i + 1;
                break;
            }
            // If next row doesn't have "子类", maybe it has metrics?
            headerRowIndex = i + 1;
            break;
        }

        // Fallback: Check for multiple known metrics
        const metricCount = knownMetrics.filter(m => row.includes(m)).length;
        if (metricCount >= 2) {
            log(`Found known metrics at row ${i} (Count: ${metricCount})`);
            headerRowIndex = i;
            break;
        }
    }

    // Default to 0 if not found (legacy behavior, but risky)
    if (headerRowIndex === -1) {
        log('WARNING: No header row found, defaulting to 0');
        headerRowIndex = 0;
    }

    log(`Final Header Row Index: ${headerRowIndex}`);
    log(`Detected Headers: ${JSON.stringify(rawData[headerRowIndex])}`);

    // If no canonical header found, just return raw data starting from row 0
    // The visualizer might fail, but at least we return data

    // Map data to "Unnamed: X" format expected by the frontend/visualizer
    const mappedData = rawData.slice(headerRowIndex).map((row: any[]) => {
        const newRow: any = {};
        row.forEach((cell, index) => {
            newRow[`Unnamed: ${index}`] = cell;
        });
        return newRow;
    });

    return { FormalDataset: mappedData, patientName: patientName || undefined };
}
