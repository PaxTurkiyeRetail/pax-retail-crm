import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), build: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireReportsAccessOrThrow: mocks.access, userHasPermission: (user: { permissions: string[] }, permission: string) => user.permissions.includes(permission) }));
vi.mock('@/lib/reports/retail-operasyon', () => ({ buildRetailOperasyon: mocks.build }));
import { GET } from './route';
type Flags = { canEditForecast: boolean; opportunities: { current: { canEdit: boolean }[]; next: { canEdit: boolean }[] }; crm: { canPlan: boolean }[] };
const payload = {
  year: 2026,
  opportunities: { current: [{ id: 'mine', ownerUserId: 'actor' }, { id: 'other', ownerUserId: 'other' }], next: [{ id: 'unassigned' }] },
  crm: [{ id: 'mine-customer', ownerUserId: 'actor' }, { id: 'other-customer', ownerUserId: 'other' }, { id: 'unassigned-customer' }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ id: 'actor', permissions: [] });
  mocks.build.mockResolvedValue(payload);
});
describe('Retail native per-record edit flags', () => {
  it('passes multiple selected managers together', async () => {
    await GET(new Request('http://localhost/api/reports/retail-operasyon?year=2026&accountManager=user%3Aa&accountManager=user%3Ab'));
    expect(mocks.build).toHaveBeenCalledWith({ year: 2026, accountManager: ['user:a', 'user:b'] });
  });
  it('passes the selected manager to the report without changing edit permissions', async () => {
    const response = await GET(new Request('http://localhost/api/reports/retail-operasyon?year=2026&accountManager=user%3Aother'));
    expect(mocks.build).toHaveBeenCalledWith({ year: 2026, accountManager: ['user:other'] });
    const result = await response.json() as Flags;
    expect(result.canEditForecast).toBe(false);
    expect(result.crm.every(row => !row.canPlan)).toBe(true);
  });
  it('grants any-scope edit and create flags across owners and unassigned rows', async () => {
    mocks.access.mockResolvedValueOnce({ id: 'actor', permissions: ['forecast.write.any'] });
    const response = await GET(new Request('http://localhost/api/reports/retail-operasyon?year=2027'));
    expect(response.status).toBe(200);
    expect(mocks.build).toHaveBeenCalledWith({ year: 2027, accountManager: [] });
    const result = await response.json() as Flags;
    expect(result.canEditForecast).toBe(true);
    expect([...result.opportunities.current, ...result.opportunities.next].map(r => r.canEdit)).toEqual([true, true, true]);
    expect(result.crm.map(r => r.canPlan)).toEqual([true, true, true]);
  });
  it('grants own-only flags solely by canonical customer owner ID', async () => {
    mocks.access.mockResolvedValueOnce({ id: 'actor', permissions: ['forecast.write.own'] });
    const result = await (await GET(new Request('http://localhost/api/reports/retail-operasyon'))).json() as Flags;
    expect(result.canEditForecast).toBe(true);
    expect(result.opportunities.current.map(r => r.canEdit)).toEqual([true, false]);
    expect(result.opportunities.next[0].canEdit).toBe(false);
    expect(result.crm.map(r => r.canPlan)).toEqual([true, false, false]);
    expect(payload.opportunities.current[0]).not.toHaveProperty('canEdit');
  });
  it('keeps report readers read-only even when they own the records', async () => {
    const result = await (await GET(new Request('http://localhost/api/reports/retail-operasyon'))).json() as Flags;
    expect(result.canEditForecast).toBe(false);
    expect([...result.opportunities.current, ...result.opportunities.next].every(r => r.canEdit === false)).toBe(true);
    expect(result.crm.every(r => r.canPlan === false)).toBe(true);
  });
  it('does not build the report after report access is rejected', async () => {
    mocks.access.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    const response = await GET(new Request('http://localhost/api/reports/retail-operasyon'));
    expect(response.status).toBe(403);
    expect(mocks.build).not.toHaveBeenCalled();
  });
});

