
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
const filePath = path.join(dataDir, '高玉修.xlsx');

console.log('Reading file:', filePath);

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Total Rows:', rawData.length);

// Smart Header Detection
let headerRowIndex = 0;
const knownKeywords = ['Date', 'Phase', 'Cycle', 'Scheme', 'Event', 'Time', '日期', '阶段', '周期'];

for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    const row = rawData[i];
    if (Array.isArray(row) && row.some(cell =>
        typeof cell === 'string' && knownKeywords.some(k => cell.toLowerCase().includes(k.toLowerCase()))
    )) {
        headerRowIndex = i;
        break;
    }
}

console.log('Detected Header Row Index:', headerRowIndex);

const headers = rawData[headerRowIndex];
console.log('Headers:', JSON.stringify(headers));

console.log('All Rows:');
rawData.forEach((row, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row));
});
