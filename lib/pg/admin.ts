import { createPgClient } from '@/lib/pg/client';

export function createPgAdminClient() {
  return createPgClient();
}
