import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn(), write: vi.fn(), mkdir: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Client: class { query = mock.query; connect = mock.connect; end = mock.end; } } }));
vi.mock('node:fs/promises', () => ({ readFile: mock.read, writeFile: mock.write, mkdir: mock.mkdir }));
type Row = Record<string, unknown>;
type State = { staging: Row[]; items: Row[]; sales: Row[] };
const s1 = '363e7339-281b-4a1e-8774-3ba081c81c90', s2 = '819bf74f-d102-4477-8453-cf941dd9c9cc', s3 = '1c02f748-3add-48c8-848c-070a0069820a';
const customer = ['97200fd0-8226-4c18-8165-1fa557053dae', '8b253a1a-741e-4f6a-9799-d87834f46e72', 'af377b9d-08ad-4181-beef-b400b6df3701'];
const dates = ['2026-06-19', '2026-06-26', '2026-06-29'];
const lines = [
  ['107', s1, 'd9986922-ef24-4986-9806-586d0cbffbda', 'A6630', 15, 405, 6.08],
  ['109', s2, '721e35e1-6ea8-422f-9e6c-2350f5ad311d', 'S210', 26, 77, 2],
  ['111', s3, 'e33ed587-622b-4294-a277-cc29e21021e3', 'A80', 255, 199, 50.74],
  ['112', s3, '86af6f55-f996-40e4-9db5-98a3410fa5b8', 'S210', 255, 77, 19.64],
] as const;
const originalState = (): State => ({
  staging: lines.map(([key, sale, , , qty, unit, amount], i) => ({ id: `source-${i}`, import_key: `pivot-10.09.2026-${key}`, sale_id: sale, customer_id: customer[[s1, s2, s3].indexOf(sale)], sale_date: dates[[s1, s2, s3].indexOf(sale)], device_count: qty, unit_price: String(unit), amount: String(amount) })),
  items: [...lines.map(([, sale, id, code, qty, unit, amount]) => ({ id, sale_id: sale, product_code: code, quantity: qty, unit_price: String(unit), total_price: String(amount), sale_type: 'sale' })), { id: 'ea2fe3df-a32c-4f0a-b3da-62658a1cfe16', sale_id: s2, product_code: 'A80', quantity: 26, unit_price: '211', total_price: '7202', sale_type: 'sale' }],
  sales: [s1, s2, s3].map((id, i) => ({ id, customer_id: customer[i], sale_date: dates[i], amount: String([6.08, 7204, 70.38][i]), hardware_amount: String([6.08, 7204, 70.38][i]), currency: 'USD', status: 'active', source: 'direct', price_source: 'manual', quote_id: null, created_by: 'import:satis-pivot-10.09.2026' })),
});
let state: State, pending: State, files: Map<string, string>;
let failWrite: boolean;
const originalArgv = [...process.argv], originalUrl = process.env.DATABASE_URL, originalExit = process.exitCode;
const ordered = (rows: Row[], key: string) => structuredClone(rows).sort((a, b) => String(a[key]).localeCompare(String(b[key])));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  state = originalState(); pending = structuredClone(state); files = new Map(); failWrite = false;
  process.env.DATABASE_URL = 'test-mock-only'; process.exitCode = undefined;
  mock.connect.mockResolvedValue(undefined); mock.end.mockResolvedValue(undefined); mock.mkdir.mockResolvedValue(undefined);
  mock.read.mockImplementation(async (path: string) => { if (!files.has(path)) throw new Error('missing backup'); return files.get(path); });
  mock.write.mockImplementation(async (path: string, content: string, options: { flag: string }) => { if (failWrite || (files.has(path) && options.flag === 'wx')) throw new Error('backup unavailable'); files.set(path, content); });
  mock.query.mockImplementation(async (sql: string, p: unknown[] = []) => {
    if (sql.startsWith('begin')) { pending = structuredClone(state); return { rows: [] }; }
    if (sql === 'rollback') { pending = structuredClone(state); return { rows: [] }; }
    if (sql === 'commit') { state = structuredClone(pending); return { rows: [] }; }
    if (sql.startsWith('set local')) return { rows: [] };
    if (sql.startsWith('select id::text,import_key')) return { rows: ordered(pending.staging, 'import_key') };
    if (sql.startsWith('select id::text,sale_id')) return { rows: ordered(pending.items, 'id') };
    if (sql.startsWith('select id::text,customer_id')) return { rows: ordered(pending.sales, 'id') };
    if (sql.startsWith('update public.crm_sales_import_pivot')) { const row = pending.staging.find(r => r.id === p[1] && Number(r.amount) === p[2]); if (row) row.amount = String(p[0]); return { rowCount: row ? 1 : 0 }; }
    if (sql.startsWith('update public.crm_sale_items')) { const row = pending.items.find(r => r.id === p[1] && r.sale_id === p[2] && Number(r.total_price) === p[3]); if (row) row.total_price = String(p[0]); return { rowCount: row ? 1 : 0 }; }
    if (sql.startsWith('update public.crm_sales ')) { const row = pending.sales.find(r => r.id === p[1] && Number(r.amount) === p[2] && Number(r.hardware_amount) === p[2]); if (row) { row.amount = String(p[0]); row.hardware_amount = String(p[0]); } return { rowCount: row ? 1 : 0 }; }
    if (sql.startsWith('select sum(total_price)')) return { rows: [{ total: pending.items.filter(r => r.sale_id === p[0]).reduce((n, r) => n + Number(r.total_price), 0) }] };
    throw new Error('Unexpected query');
  });
});
afterEach(() => {
  process.argv = originalArgv; process.exitCode = originalExit;
  if (originalUrl == null) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
  vi.restoreAllMocks();
});
async function run(args: string[]) {
  vi.resetModules(); process.argv = ['node', 'repair-retail-2026-import-amounts.mjs', ...args];
  // @ts-expect-error JavaScript CLI entry intentionally has no declaration file.
  await import('./repair-retail-2026-import-amounts.mjs');
}
describe('reviewed Retail money repair safeguards', () => {
  it('dry-runs without any DB or backup writes', async () => {
    await run([]);
    expect(process.exitCode).toBeUndefined(); expect(state).toEqual(originalState());
    expect(mock.query.mock.calls[0][0]).toContain('read only');
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
    expect(mock.write).not.toHaveBeenCalled();
  });
  it('repairs exactly four sources/four items/three heads and reverses safely using its backup', async () => {
    await run(['--apply', '--backup', 'before.json']);
    expect(process.exitCode).toBeUndefined();
    const updates = mock.query.mock.calls.filter(([sql]) => sql.startsWith('update'));
    expect(updates).toHaveLength(11);
    expect(state.sales.reduce((n, r) => n + Number(r.amount), 0)).toBe(85659);
    expect(state.items.find(r => r.id === 'ea2fe3df-a32c-4f0a-b3da-62658a1cfe16')?.total_price).toBe('7202');
    const firstUpdate = mock.query.mock.calls.findIndex(([sql]) => sql.startsWith('update'));
    expect(mock.write.mock.invocationCallOrder[0]).toBeLessThan(mock.query.mock.invocationCallOrder[firstUpdate]);
    expect(mock.write.mock.calls[0][2]).toEqual({ flag: 'wx', mode: 0o600 });
    const backupPath = [...files.keys()][0];
    const saved = JSON.parse(files.get(backupPath)!);
    expect(saved.staging).toHaveLength(4); expect(saved.items).toHaveLength(4); expect(saved.sales).toHaveLength(3);
    await run(['--rollback', backupPath, '--apply']);
    expect(process.exitCode).toBeUndefined(); expect(state).toEqual(originalState());
  });
  it('rejects a repeat repair or a changed customer/date before any new update', async () => {
    await run(['--apply', '--backup', 'before.json']);
    const repaired = structuredClone(state); mock.query.mockClear();
    await run(['--apply', '--backup', 'again.json']);
    expect(process.exitCode).toBe(1); expect(state).toEqual(repaired);
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
    state = originalState(); state.sales[0].customer_id = 'another-customer';
    mock.query.mockClear(); await run(['--apply', '--backup', 'third.json']);
    expect(process.exitCode).toBe(1);
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
  });
  it('aborts before DB updates if the exclusive backup cannot be written', async () => {
    failWrite = true;
    await run(['--apply', '--backup', 'before.json']);
    expect(process.exitCode).toBe(1); expect(state).toEqual(originalState());
    expect(mock.query.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
    expect(mock.query.mock.calls.some(([sql]) => sql === 'commit')).toBe(false);
  });
});
