import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn(), write: vi.fn(), mkdir: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Client: class { query = mock.query; connect = mock.connect; end = mock.end; } } }));
vi.mock('node:fs/promises', () => ({ readFile: mock.read, writeFile: mock.write, mkdir: mock.mkdir }));

type Row = Record<string, unknown>;
type State = { plans: Row[]; pool: Row[] };
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const source = {
  p26: Array.from({ length: 15 }, (_, i) => ({ firm: `Plan ${i}`, model: 'A80', qty: i === 14 ? 5172 : 1, mode: 'Kiralama', prob: 60 })),
  p27: Array.from({ length: 17 }, (_, i) => ({ firm: `Plan ${i}`, model: 'A35', qty: i === 16 ? 6579 : 1, mode: i === 0 ? 'Banka' : 'Kiralama', prob: 30 })),
  crm: Array.from({ length: 530 }, (_, i) => ({ name: `CRM ${i}`, status: 'Lead', kasa: 'Bilinmeyen' })),
};
const html = `<script type="application/json">${JSON.stringify(source)}</script>`;
let state: State;
let pending: State;
let backup: Map<string, string>;
let failAtPoolInsert: number | null;
let poolInserts: number;
const originalArgv = [...process.argv];
const originalUrl = process.env.DATABASE_URL;
const originalExit = process.exitCode;

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state = { plans: [], pool: [] }; pending = structuredClone(state); backup = new Map();
  failAtPoolInsert = null; poolInserts = 0;
  process.env.DATABASE_URL = 'test-mock-only'; process.exitCode = undefined;
  mock.connect.mockResolvedValue(undefined); mock.end.mockResolvedValue(undefined);
  mock.read.mockResolvedValue(html);
  mock.mkdir.mockResolvedValue(undefined);
  mock.write.mockImplementation(async (path: string, content: string, options: { flag: string }) => {
    if (backup.has(path) && options.flag === 'wx') throw Object.assign(new Error('exists'), { code: 'EEXIST' });
    backup.set(path, content);
  });
  mock.query.mockImplementation(async (sql: string, p: unknown[] = []) => {
    if (sql.startsWith('begin')) { pending = structuredClone(state); return { rows: [] }; }
    if (sql === 'rollback') { pending = structuredClone(state); return { rows: [] }; }
    if (sql === 'commit') { state = structuredClone(pending); return { rows: [] }; }
    if (sql.startsWith('set local') || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('select id::text,musteri as name')) return { rows: source.crm.map((row, i) => ({ id: uuid(i + 1), name: row.name })) };
    if (sql.startsWith('select id::text,reference_key,reference_snapshot')) return { rows: pending.plans.filter(row => (p[0] as string[]).includes(row.reference_key as string)).map(row => ({ id: row.id, reference_key: row.reference_key, reference_snapshot: row.reference_snapshot, updated_at: row.updated_at })) };
    if (sql.startsWith('select customer_id::text,reference_key,reference_snapshot')) return { rows: pending.pool.filter(row => (p[0] as string[]).includes(row.reference_key as string) || (p[1] as string[]).includes(row.customer_id as string)).map(row => ({ customer_id: row.customer_id, reference_key: row.reference_key, reference_snapshot: row.reference_snapshot, updated_at: row.updated_at })) };
    if (sql.startsWith('insert into public.crm_retail_plan_entries')) {
      const row = { id: uuid(1000 + pending.plans.length), reference_key: p[0], plan_year: p[1], plan_month: p[2], customer_id: p[3], firm_name: p[4], product_code: p[5], quantity: p[6], business_model: p[7], probability: p[8], note: p[9], unit_price: p[10], rental_monthly_price: p[11] == null ? null : String(p[11]), is_active: true, source_name: p[12], reference_snapshot: JSON.parse(p[13] as string), updated_at: '2026-10-20 00:00:00+03' };
      pending.plans.push(row); return { rowCount: 1, rows: [{ id: row.id, reference_key: row.reference_key }] };
    }
    if (sql.startsWith('insert into public.crm_retail_pool_memberships')) {
      if (++poolInserts === failAtPoolInsert) throw new Error('simulated failure');
      const row = { customer_id: p[0], reference_key: p[1], reference_name: p[2], retail_status: p[3], register_vendor_group: p[4], source_name: p[5], reference_snapshot: JSON.parse(p[6] as string), updated_at: '2026-10-20 00:00:00+03' };
      pending.pool.push(row); return { rowCount: 1, rows: [{ customer_id: row.customer_id, reference_key: row.reference_key }] };
    }
    if (sql.startsWith('select reference_key,plan_year')) return { rows: pending.plans.filter(row => (p[0] as string[]).includes(row.reference_key as string)).map(({ id: _id, updated_at: _updated, ...row }) => row) };
    if (sql.startsWith('select customer_id::text,reference_key,reference_name')) return { rows: pending.pool.filter(row => (p[0] as string[]).includes(row.reference_key as string)).map(({ updated_at: _updated, ...row }) => row) };
    throw new Error('Unexpected query: ' + sql);
  });
});
afterEach(() => {
  process.argv = originalArgv; process.exitCode = originalExit;
  if (originalUrl == null) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
  vi.restoreAllMocks();
});
async function run(extra: string[]) {
  vi.resetModules();
  process.argv = ['node', 'import-retail-reference-plan.mjs', '--source', 'reference.html', ...extra];
  // @ts-expect-error JavaScript CLI entry intentionally has no declaration file.
  await import('./import-retail-reference-plan.mjs');
}

