'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getPatientSettings(patientId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from('patient_journey_settings')
        .select('settings')
        .eq('user_id', user.id)
        .eq('patient_id', patientId)
        .single();

    if (error) {
        // It's okay if no settings found, just return null
        if (error.code !== 'PGRST116') {
            console.error('Error fetching settings:', error);
        }
        return null;
    }

    return data?.settings || null;
}

export async function savePatientSettings(patientId: string, settings: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('patient_journey_settings')
        .upsert({
            user_id: user.id,
            patient_id: patientId,
            settings: settings,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,patient_id'
        });

    if (error) {
        console.error('Error saving settings:', error);
        throw new Error('Failed to save settings');
    }

    // Optional: Revalidate if needed, but client state is already updated
    // revalidatePath(`/journey`);
}
