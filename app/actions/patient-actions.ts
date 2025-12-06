'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import pinyin from 'pinyin';
import { getCurrentUser, MOCK_USER_ID } from '@/lib/auth-helper';
import { uploadFile, deleteFile } from '@/lib/storage-helper';
import { randomUUID } from 'crypto';

// -----------------------------------------------------------------------------
// Action: Create Patient
// -----------------------------------------------------------------------------
export async function createPatientAction(formData: FormData) {
    const fullName = formData.get('fullName') as string;

    if (!fullName) {
        return { success: false, error: 'Missing required fields' };
    }

    // 1. Generate MRN
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const mrn = `MRN-${dateStr}-${randomSuffix}`;

    // 2. Generate Email (LegacyID for local mode)
    const email = `patient+${mrn.toLowerCase().replace(/[^a-z0-9]/g, '')}@oncotracker.com`;

    try {
        // 3. Get current doctor (Local Admin)
        const doctorUser = await getCurrentUser();

        // Ensure Doctor profile exists (Idempotent)
        await prisma.profile.upsert({
            where: { id: doctorUser.id },
            update: {},
            create: {
                id: doctorUser.id,
                email: doctorUser.email,
                role: 'doctor',
                full_name: doctorUser.user_metadata.full_name,
                is_approved: true
            }
        });

        // Ensure Doctor record exists
        await prisma.doctor.upsert({
            where: { id: doctorUser.id },
            update: {},
            create: {
                id: doctorUser.id,
                specialty: 'Oncology'
            }
        });

        // 4. Create Patient
        const newPatientId = randomUUID();

        // Create Profile
        await prisma.profile.create({
            data: {
                id: newPatientId,
                email: email,
                role: 'patient',
                full_name: fullName,
                is_approved: true
            }
        });

        // Create Patient Record
        await prisma.patient.create({
            data: {
                id: newPatientId,
                mrn,
                assigned_doctor_id: doctorUser.id
            }
        });

        // 5. Process Dataset
        const datasetFile = formData.get('dataset') as File;
        const mappingStr = formData.get('mapping') as string;
        const useTemplate = formData.get('useTemplate') === 'true';
        const mappingData = mappingStr ? JSON.parse(mappingStr) : null;
        const isCanonical = mappingData?.isCanonical === true;
        const mapping = isCanonical ? null : mappingData?.mapping || mappingData;

        if (useTemplate) {
            try {
                const headers = generateCanonicalHeaders(DEFAULT_TEMPLATE_METRICS);
                headers[0][0] = `${fullName} - 肿瘤病程周期表`;
                const fileName = `${newPatientId}.xlsx`;
                console.log('Generating empty template for:', fullName);
                const xlsxBuffer = writeCanonicalXLSX(headers);

                await uploadFile('patient-data', fileName, xlsxBuffer);
            } catch (err) {
                console.error('Failed to generate template:', err);
            }
        } else if (datasetFile && datasetFile.size > 0) {
            try {
                await processAndSaveDataset(
                    datasetFile,
                    newPatientId,
                    mapping,
                    fullName,
                    isCanonical
                );
            } catch (err) {
                console.error('Failed to process dataset:', err);
            }
        }

        revalidatePath('/dashboard/doctor');
        return { success: true };

    } catch (error: any) {
        console.error('Unexpected Error:', error);
        return { success: false, error: error.message };
    }
}

// -----------------------------------------------------------------------------
// Action: Delete Patient
// -----------------------------------------------------------------------------
export async function deletePatientAction(patientId: string) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return { success: false, error: 'Unauthorized' };

        await prisma.profile.delete({
            where: { id: patientId }
        });

        revalidatePath('/dashboard/doctor');
        return { success: true };

    } catch (error: any) {
        console.error('Delete Patient Error:', error);
        return { success: false, error: error.message };
    }
}

// -----------------------------------------------------------------------------
// Helper: Process Dataset (Refactored)
// -----------------------------------------------------------------------------
import * as XLSX from 'xlsx';
import {
    transformToCanonicalFormat,
    validateCanonicalData,
    writeCanonicalXLSX,
    generateCanonicalHeaders,
    TransformResult
} from '@/lib/schema/data-transformer';
import { SCHEMA_VERSION, ROW_INDICES, FIXED_COLUMNS, DEFAULT_TEMPLATE_METRICS } from '@/lib/schema/oncology-dataset.schema';
import { getCanonicalMetricName, lookupMetric, isKnownMetric } from '@/lib/schema/metric-dictionary';

