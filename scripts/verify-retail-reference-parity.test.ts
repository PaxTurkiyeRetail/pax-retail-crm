import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Client: class { query = mock.query; connect = mock.connect; end = mock.end; } } }));
vi.mock('node:fs/promises', () => ({ readFile: mock.read }));
const source = vi.hoisted(() => ({
  plans: Array.from({ length: 32 }, (_, i) => ({ referenceKey: `plan-${i}`, planYear: i < 15 ? 2026 : 2027, planMonth: i < 15 ? 12 : 3, firmName: `Firm ${i}`, productCode: 'A80', quantity: 1, businessModel: 'rental', probability: 60, note: 'PRIVATE_SOURCE_NOTE', unitPrice: null, rentalMonthlyPrice: i < 15 ? 15 : null, sourceName: 'reference.html', referenceSnapshot: { sourceSha256: 'source-hash', original: { owner: 'PRIVATE_ACCOUNT' } } })),
  pool: Array.from({ length: 530 }, (_, i) => ({ referenceKey: `member-${i}`, referenceName: `Firm ${i}`, customerId: `customer-${i}`, retailStatus: 'Lead', registerVendorGroup: 'Inhouse', sourceName: 'reference.html', referenceSnapshot: { sourceSha256: 'source-hash', original: { owner: 'PRIVATE_ACCOUNT' } } })),
}));
vi.mock('./retail-reference-plan-parser.mjs', () => ({
  parseRetailReferencePlan: () => ({ sourceSha256: 'source-hash', rows: source.plans }),
  parseRetailReferencePool: () => ({ sourceSha256: 'source-hash', rows: source.pool }),
  matchRetailReferencePool: () => source.pool,
  retailReferenceSalesTotals: () => ({ firms: 23, terminals: 1432, s210: 678, usd: 404636 }),
}));
const originalArgv = [...process.argv], originalUrl = process.env.DATABASE_URL, originalExit = process.exitCode;
let tamper: boolean;
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); tamper = false;
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  process.argv = ['node', 'verify.mjs', '--source', 'reference.html']; process.env.DATABASE_URL = 'mock-only'; process.exitCode = undefined;
  mock.connect.mockResolvedValue(undefined); mock.end.mockResolvedValue(undefined); mock.read.mockResolvedValue('JSON source');
  mock.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('begin') || sql.startsWith('set local') || sql === 'rollback') return { rows: [] };
    if (sql.includes('from public.crm_retail_plan_entries')) return { rows: source.plans.map((r, i) => ({ reference_key: r.referenceKey, plan_year: r.planYear, plan_month: r.planMonth, firm_name: r.firmName, product_code: r.productCode, quantity: tamper && i === 0 ? 999 : r.quantity, business_model: r.businessModel, probability: r.probability, note: r.note, unit_price: null, rental_monthly_price: r.rentalMonthlyPrice, is_active: true, source_name: r.sourceName, reference_snapshot: r.referenceSnapshot })) };
    if (sql.startsWith('select id::text,musteri')) return { rows: [] };
    if (sql.includes('from public.crm_retail_pool_memberships')) return { rows: source.pool.map(r => ({ customer_id: r.customerId, reference_key: r.referenceKey, reference_name: r.referenceName, retail_status: r.retailStatus, register_vendor_group: r.registerVendorGroup, source_name: r.sourceName, reference_snapshot: r.referenceSnapshot })) };
    const repairs = [['107', 'd9986922-ef24-4986-9806-586d0cbffbda', 6075], ['109', '721e35e1-6ea8-422f-9e6c-2350f5ad311d', 2002], ['111', 'e33ed587-622b-4294-a277-cc29e21021e3', 50745], ['112', '86af6f55-f996-40e4-9db5-98a3410fa5b8', 19635]];
    if (sql.includes('from public.crm_sales_import_pivot')) return { rows: repairs.map(([key, , amount]) => ({ import_key: 'pivot-10.09.2026-' + key, sale_id: 'sale', amount })) };
    if (sql.startsWith('select id::text,sale_id::text,total_price')) return { rows: repairs.map(([, id, total_price]) => ({ id, sale_id: 'sale', total_price })) };
    if (sql.startsWith('select count(distinct')) return { rows: [{ firms: 23, terminals: 1432, s210: 678, usd: '404636.00' }] };
    if (sql.includes('md5(to_jsonb(t)::text)')) return { rows: [{ count: 100, digest: '00000000000000000000000000000000' }] };
    throw new Error('Unexpected query');
  });
});
afterEach(() => { process.argv = originalArgv; process.exitCode = originalExit; if (originalUrl == null) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl; vi.restoreAllMocks(); });
async function run() {
  // @ts-expect-error JavaScript CLI entry intentionally has no declaration file.
  await import('./verify-retail-reference-parity.mjs');
}
describe('production Retail parity verifier', () => {
  it('checks all reference rows and emits only counters/digests inside a read-only transaction', async () => {
    await run();
    expect(process.exitCode).toBeUndefined(); expect(mock.query.mock.calls[0][0]).toContain('read only');
    expect(mock.query.mock.calls.some(([sql]) => /^(insert|update|delete|commit)/i.test(sql))).toBe(false);
    const output = JSON.stringify(vi.mocked(console.log).mock.calls);
    expect(output).toContain('membershipRows'); expect(output).toContain('canonical');
    expect(output).not.toContain('PRIVATE_SOURCE_NOTE'); expect(output).not.toContain('PRIVATE_ACCOUNT');
  });
  it('fails nonzero on edited source fields without leaking assertion snapshots or notes', async () => {
    tamper = true; await run();
    expect(process.exitCode).toBe(1); expect(console.log).not.toHaveBeenCalled();
    expect(mock.query.mock.calls.some(([sql]) => sql === 'rollback')).toBe(true);
    const output = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(output).not.toContain('PRIVATE_SOURCE_NOTE'); expect(output).not.toContain('PRIVATE_ACCOUNT');
  });
});
