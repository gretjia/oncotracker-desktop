import { loadDataset } from '../lib/data-loader';
import path from 'path';

async function verify() {
    try {
        console.log("Loading dataset...");
        const data = await loadDataset();
        console.log("Dataset loaded.");

        if (!data.FormalDataset || data.FormalDataset.length === 0) {
            console.error("ERROR: FormalDataset is empty or undefined.");
            return;
        }

        console.log(`Total Rows: ${data.FormalDataset.length}`);
        console.log("First 5 rows:");
        console.log(JSON.stringify(data.FormalDataset.slice(0, 5), null, 2));

        // Check for expected columns in the header row (index 3 based on previous code)
        const headerRow = data.FormalDataset[3];
        console.log("Header Row (Index 3):", headerRow);

    } catch (error) {
        console.error("Verification Failed:", error);
    }
}

verify();