function detectCanonicalFormat(headers: any[], unitsRow: any[]): boolean {
    if (!Array.isArray(headers) || headers.length < 10) return false;
    const hasDateHeader = headers[0] === '子类';
    const hasPhaseHeader = headers[1] === '项目';
    const hasCycleHeader = headers[2] === '周期';
    const hasSchemeHeader = headers[4] === '方案';
    const hasEventHeader = headers[5] === '处置';
    const hasSchemeDetail = headers[6] === '方案';
    const canonicalMetrics = ['Weight', 'Handgrip', 'ECOG', 'MRD', 'aMRD', 'CEA', 'HE4',
        'CA19-9', 'CA125', 'CA724', 'AFP', '肺', '肝脏', '淋巴', '盆腔',
        '白细胞', '血小板', '中性粒细胞', '谷草转氨酶', '谷丙转氨酶',
        'ROMA绝经后指数', 'ROMA绝经前指数'];
    const invalidHeaders = ['Lab Result', 'Tumor Burden', 'Tumor Size', 'Performance Status',
        '体重', '握力', 'Date', 'Phase', 'Cycle', 'Scheme', 'Event'];
    const hasInvalidHeaders = headers.some(h => h && invalidHeaders.includes(h));
    let metricCount = 0;
    headers.forEach(h => { if (h && canonicalMetrics.includes(h)) metricCount++; });
    const hasUnitsRowIndicator = unitsRow && (
        unitsRow[0] === '日期\\单位' ||
        (unitsRow[2] === '当下周期' && unitsRow[3] === '前序周期')
    );
    const fixedColScore = [hasDateHeader, hasPhaseHeader, hasCycleHeader, hasSchemeHeader, hasEventHeader, hasSchemeDetail]
        .filter(Boolean).length;
    return fixedColScore >= 4 && metricCount >= 5 && !hasInvalidHeaders && hasUnitsRowIndicator;
}

async function processAndSaveDataset(
    file: File,
    patientId: string,
    mapping: any,
    patientName: string,
    isAlreadyCanonical: boolean = false
) {
    const buffer = await file.arrayBuffer();
    let rawData: any[][] = [];

    if (file.name.endsWith('.json')) {
        const text = new TextDecoder().decode(buffer);
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
            rawData = json;
        } else {
            rawData = [json];
        }
        if (rawData.length > 0 && typeof rawData[0] === 'object') {
            const headers = Object.keys(rawData[0]);
            const rows = rawData.map((obj: any) => headers.map(h => obj[h]));
            rawData = [[], [], headers, ...rows];
        }
    } else {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    }

    let observations: any[] = [];
    let canonicalData: any[][] = [];

    if (isAlreadyCanonical) {
        let headerRowIdx = 2;
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
            const row = rawData[i];
            if (row && row[0] === '子类' && row[1] === '项目') { headerRowIdx = i; break; }
        }
        canonicalData = rawData;

        let actualHeaderRowIdx = canonicalData.findIndex(row => row && row[0] === '子类');
        if (actualHeaderRowIdx < 0) {
            actualHeaderRowIdx = canonicalData.findIndex(row => row && (row.includes('Weight') || row.includes('CEA')));
        }

        if (actualHeaderRowIdx >= 0) {
            const headerRow = canonicalData[actualHeaderRowIdx];
            for (let i = actualHeaderRowIdx + 2; i < canonicalData.length; i++) {
                const row = canonicalData[i];
                const dateVal = row[0];
                if (!dateVal) continue;

                let dateStr = '';
                try {
                    const date = typeof dateVal === 'number' ? new Date(Math.round((dateVal - 25569) * 86400 * 1000)) : new Date(dateVal);
                    if (!isNaN(date.getTime())) dateStr = date.toISOString();
                } catch (e) { }
                if (!dateStr) continue;

                for (let j = 7; j < Math.min(row.length, headerRow.length); j++) {
                    const metricName = headerRow[j];
                    const value = row[j];
                    if (!metricName || value === undefined || value === null || value === '') continue;
                    const metricDef = lookupMetric(metricName);

                    // Helper to safely parse number
                    const parseVal = (v: any) => {
                        if (typeof v === 'number') return v;
                        const f = parseFloat(v);
                        return isNaN(f) ? null : f;
                    };

                    observations.push({
                        patient_id: patientId,
                        effective_datetime: dateStr,
                        category: metricDef?.category === 'MOLECULAR' ? 'tumor-marker' : 'laboratory',
                        code: getCanonicalMetricName(metricName),
                        code_display: metricDef?.chinese || metricName,
                        status: 'final',
                        value_quantity: parseVal(value),
                        value_string: typeof value === 'string' ? value : String(value)
                    });
                }
            }
        }

    } else if (mapping) {
        const transformResult = transformToCanonicalFormat(rawData, {
            date_col: mapping.date_col,
            date_col_index: mapping.date_col_index,
            metrics: mapping.metrics || {},
            events: mapping.events || [],
        }, { patientName });

        if (!transformResult.success) throw new Error('Transform failed: ' + transformResult.errors.join(', '));
        canonicalData = transformResult.data;

        for (let i = ROW_INDICES.DATA_START; i < canonicalData.length; i++) {
            const row = canonicalData[i];
            const dateVal = row[FIXED_COLUMNS.DATE];
            if (!dateVal) continue;
            let dateStr = '';
            try {
                dateStr = typeof dateVal === 'number' ? new Date(Math.round((dateVal - 25569) * 86400 * 1000)).toISOString() : new Date(dateVal).toISOString();
            } catch (e) { continue; }

            const headerRow = canonicalData[ROW_INDICES.HEADERS];
            for (let j = FIXED_COLUMNS.SCHEME_DETAIL + 1; j < row.length; j++) {
                const metricName = headerRow[j];
                const value = row[j];
                if (!metricName || value === undefined || value === null || value === '') continue;
                const metricDef = lookupMetric(metricName);

                const parseVal = (v: any) => {
                    if (typeof v === 'number') return v;
                    const f = parseFloat(v);
                    return isNaN(f) ? null : f;
                };

                observations.push({
                    patient_id: patientId,
                    effective_datetime: dateStr,
                    category: metricDef?.category === 'MOLECULAR' ? 'tumor-marker' : 'laboratory',
                    code: getCanonicalMetricName(metricName),
                    code_display: metricDef?.chinese || metricName,
                    status: 'final',
                    value_quantity: parseVal(value),
                    value_string: typeof value === 'string' ? value : String(value)
                });
            }
        }
    } else {
        if (detectCanonicalFormat(rawData[ROW_INDICES.HEADERS], rawData[ROW_INDICES.UNITS])) {
            canonicalData = rawData;
        }
    }

    if (observations.length > 0) {
        // Prepare data for Prisma
        // Using 'any' cast to bypass strict typing until schema is updated in Step 2
        await (prisma as any).observation.createMany({
            data: observations.map((o: any) => ({
                id: randomUUID(),
                patient_id: o.patient_id,
                effective_datetime: new Date(o.effective_datetime),
                category: o.category,
                code: o.code,
                code_display: o.code_display,
                status: o.status || 'final',
                value_quantity: o.value_quantity,
                value_string: o.value_string,
                // created_at defaults to now()
            }))
        });
    }

    // 4. Save File to Local Storage
    const fileName = `${patientId}.xlsx`;
    let fileBufferToUpload: Buffer;

    if (canonicalData.length > 0) {
        fileBufferToUpload = writeCanonicalXLSX(canonicalData);
    } else {
        throw new Error('Data transformation failed: No canonical data to save');
    }

    await uploadFile('patient-data', fileName, fileBufferToUpload);
}


