/**
 * Mock Auth Helper
 * 
 * In the local desktop version, we bypass Supabase Auth and strictly return
 * a hardcoded "Administrator" (Doctor) user.
 * 
 * This treats the local user as the owner of the device.
 */

export const MOCK_USER_ID = 'local-admin-doctor';

export async function getCurrentUser() {
    return {
        id: MOCK_USER_ID,
        email: 'doctor@local.oncotracker',
        user_metadata: {
            role: 'doctor',
            full_name: 'Local Administrator'
        },
        role: 'authenticated'
    };
}

export async function protectRoute() {
    // Always allowed in local desktop mode
    return true;
}
