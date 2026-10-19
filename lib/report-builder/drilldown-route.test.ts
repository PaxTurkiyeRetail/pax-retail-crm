import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ execute: vi.fn(), user: vi.fn() }));
vi.mock('@/lib/report-builder/executor', () => ({ executeReport: mocks.execute }));
vi.mock('@/lib/report-builder/http', () => ({
  requireReportBuilderUser: mocks.user,
  builderErrorResponse: (error: { status?: number; message: string }) => Response.json({ message: error.message }, { status: error.status ?? 400 }),
}));
import { POST } from '@/app/api/report-builder/drilldown/route';
import { parseReportDefinition } from './types';
const definition = parseReportDefinition({ dataset: 'sales', measures: ['sale_count'], dimensions: [{ field: 'owner' }], filters: [{ field: 'currency', op: 'eq', value: 'USD' }, { field: 'sale_count', op: 'gt', value: 10 }] });
const request = () => new Request('http://localhost/api/report-builder/drilldown', { method: 'POST', body: JSON.stringify({ definition, row: { d_owner: 'Person' } }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: 'person', email: 'person@example.test', full_name: 'Person', permissions: ['report.read.own', 'quote.read'] });
});
describe('drilldown parent eligibility', () => {
  it('checks original aggregate group before querying individual contributors', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ d_owner: 'Person', m_sale_count: 12 }] }).mockResolvedValueOnce({ rows: [{ d_sale_id: 'sale', m_sale_count: 1 }] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    const [parent, parentScope] = mocks.execute.mock.calls[0];
    const [detail, detailScope] = mocks.execute.mock.calls[1];
    expect(parent.dimensions).toEqual([{ field: 'owner' }]);
    expect(parent.filters).toContainEqual({ field: 'sale_count', op: 'gt', value: 10 });
    expect(parent.filters).toContainEqual({ field: 'owner', op: 'eq', value: 'Person' });
    expect(detail.filters).toEqual([{ field: 'currency', op: 'eq', value: 'USD' }, { field: 'owner', op: 'eq', value: 'Person' }]);
    expect(detail.dimensions).toContainEqual({ field: 'sale_id' });
    expect(parentScope).toEqual(detailScope);
    expect(detailScope.kind).toBe('own');
  });
  it('does not query details when group fails the original HAVING condition', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
  it('denies missing dataset permission before any query', async () => {
    mocks.user.mockResolvedValueOnce({ id: 'person', email: 'person@example.test', full_name: 'Person', permissions: ['report.read.own'] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