// -----------------------------------------------------------------------------
// Action: Parse Upload (Standalone)
// -----------------------------------------------------------------------------
import { analyzeStructure } from '@/lib/llm/qwen';

export async function parseAndMapUpload(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error('No file uploaded');

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rawData.length === 0) throw new Error('Empty file');

        let headerRowIndex = 0;
        const metricHeaders = ['Weight', 'Handgrip', 'CEA', 'MRD', 'AFP', '白细胞'];
        const fixedHeaders = ['子类', '项目', '周期'];
        const unitPatterns = ['日期\\单位', 'KG', '<', 'mm'];

        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i];
            if (!Array.isArray(row) || row.length < 5) continue;
            const rowStr = row.join(' ');
            const hasMetricHeaders = metricHeaders.some(m => rowStr.includes(m));
            const hasFixedHeaders = fixedHeaders.filter(f => rowStr.includes(f)).length >= 2;
            const looksLikeUnits = unitPatterns.filter(u => rowStr.includes(u)).length >= 2;

            if ((hasMetricHeaders || hasFixedHeaders) && !looksLikeUnits) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = rawData[headerRowIndex];
        const unitsRow = rawData[headerRowIndex + 1];
        const samples = rawData.slice(headerRowIndex + 2, headerRowIndex + 5);

        const isCanonical = detectCanonicalFormat(headers, unitsRow);
        if (isCanonical) {
            return {
                success: true,
                isCanonical: true,
                headerRowIndex,
                mapping: null,
                headers,
                samples
            };
        }

        const mapping = await analyzeStructure(headers, samples);
        return { success: true, isCanonical: false, mapping, headers, samples };
    } catch (error: any) {
        console.error('Parse Error:', error);
        return { success: false, error: error.message };
    }
}
