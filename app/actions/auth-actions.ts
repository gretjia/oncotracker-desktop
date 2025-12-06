'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function loginAction(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role || 'patient';

    revalidatePath('/', 'layout');

    if (role === 'doctor') {
        redirect('/dashboard/doctor');
    } else if (role === 'supervisor') {
        redirect('/dashboard/supervisor');
    } else {
        redirect('/dashboard/patient');
    }
}

export async function logoutAction() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/auth/login');
}
