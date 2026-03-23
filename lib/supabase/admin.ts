import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleEnv } from '@/lib/supabase/config';

export function createSupabaseAdminClient() {
  const { url, serviceRole } = getSupabaseServiceRoleEnv();

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
