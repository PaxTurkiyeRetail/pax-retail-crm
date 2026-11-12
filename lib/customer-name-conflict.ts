import 'server-only';
import { db } from '@/lib/db';
import { customerNameKey } from '@/lib/customer-name';
import type { PoolClient } from 'pg';

export class CustomerNameConflictError extends Error {
  constructor() {
    super('Mevcut müşteri: bu isimde bir kayıt zaten var.');
  }
}

/** Serializes CRM name writes across application processes until the write commits. */
export async function withCustomerNameGuard<T>(name: string, exceptId: string | null, write: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    // Fixed namespace: all names share one lock, including legacy duplicates.
    await client.query('select pg_advisory_xact_lock($1, $2)', [0x43524d, 1]);
    const result = await client.query<{ id: string; musteri: string }>('select id, musteri from public.musteriler where musteri is not null');
    const key = customerNameKey(name);
    const existing = result.rows.find((row) => row.id === exceptId);
    // Existing duplicates can still be edited if their normalized name is unchanged.
    const unchanged = existing && customerNameKey(existing.musteri) === key;
    if (!unchanged && result.rows.some((row) => row.id !== exceptId && customerNameKey(row.musteri) === key)) {
      throw new CustomerNameConflictError();
    }
    const value = await write(client);
    await client.query('commit');
    return value;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
