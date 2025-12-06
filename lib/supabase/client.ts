import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    // Create a full URL for the proxy (e.g. https://site.com/supabase)
    // Supabase client requires a valid URL string, not a relative path.
    const supabaseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/supabase`
        : process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return createBrowserClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
