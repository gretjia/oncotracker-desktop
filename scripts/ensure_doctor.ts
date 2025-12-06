import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureDoctor(email: string) {
    console.log(`Checking doctor record for ${email}...`);

    // 1. Get User ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error(`User ${email} not found in auth.users`);
        return;
    }

    console.log(`Found user ${email} with ID: ${user.id}`);

    // 2. Check Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Try to create profile if missing?
    } else {
        console.log('Profile found:', profile);
    }

    // 3. Check Doctor Record
    const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', user.id)
        .single();

    if (doctorError && doctorError.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
        console.error('Error fetching doctor record:', doctorError);
        return;
    }

    if (doctor) {
        console.log('Doctor record already exists:', doctor);
    } else {
        console.log('Doctor record missing. Creating...');
        const { error: insertError } = await supabase
            .from('doctors')
            .insert({
                id: user.id,
                specialty: 'Oncology', // Default
                license_number: 'PENDING' // Default
            });

        if (insertError) {
            console.error('Error creating doctor record:', insertError);
        } else {
            console.log('Successfully created doctor record.');
        }
    }
}

// Run for the specific doctor
ensureDoctor('scix@oncotracker.com');
