import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key');
    console.log('Using Supabase URL:', supabaseUrl);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function resetPassword() {
    const email = 'scix@oncotracker.com';
    const newPassword = 'Zx987@';

    console.log(`Resetting password for ${email}...`);

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    console.log('Found users:', users.map(u => u.email));
    const user = users.find(u => u.email === email);

    if (!user) {
        console.log('User not found in list. Attempting to create...');
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: newPassword,
            email_confirm: true,
            user_metadata: { full_name: 'SciX', role: 'doctor' }
        });

        if (error) {
            console.error('Error creating user:', error);
        } else {
            console.log('User created successfully:', data.user.id);
        }
        return;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    );

    if (error) {
        console.error('Error updating password:', error);
    } else {
        console.log('Password updated successfully for user:', data.user.id);
    }
}

resetPassword();
