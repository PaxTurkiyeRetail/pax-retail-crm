import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), query: vi.fn(), catalog: vi.fn(), options: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireAnyPermissionOrThrow: mocks.access, userHasPermission: (user: { permissions: string[] }, permission: string) => user.permissions.includes(permission) }));
vi.mock('@/lib/db', () => ({ db: { query: mocks.query } }));
vi.mock('@/lib/pg/admin', () => ({ createPgAdminClient: () => ({}) }));
vi.mock('@/lib/quotes/service', () => ({ getQuoteCatalog: mocks.catalog }));
vi.mock('@/lib/forecast', async () => ({ ...await import('@/lib/forecast-shared'), getForecastParameterOptions: mocks.options, isMissingForecastRelation: () => false }));
import { POST } from './route';
const actor = { id: '11111111-1111-4111-8111-111111111111', email: 'actor@example.test', full_name: 'Actor', permissions: ['forecast.write.own'] };
const existing = { id: '22222222-2222-4222-8222-222222222222', customer_id: '33333333-3333-4333-8333-333333333333', owner_user_id: actor.id, sale_type: 'rental', unit_price: null, rental_monthly_price: '17', include_in_retail_plan: 'false' };
const body = { id: existing.id, product_id: 'product', quantity: 12, forecast_year: 2027, forecast_month: 5, sales_channel: 'Banka', probability: 60, note: 'Current note' };
const request = (patch: Record<string, unknown> = {}) => new Request('http://localhost/api/forecast/update', { method: 'POST', body: JSON.stringify({ ...body, ...patch }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(actor);
  mocks.options.mockResolvedValue({ channels: [{ value: 'Banka' }], probabilities: [{ value: '60' }] });
  mocks.catalog.mockResolvedValue({ products: [{ id: 'product', code: 'A80', name: 'A80', rental_monthly_price: 15 }] });
  mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.trimStart().startsWith('update ') ? [{ id: existing.id }] : [existing] }));
});
describe('native Forecast update concurrency and authorization', () => {
  it('binds the exact PostgreSQL microsecond timestamp and rechecks active customer ownership atomically', async () => {
    const stamp = '2026-10-20 09:12:13.123456+03';
    const response = await POST(request({ expected_updated_at: stamp }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mocks.access).toHaveBeenCalledWith(['forecast.write.own', 'forecast.write.any']);
    const [readSql] = mocks.query.mock.calls[0];
    expect(readSql).toContain('c.owner_user_id::text as owner_user_id');
    expect(readSql).toContain('f.is_active = true');
    const [sql, params] = mocks.query.mock.calls[1];
    expect(sql).toContain('and is_active=true');
    expect(sql).toContain('updated_at=$17::timestamptz');
    expect(sql).toContain('customer.id=crm_forecasts.customer_id');
    expect(sql).toContain('customer.owner_user_id=$19::uuid');
    expect(params.slice(16)).toEqual([stamp, false, actor.id]);
    expect(params.slice(12, 16)).toEqual(['rental', null, 17, false]);
  });
  it('returns 409 rather than ok when a stale version or concurrent ownership change updates zero rows', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.trimStart().startsWith('update ') ? [] : [existing] }));
    const response = await POST(request({ expected_updated_at: '2026-10-20T06:00:00.000001Z' }));
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty('ok');
  });
  it('keeps missing timestamps compatible for legacy callers while retaining atomic scope guards', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.query.mock.calls[1][1].slice(16)).toEqual([null, false, actor.id]);
  });
  it.each(['not-a-timestamp', '', 42, null])('rejects invalid version %j before touching DB', async stamp => {
    expect((await POST(request({ expected_updated_at: stamp }))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('denies own-only edits of another customer before UPDATE or catalog lookup', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ ...existing, owner_user_id: 'other-user' }] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('lets any-scope users edit a different owner but binds that privilege explicitly', async () => {
    mocks.access.mockResolvedValueOnce({ ...actor, permissions: ['forecast.write.any'] });
    mocks.query.mockResolvedValueOnce({ rows: [{ ...existing, owner_user_id: 'other-user' }] });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.query.mock.calls[1][1].slice(17)).toEqual([true, actor.id]);
  });
  it('does not query data after the permission guard rejects the caller', async () => {
    mocks.access.mockRejectedValueOnce(Object.assign(new Error('FORBIDDEN'), { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
