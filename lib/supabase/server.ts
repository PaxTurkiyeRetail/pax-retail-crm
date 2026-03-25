import { createPgSupabaseClient } from '@/lib/supabase/pg-client';

export async function createSupabaseServerClient() {
  return createPgSupabaseClient();
}
