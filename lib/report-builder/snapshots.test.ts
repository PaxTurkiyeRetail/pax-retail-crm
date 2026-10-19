import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportUser } from './access';
import { parsePageDefinition } from './page-types';

const mocks = vi.hoisted(() => ({ query: vi.fn(), getPage: vi.fn(), runPage: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { query: mocks.query } }));
vi.mock('./pages-repo', () => ({ getPage: mocks.getPage }));
vi.mock('./page-runner', () => ({ runPage: mocks.runPage }));
import { captureSnapshot, listSnapshots, readSnapshot, snapshotDigest } from './snapshots';

const user: ReportUser = { id: 'owner-1', email: 'owner@example.test', full_name: 'Owner',
  permissions: ['report.read.all', 'quote.read', 'forecast.read', 'report.performance.read'] };
const page = (dataset = 'sales') => parsePageDefinition({ version: 1, title: 'Monthly report', widgets: [
  { id: 'sales', type: 'table', title: 'Sales', layout: { lg: { x: 0, y: 0, w: 12, h: 4 } },
    query: { dataset, measures: [dataset === 'sales' ? 'sale_count' : 'actual_quantity'] } },
] });
const results = { sales: { result: { rows: [{ sale_count: 7 }], columns: [], truncated: false } } };
const record = (dataset = 'sales') => {
  const payload = { page: page(dataset), values: { period: '2026-10' }, results: structuredClone(results) };
  return { id: 'snapshot-1', page_id: 'page-1', owner_user_id: user.id, title: 'October', page_version: 3,
    page: payload.page, filter_values: payload.values, results: payload.results, captured_scope: { kind: 'all' },
    digest: snapshotDigest(payload), created_at: '2026-10-19' };
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPage.mockResolvedValue({ page: page(), version: 3 });
  mocks.runPage.mockResolvedValue(structuredClone(results));
  mocks.query.mockResolvedValue({ rows: [{ id: 'snapshot-1' }] });
});

describe('immutable report snapshots', () => {
  it.each([{ sales: { error: 'Denied' } }, { sales: {} }, {},{sales:{result:{...results.sales.result,truncated:true}}}])('does not insert partial/error output: %j', async (output) => {
    mocks.runPage.mockResolvedValue(output);
    await expect(captureSnapshot(user, 'page-1', 'October', {})).rejects.toMatchObject({ status: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('captures version, results and scope together with a canonical digest', async () => {
    await captureSnapshot(user, 'page-1', 'October', { period: '2026-10' });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain('insert into public.report_page_snapshots');
    expect(params.slice(0, 4)).toEqual(['page-1', user.id, 'October', 3]);
    expect(JSON.parse(params[6])).toEqual(results);
    expect(JSON.parse(params[7])).toEqual({ kind: 'all' });
    expect(params[8]).toBe(snapshotDigest({ page: JSON.parse(params[4]), values: JSON.parse(params[5]), results: JSON.parse(params[6]) }));
  });

  it('returns captured results without rerunning a live source or reopening its page', async () => {
    const captured = record();
    mocks.query.mockResolvedValue({ rows: [captured] });
    const read = await readSnapshot(user, captured.id);
    expect(read.results).toEqual(results);
    expect(mocks.runPage).not.toHaveBeenCalled();
    expect(mocks.getPage).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('uses ownership in SQL and returns 404 for another owner', async () => {
    mocks.query.mockImplementation(async (sql, params) => {
      expect(sql).toContain('owner_user_id=$2');
      expect(params).toEqual(['snapshot-1', 'other-user']);
      return { rows: [] };
    });
    await expect(readSnapshot({ ...user, id: 'other-user' }, 'snapshot-1')).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a formerly all-scope snapshot after permissions narrow to own', async () => {
    mocks.query.mockResolvedValue({ rows: [record()] });
    await expect(readSnapshot({ ...user, permissions: ['report.read.own', 'quote.read'] }, 'snapshot-1')).rejects.toMatchObject({ status: 403 });
  });

  it('checks every current source permission on captured composite datasets', async () => {
    mocks.query.mockResolvedValue({ rows: [record('performance_comparison')] });
    await expect(readSnapshot({ ...user, permissions: ['report.read.all', 'quote.read', 'report.performance.read'] }, 'snapshot-1')).rejects.toMatchObject({ status: 403 });
  });

  it('canonical digest survives JSONB key reordering and detects result tampering', async () => {
    expect(snapshotDigest({ b: { y: 2, x: 1 }, a: [3, 4] })).toBe(snapshotDigest({ a: [3, 4], b: { x: 1, y: 2 } }));
    expect(snapshotDigest({ a: [3, 4] })).not.toBe(snapshotDigest({ a: [4, 3] }));
    const captured = record();
    captured.results.sales.result.rows[0].sale_count = 900;
    mocks.query.mockResolvedValue({ rows: [captured] });
    await expect(readSnapshot(user, 'snapshot-1')).rejects.toMatchObject({ status: 409 });
  });

  it('lists snapshots only after live page access and binds owner identity', async () => {
    await listSnapshots(user, 'page-1');
    expect(mocks.getPage).toHaveBeenCalledWith(user, 'page-1');
    expect(mocks.query.mock.calls[0][1]).toEqual(['page-1', user.id]);
    mocks.query.mockClear();
    mocks.getPage.mockResolvedValue(null);
    await expect(listSnapshots(user, 'page-1')).rejects.toMatchObject({ status: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
