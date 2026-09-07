import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ canReadAny: true, ownIds: ['a', 'b'] as string[] }));
vi.mock('@/lib/authz', () => ({ requireCrmAccessOrThrow: async () => ({ id: 'u1' }), userHasPermission: () => state.canReadAny }));
vi.mock('@/lib/crm-phase-history', () => ({ appendLastStayedPhase: async (rows: unknown[]) => rows }));
vi.mock('@/lib/kunye', () => ({ mapKunyeDbToUi: () => null, getKunyeStatus: () => ({ status: 'Eksik', missingFields: [], missing: 1 }), normalizeKunyeStatusFilter: () => '' }));
function client() {
  return { from(table: string) {
    const firms = [
      { id: 'a', musteri: 'Alpha', customer_type: 'standard' },
      { id: 'b', musteri: 'Beta', customer_type: 'business_partner' },
      { id: 'c', musteri: 'Charlie', customer_type: 'standard' },
      { id: 'd', musteri: 'Delta', customer_type: 'business_partner' },
    ].map(r => ({ ...r, owner_user_id: state.ownIds.includes(r.id) ? 'u1' : 'u2' }));
    // Delta is absent from the legacy view; Beta occurs in both sources.
    let rows: any[] = table === 'musteriler' ? firms : table === 'organization_roles'
      ? firms.filter(r => r.customer_type === 'business_partner').map(r => ({ customer_id: r.id, role_key: 'business_partner', is_active: true }))
      : table === 'vw_crm_musteriler' ? firms.filter(r => r.id !== 'd').map(r => ({ ...r, musteri_id: r.id, aktif_faz_no: 3 })) : [];
    let start = 0, end = Infinity;
    const query: any = {
      select: () => query, order: () => query,
      range: (a: number, b: number) => { start = a; end = b + 1; return query; },
      limit: (n: number) => { end = n; return query; },
      eq: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return query; },
      in: (k: string, values: unknown[]) => { rows = rows.filter(r => values.includes(r[k])); return query; },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows.slice(start, end), count: rows.length, error: null }).then(resolve),
    };
    return query;
  } };
}
vi.mock('@/lib/pg/server', () => ({ createPgServerClient: async () => client() }));
vi.mock('@/lib/pg/admin', () => ({ createPgAdminClient: () => client() }));
import { GET } from './route';
async function page(number: number) {
  const response = await GET(new Request(`http://localhost/api/crm/list?include_report_only=1&pageSize=2&page=${number}`));
  expect(response.status).toBe(200);
  return response.json();
}
describe('customer and partner list pagination', () => {
  beforeEach(() => { state.canReadAny = true; state.ownIds = ['a', 'b']; });
  it('merges and deduplicates before paging, retaining the view phase', async () => {
    const first = await page(1), second = await page(2);
    expect(first.total).toBe(4);
    expect(second.total).toBe(4);
    expect(first.rows.map((r: any) => r.musteri_id)).toEqual(['a', 'b']);
    expect(second.rows.map((r: any) => r.musteri_id)).toEqual(['c', 'd']);
    expect(first.rows[1].aktif_faz_no).toBe(3);
  });
  it('does not append partners outside the users ownership scope', async () => {
    state.canReadAny = false;
    const result = await page(1);
    expect(result.total).toBe(2);
    expect(result.rows.map((r: any) => r.musteri_id)).toEqual(['a', 'b']);
  });
  it('returns an empty page when no firms are assigned', async () => {
    state.canReadAny = false; state.ownIds = [];
    expect(await page(1)).toMatchObject({ rows: [], total: 0 });
  });
});
