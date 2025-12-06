
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

console.log('Using Supabase Key:', supabaseKey.substring(0, 10) + '...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
    const excelPath = path.resolve(process.cwd(), '../dataset251130_3.xlsx');

    if (!fs.existsSync(excelPath)) {
        console.error(`Excel file not found at: ${excelPath}`);
        process.exit(1);
    }

    console.log(`Reading Excel file: ${excelPath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('Worksheets found:', workbook.worksheets.map(w => w.name));
    const worksheet = workbook.worksheets[0]; // Access first sheet directly

    if (!worksheet) {
        console.error("Could not find the first worksheet.");
        process.exit(1);
    }

    console.log('Clearing existing data...');
    // Delete in reverse order of dependencies
    await supabase.from('observations').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    await supabase.from('conditions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('patients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('Creating Patient...');
    const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
            mrn: 'P001', // Dummy MRN
            family_name: 'Unknown',
            given_name: 'Patient',
            date_of_birth: '1970-01-01', // Dummy DOB
            biological_sex: 'unknown',
            country: 'China'
        })
        .select()
        .single();

    if (patientError) {
        console.error('Error creating patient:', patientError);
        process.exit(1);
    }

    console.log(`Created Patient: ${patient.id}`);

    console.log('Creating Condition...');
    const { error: conditionError } = await supabase
        .from('conditions')
        .insert({
            patient_id: patient.id,
            condition_type: 'primary',
            clinical_status: 'active',
            diagnosis_code: 'C16', // ICD-10 for Gastric Cancer (Example)
            diagnosis_display: 'Gastric Cancer',
            date_of_diagnosis: '2024-01-01' // Dummy date
        });

    if (conditionError) {
        console.error('Error creating condition:', conditionError);
    }

    console.log('Processing Observations...');

    // Header Mapping (based on known structure or inspecting row 7/8)
    // Row 7 (1-based) usually has headers: Date, Phase, ..., Weight, CEA, CA19-9, etc.
    // Let's assume a mapping based on typical columns. 
    // We need to find which column is which.

    let headerRowIndex = 7; // Based on previous knowledge (Row 6 in 0-indexed pandas is Row 7 here)
    let headers: { [key: number]: string } = {};

    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value?.toString().trim();
        if (val) headers[colNumber] = val;
    });

    // If headers are empty, try row 6 or 8
    if (Object.keys(headers).length === 0) {
        console.log("Header row 7 empty, trying row 6...");
        headerRowIndex = 6;
        const headerRow2 = worksheet.getRow(headerRowIndex);
        headerRow2.eachCell((cell, colNumber) => {
            const val = cell.value?.toString().trim();
            if (val) headers[colNumber] = val;
        });
    }

    console.log('Headers found:', headers);

    // Identify key columns
    let dateCol = -1;
    let weightCol = -1;
    let ceaCol = -1;
    let ca199Col = -1;
    let ca125Col = -1;
    let ca724Col = -1;
    let afpCol = -1;
    let eventCol = -1; // Usually "Event" or similar

    for (const [col, name] of Object.entries(headers)) {
        const n = name.toLowerCase();
        const c = parseInt(col);
        if (n.includes('date') || n.includes('日期')) dateCol = c;
        if (n.includes('weight') || n.includes('体重')) weightCol = c;
        if (n.includes('cea')) ceaCol = c;
        if (n.includes('ca19-9') || n.includes('ca199')) ca199Col = c;
        if (n.includes('ca125')) ca125Col = c;
        if (n.includes('ca72-4') || n.includes('ca724')) ca724Col = c;
        if (n.includes('afp')) afpCol = c;
        if (n.includes('event') || n.includes('项目')) eventCol = c;
    }

    // Fallback if headers aren't clear (using typical indices from previous analysis)
    // Date is usually col 1 (A), Phase col 2 (B)...
    // Let's rely on the iteration.

    // Define Observation Interface
    interface Observation {
        patient_id: string;
        effective_datetime: string;
        category: 'laboratory' | 'vital-signs' | 'imaging' | 'tumor-marker' | 'procedure' | 'event';
        code: string;
        code_display: string;
        status: 'final';
        value_quantity?: number;
        value_unit?: string;
        value_string?: string;
    }

    const observations: Observation[] = [];

    // Iterate data rows
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex + 1) return; // Skip headers and units

        // Get Date
        // Try col 1 if dateCol not found
        const dateCell = row.getCell(dateCol !== -1 ? dateCol : 1);
        let dateVal = dateCell.value;

        if (!dateVal) return; // Skip empty rows

        let effectiveDate: string;
        if (dateVal instanceof Date) {
            effectiveDate = dateVal.toISOString();
        } else {
            // Try parsing string
            try {
                effectiveDate = new Date(dateVal.toString()).toISOString();
            } catch (e) {
                return; // Invalid date
            }
        }

        // Helper to add observation
        const addObs = (col: number, code: string, display: string, category: 'tumor-marker' | 'vital-signs' | 'laboratory') => {
            if (col === -1) return;
            const cell = row.getCell(col);
            const val = cell.value;
            if (val !== null && val !== undefined && val !== '') {
                // Check if it's a number
                const numVal = parseFloat(val.toString());
                if (!isNaN(numVal)) {
                    observations.push({
                        patient_id: patient.id,
                        effective_datetime: effectiveDate,
                        category: category,
                        code: code,
                        code_display: display,
                        status: 'final',
                        value_quantity: numVal,
                        value_unit: display === 'Body Weight' ? 'kg' : 'U/mL' // Check display name instead of category
                    });
                } else {
                    // String value (e.g. "<35")
                    observations.push({
                        patient_id: patient.id,
                        effective_datetime: effectiveDate,
                        category: category,
                        code: code,
                        code_display: display,
                        status: 'final',
                        value_string: val.toString()
                    });
                }
            }
        };

        addObs(weightCol !== -1 ? weightCol : 8, '29463-7', 'Body Weight', 'vital-signs'); // Col 8 is typical for weight
        addObs(ceaCol !== -1 ? ceaCol : 13, '19146-0', 'CEA', 'tumor-marker');
        addObs(ca199Col !== -1 ? ca199Col : 14, '24108-3', 'CA 19-9', 'tumor-marker');
        addObs(ca724Col !== -1 ? ca724Col : 15, 'CA72-4', 'CA 72-4', 'tumor-marker');
        addObs(afpCol !== -1 ? afpCol : 16, '1834-1', 'AFP', 'tumor-marker');

        // Events
        const eventCell = row.getCell(eventCol !== -1 ? eventCol : 6); // Col 6 typical for events
        const eventVal = eventCell.value;
        if (eventVal) {
            observations.push({
                patient_id: patient.id,
                effective_datetime: effectiveDate,
                category: 'event',
                code: 'EVENT',
                code_display: eventVal.toString(),
                status: 'final',
                value_string: eventVal.toString()
            });
        }
    });

    console.log(`Found ${observations.length} observations. Inserting...`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < observations.length; i += batchSize) {
        const batch = observations.slice(i, i + batchSize);
        const { error } = await supabase.from('observations').insert(batch);
        if (error) {
            console.error('Error inserting batch:', error);
        } else {
            process.stdout.write('.');
        }
    }
    console.log('\nData migration complete!');
}

seedData().catch(console.error);
