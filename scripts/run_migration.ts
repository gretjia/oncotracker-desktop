import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const MIGRATION_FILE = path.resolve(__dirname, '../supabase/migrations/20251201_fix_recursion.sql');

async function runMigration() {
    console.log(`Connecting to ${DB_URL}...`);
    const client = new Client({ connectionString: DB_URL });

    try {
        await client.connect();
        console.log('Connected.');

        const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
        console.log(`Running migration from ${MIGRATION_FILE}...`);

        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