describe('Retail reference import transaction boundaries', () => {
  it('defaults to a read-only 32-plan / 530-membership preflight with no filesystem writes', async () => {
    await run(['--include-pool']);
    expect(process.exitCode).toBeUndefined();
    expect(mock.query.mock.calls[0][0]).toContain('read only');
    expect(mock.query.mock.calls.some(([sql]) => /^(insert|update|delete)/i.test(sql))).toBe(false);
    expect(mock.write).not.toHaveBeenCalled();
    expect(state).toEqual({ plans: [], pool: [] });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"poolToInsert":530'));
  });
  it('backs up first, inserts exactly 32 / 530, and never writes canonical Forecast or customers', async () => {
    await run(['--include-pool', '--apply', '--backup', 'before.json']);
    expect(process.exitCode).toBeUndefined();
    expect(state.plans).toHaveLength(32); expect(state.pool).toHaveLength(530);
    expect(state.plans.filter(row => row.plan_year === 2026).reduce((n, row) => n + Number(row.quantity), 0)).toBe(5186);
    expect(state.plans.filter(row => row.plan_year === 2027).reduce((n, row) => n + Number(row.quantity), 0)).toBe(6595);
    const firstInsert = mock.query.mock.calls.findIndex(([sql]) => sql.startsWith('insert'));
    expect(mock.write.mock.invocationCallOrder[0]).toBeLessThan(mock.query.mock.invocationCallOrder[firstInsert]);
    expect(mock.query.mock.calls.some(([sql]) => /^(insert|update|delete).*public\.(crm_forecasts|musteriler)\b/is.test(sql))).toBe(false);
    expect(backup.size).toBe(2);
    expect(mock.write.mock.calls.every(([, , options]) => options.flag === 'wx' && options.mode === 0o600)).toBe(true);
  });
  it('is idempotent and preserves an existing user edit, including inactive source rows', async () => {
    await run(['--include-pool', '--apply', '--backup', 'before.json']);
    state.plans[0].quantity = 123; state.plans[0].is_active = false;
    state.pool[0].retail_status = 'Hunter';
    const expected = structuredClone(state);
    mock.query.mockClear();
    await run(['--include-pool', '--apply', '--backup', 'again.json']);
    expect(process.exitCode).toBeUndefined(); expect(state).toEqual(expected);
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"preservedExisting":32'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"poolPreserved":530'));
  });
  it('rolls back all plan and pool writes when a membership insert fails', async () => {
    failAtPoolInsert = 3;
    await run(['--include-pool', '--apply', '--backup', 'before.json']);
    expect(process.exitCode).toBe(1); expect(state).toEqual({ plans: [], pool: [] });
    expect(mock.query.mock.calls.some(([sql]) => sql === 'rollback')).toBe(true);
    expect(mock.query.mock.calls.some(([sql]) => sql === 'commit')).toBe(false);
  });
  it('refuses source drift before writes instead of overwriting a different saved source', async () => {
    await run(['--apply', '--backup', 'before.json']);
    state.plans[0].reference_snapshot = { sourceSha256: 'another source', original: { owner: 'PRIVATE_NAME' } };
    mock.query.mockClear();
    await run(['--apply', '--backup', 'again.json']);
    expect(process.exitCode).toBe(1);
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('PRIVATE_NAME');
  });
});
