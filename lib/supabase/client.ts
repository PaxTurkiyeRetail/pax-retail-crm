import { createPgSupabaseClient } from '@/lib/supabase/pg-client';

export function createSupabaseBrowserClient() {
  return createPgSupabaseClient();
}
