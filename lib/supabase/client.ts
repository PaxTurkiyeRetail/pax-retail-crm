import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from '@/lib/supabase/config';

export function createSupabaseBrowserClient() {
  const { url, anon } = getSupabasePublicEnv();
  return createBrowserClient(url, anon);
}
