import { createPgSupabaseClient } from '@/lib/supabase/pg-client';

export function createSupabaseAdminClient() {
  return createPgSupabaseClient();
}
