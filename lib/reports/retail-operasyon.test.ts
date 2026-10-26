import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query, kasapos } = vi.hoisted(() => ({ query: vi.fn(), kasapos: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
vi.mock('./kasapos-entegrasyon', () => ({ buildKasaposEntegrasyonRaporu: kasapos }));
import { buildRetailOperasyon } from './retail-operasyon';
import { computeKasaposEntegrasyon } from './kasapos-entegrasyon-shared';

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [] });
  kasapos.mockReset().mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
});

describe('Retail canonical live sources', () => {
  it('scopes every source by current customer ownership and keeps the full manager list', async () => {
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('k.satici_etiketi')) return { rows: [
        { id: 'a', musteri: 'A', owner_user_id: 'manager-a', sorumlu: 'Ali' },
        { id: 'b', musteri: 'B', owner_user_id: 'manager-b', sorumlu: 'Ayşe' },
        { id: 'c', musteri: 'C', sorumlu: '' },
      ] };
      expect(sql).toContain('m.id::text = any(');
      expect(params.at(-1)).toEqual(['a']);
      return { rows: [] };
    });
    const result = await buildRetailOperasyon({ year: 2026, accountManager: 'user:manager-a' });
    expect(result.crm.map(row => row.id)).toEqual(['a']);
    expect(result.accountManagers).toEqual(expect.arrayContaining([
      { value: 'user:manager-a', label: 'Ali' }, { value: 'user:manager-b', label: 'Ayşe' },
      { value: 'unassigned', label: 'Atanmamış' },
    ]));
    expect(kasapos).toHaveBeenCalledWith({ year: 2026, department: 'Retail', customerIds: ['a'] });
    expect(query).toHaveBeenCalledTimes(4);
  });
  it('uses an empty scope for a missing manager instead of returning all customers', async () => {
    const result = await buildRetailOperasyon({ year: 2026, accountManager: 'user:missing' });
    expect(result.crm).toEqual([]);
    expect(kasapos).toHaveBeenCalledWith({ year: 2026, department: 'Retail', customerIds: [] });
    for (const [sql, params] of query.mock.calls) {
      if (!sql.includes('k.satici_etiketi')) expect(params.at(-1)).toEqual([]);
    }
  });
  it('preserves missing invoice months and reconciles firm/monthly KasaPOS totals', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [
      { customerId: 'a', ay: 1, adet: 10, tutar: 50.25 },
      { customerId: 'a', ay: 3, adet: 15, tutar: 75.5 },
      { customerId: 'b', ay: 2, adet: 4, tutar: 20 },
    ], ['a', 'b'].map(id => ({ customerId: id, musteri: id, sorumlu: null, aktifKasa: 20, aktifKasaUpdatedAt: null, aktifKasaUpdatedBy: null }))));
    const result = await buildRetailOperasyon({ year: 2026 });
    const firm = result.kasapos.rows.find(row => row.firm === 'a')!;
    expect(firm.monthly).toEqual([{ month: '2026-01-01', billed: 10, usd: 50.25 }, null, { month: '2026-03-01', billed: 15, usd: 75.5 }]);
    expect(firm).toMatchObject({ billed: 15, gap: 5, yearBilled: 25, totalUsd: 125.75 });
    expect(result.kasapos.rows.reduce((n, row) => n + (row.totalUsd ?? 0), 0)).toBe(result.kasapos.monthly.reduce((n, row) => n + row.usd, 0));
    expect(result.kasapos.rows.reduce((n, row) => n + (row.yearBilled ?? 0), 0)).toBe(result.kasapos.monthly.reduce((n, row) => n + row.billed, 0));
  });
  it('keeps empty years empty without imported plans, memberships or reference fallback', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2027, [], []));
    const result = await buildRetailOperasyon({ year: 2027 });
    expect(result.opportunities).toEqual({ current: [], next: [] });
    expect(result.crm).toEqual([]);
    expect(result.kasapos.monthly).toEqual([{ month: '2027-01-01', billed: 0, usd: 0 }]);
    const allSql = query.mock.calls.map(([sql]) => sql).join('\n');
    expect(allSql).not.toMatch(/crm_retail_plan_entries|crm_retail_pool_memberships|reference_snapshot/);
    expect(allSql).toContain('from public.crm_forecasts f join public.musteriler m');
  });
  it('loads active Forecast by current Retail department/year and preserves canonical attributes', async () => {
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (!sql.includes('from public.crm_forecasts f join public.musteriler m')) return { rows: [] };
      expect(sql).toContain('f.is_active=true'); expect(sql).toContain("m.is_kolu='Retail'");
      expect(params).toEqual([[2026, 2027]]);
      return { rows: [{ id: 'forecast-id', customer_id: 'customer-id', customer_owner_user_id: 'current-customer-owner', product_id: 'canonical-product-id', product_code_snapshot: 'a80', product_name_snapshot: 'PAX A80', firm: 'Live company', quantity: 1300, forecast_year: 2027, forecast_month: 4, sales_channel: 'Direct channel', probability: 60, note: 'Live note', owner_name: 'Saved forecast owner', updated_at: '2026-10-20 12:34:56+03', sale_type: 'rental', unit_price: null, rental_monthly_price: '15', include_in_retail_plan: false }] };
    });
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.opportunities.current).toEqual([]);
    expect(result.opportunities.next[0]).toMatchObject({ id: 'forecast-id', customerId: 'customer-id', productId: 'canonical-product-id', ownerUserId: 'current-customer-owner', model: 'A80', qty: 1300, month: 4, channel: 'Direct channel', saleType: 'rental', businessModel: 'rental', source: 'forecast', rentalMonthlyPrice: 15, unitPrice: null, prob: 60, includeInRetailPlan: false, updatedAt: '2026-10-20 12:34:56+03' });
  });
  it('derives bank model from the configured channel without overwriting native rental type', async () => {
    query.mockImplementation(async (sql: string) => !sql.includes('from public.crm_forecasts f join public.musteriler m') ? { rows: [] } : { rows: [
      { id: 'bank', customer_id: 'c', firm: 'Bank company', product_code_snapshot: 'A80', quantity: 500, forecast_year: 2027, forecast_month: 3, sales_channel: 'configured-bank-code', is_bank_channel: true, sale_type: 'sale', probability: 30 },
      { id: 'bank-rental', customer_id: 'c', firm: 'Bank rental', product_code_snapshot: 'A80', quantity: 20, forecast_year: 2027, forecast_month: 4, sales_channel: 'Banka', sale_type: 'rental', probability: 60 },
    ] });
    const { opportunities } = await buildRetailOperasyon({ year: 2026 });
    expect(opportunities.next[0]).toMatchObject({ saleType: 'sale', businessModel: 'bank', channel: 'configured-bank-code' });
    expect(opportunities.next[1]).toMatchObject({ saleType: 'rental', businessModel: 'rental', channel: 'Banka' });
  });
  it('keeps USD invoice quantities separate', async () => {
    query.mockImplementation(async (sql: string) => sql.includes('extract(month from s.sale_date)') ? { rows: [
      { firm: 'Mixed', product_code: 'A80', ay: 1, qty: 12, usd_qty: 2, usd: 300, sale_type: 'sale' },
      { firm: 'TRY only', product_code: 'A35', ay: 2, qty: 5, usd_qty: 0, usd: 0, sale_type: 'sale' },
    ] } : { rows: [] });
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.sales[0]).toMatchObject({ qty: 12, usdQty: 2, usd: 300 });
    expect(result.sales[1]).toMatchObject({ qty: 5, usdQty: 0, usd: 0 });
  });
  it('includes all current Retail customers and marks plans without hiding customers or merging names', async () => {
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (!sql.includes('k.satici_etiketi')) return { rows: [] };
      expect(sql).toContain('from public.musteriler m'); expect(sql).toContain("where m.is_kolu='Retail'");
      expect(sql).toContain('f.forecast_year=any($1::int[])'); expect(params).toEqual([[2026, 2027]]);
      expect(sql).not.toContain('crm_retail_pool_memberships');
      return { rows: [
        { id: 'planned', owner_user_id: 'owner-id', musteri: 'Same name', sektor: 'Live sector', sorumlu: 'Live owner', satici_etiketi: 'farmer', kasapos_firmasi: 'Enpos', sabit_kasa_adedi: '120', faz: 'POC', pos_markasi: 'PAX', pos_mulkiyet: 'Firma', pos_mulkiyet_bankalari: ['Bank'], bankalar: ['Bank'], forecast_years: [2026, 2027] },
        { id: 'new-customer', musteri: 'Same name', satici_etiketi: null, kasapos_firmasi: 'Univera', sabit_kasa_adedi: 'Bilinmiyor', faz: 'Sipariş', forecast_years: null },
      ] };
    });
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.crm).toHaveLength(2);
    expect(result.crm[0]).toMatchObject({ id: 'planned', customerId: 'planned', ownerUserId: 'owner-id', status: 'Farmer', phase: 'POC', kasa: 'Enpos', rawKasa: 'Enpos', register: 120, pos: 'PAX', posOwner: 'Firma - Bank', banks: 'Bank', hasForecast: true, forecastYears: [2026, 2027] });
    expect(result.crm[1]).toMatchObject({ id: 'new-customer', status: 'Girilmedi', phase: 'Sipariş', kasa: 'Univera', register: null, hasForecast: false });
  });
});
