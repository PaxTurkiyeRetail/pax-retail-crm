import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as Array<{ id: string; musteri: string }>, tail: Promise.resolve() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    connect: async () => {
      let unlock: (() => void) | undefined;
      let pending: { id: string; musteri: string } | undefined;
      return {
        query: async (sql: string, params: unknown[] = []) => {
          if (sql.startsWith('select pg_advisory_xact_lock')) {
            const previous = state.tail;
            state.tail = new Promise<void>((resolve) => { unlock = resolve; });
            await previous;
          } else if (sql.startsWith('select id, musteri')) {
            return { rows: [...state.rows] };
          } else if (sql === 'test insert') {
            pending = { id: String(params[0]), musteri: String(params[1]) };
          } else if (sql === 'commit') {
            if (pending) state.rows.push(pending);
            unlock?.();
          } else if (sql === 'rollback') {
            unlock?.();
          }
          return { rows: [] };
        },
        release: () => undefined,
      };
    },
  },
}));

import { CustomerNameConflictError, withCustomerNameGuard } from './customer-name-conflict';

describe('customer name write guard', () => {
  beforeEach(() => { state.rows = []; state.tail = Promise.resolve(); });

  it('serializes concurrent equivalent name inserts and accepts only one', async () => {
    const create = (id: string, name: string) => withCustomerNameGuard(name, null, async (client) => {
      await client.query('test insert', [id, name]);
    });
    const results = await Promise.allSettled([
      create('1', 'İMZA BARKOD (MİZAN YAZILIM)'),
      create('2', 'imza barkod(mizan yazılım)'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejection?.reason).toBeInstanceOf(CustomerNameConflictError);
    expect(state.rows).toHaveLength(1);
  });

  it('allows editing an existing duplicate without changing its normalized name', async () => {
    state.rows = [{ id: '1', musteri: 'ABC (TEST)' }, { id: '2', musteri: 'ABC(TEST)' }];
    await expect(withCustomerNameGuard('ABC(TEST)', '1', async () => 'saved')).resolves.toBe('saved');
    await expect(withCustomerNameGuard('ABC TEST', '3', async () => 'saved')).rejects.toBeInstanceOf(CustomerNameConflictError);
  });
});
