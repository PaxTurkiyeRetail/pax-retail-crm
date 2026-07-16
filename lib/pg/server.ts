import { createPgClient } from '@/lib/pg/client';

export async function createPgServerClient() {
  return createPgClient();
}
