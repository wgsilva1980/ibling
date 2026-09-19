import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

export function createSupabaseClientBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}
