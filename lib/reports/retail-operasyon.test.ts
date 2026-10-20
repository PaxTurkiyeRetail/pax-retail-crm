import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { query, kasapos, retailPlan } = vi.hoisted(() => ({ query: vi.fn(), kasapos: vi.fn(), retailPlan: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
vi.mock('./kasapos-entegrasyon', () => ({ buildKasaposEntegrasyonRaporu: kasapos }));
vi.mock('./retail-plan', () => ({ loadRetailPlan: retailPlan }));

import { buildRetailOperasyon } from './retail-operasyon';
import { computeKasaposEntegrasyon } from './kasapos-entegrasyon-shared';

describe('Retail KasaPOS monthly reconciliation', () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
    kasapos.mockReset();
    retailPlan.mockReset().mockResolvedValue(new Map());
  });

  it('preserves missing invoice months and reconciles firm totals to monthly totals', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [
      { customerId: 'a', ay: 1, adet: 10, tutar: 50.25 },
      { customerId: 'a', ay: 3, adet: 15, tutar: 75.5 },
      { customerId: 'b', ay: 2, adet: 4, tutar: 20 },
    ], ['a', 'b'].map((id) => ({
      customerId: id, musteri: id, sorumlu: null, aktifKasa: 20,
      aktifKasaUpdatedAt: null, aktifKasaUpdatedBy: null,
    }))));

    const result = await buildRetailOperasyon({ year: 2026 });
    const firm = result.kasapos.rows.find((row) => row.firm === 'a')!;
    expect(firm.monthly).toEqual([
      { month: '2026-01-01', billed: 10, usd: 50.25 },
      null,
      { month: '2026-03-01', billed: 15, usd: 75.5 },
    ]);
    expect(firm).toMatchObject({ billed: 15, gap: 5, yearBilled: 25, totalUsd: 125.75 });
    expect(result.kasapos.rows.reduce((sum, row) => sum + (row.totalUsd ?? 0), 0))
      .toBe(result.kasapos.monthly.reduce((sum, month) => sum + month.usd, 0));
    expect(result.kasapos.rows.reduce((sum, row) => sum + (row.yearBilled ?? 0), 0))
      .toBe(result.kasapos.monthly.reduce((sum, month) => sum + month.billed, 0));
  });

  it('keeps an empty year empty without inventing historical figures', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2027, [], []));
    const result = await buildRetailOperasyon({ year: 2027 });
    expect(result.kasapos.rows).toEqual([]);
    expect(result.kasapos.monthly).toEqual([{ month: '2027-01-01', billed: 0, usd: 0 }]);
    expect(result.kasapos.aylikGelir).toBe(0);
    expect(result.opportunities).toEqual({ current: [], next: [] });
  });

  it('loads only separate Retail plans and preserves bank, rental and reference fields by year', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
    const rental = { id: 'rental-plan', firm: 'E-Bebek', model: 'A80', qty: 1300, month: 12, channel: 'Retail Planı', prob: 60, note: 'Reference', owner: '', saleType: 'rental', businessModel: 'rental', source: 'retail_plan', rentalMonthlyPrice: 15, includeInRetailPlan: true, referenceKey: '2026-ebebek', sourceName: 'Approved reference', updatedAt: '2026-10-19' };
    const bank = { id: 'bank-plan', customerId: 'canonical-customer', firm: 'Çetinkaya', model: 'A80', qty: 500, month: 3, channel: 'Banka', prob: 30, note: '', owner: '', saleType: 'bank', businessModel: 'bank', source: 'retail_plan', includeInRetailPlan: true, referenceKey: '2027-cetinkaya' };
    retailPlan.mockResolvedValue(new Map([[2026, [rental]], [2027, [bank]]]));
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(retailPlan).toHaveBeenCalledWith([2026, 2027]);
    expect(result.opportunities.current).toEqual([rental]);
    expect(result.opportunities.next).toEqual([bank]);
    expect(query.mock.calls.some(([sql]) => sql.includes('crm_forecasts'))).toBe(false);
  });

  it('keeps missing separate plans empty rather than substituting global Forecast rows', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
    query.mockImplementation(async (sql: string) => ({ rows: sql.includes('crm_forecasts') ? [{ quantity: 99999 }] : [] }));
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.opportunities).toEqual({ current: [], next: [] });
    expect(query.mock.calls.some(([sql]) => sql.includes('crm_forecasts'))).toBe(false);
  });
  it('keeps USD invoice quantities separate and preserves the Retail plan product identity', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('extract(month from s.sale_date)')) {
        expect(sql).toMatch(/sum\(i.quantity\) filter \(where s.currency = 'USD'\)/);
        return { rows: [
          { firm: 'Mixed', product_code: 'A80', ay: 1, qty: 12, usd_qty: 2, usd: 300, sale_type: 'sale' },
          { firm: 'TRY only', product_code: 'A35', ay: 2, qty: 5, usd_qty: 0, usd: 0, sale_type: 'sale' },
        ] };
      }
      return { rows: [] };
    });
    retailPlan.mockResolvedValue(new Map([[2027, [{ id: 'plan-id', customerId: 'customer-id', productId: 'product-id', firm: 'Mixed', model: 'PAX A80', qty: 2, month: 3, channel: 'Retail Planı', prob: 30, note: '', owner: '', source: 'retail_plan', businessModel: 'sale', saleType: 'sale' }]]]));
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.sales[0]).toMatchObject({ qty: 12, usdQty: 2, usd: 300 });
    expect(result.sales[1]).toMatchObject({ qty: 5, usdQty: 0, usd: 0 });
    expect(result.opportunities.next[0]).toMatchObject({ model: 'PAX A80', productId: 'product-id' });
  });
});



describe('Retail explicit CRM pool', () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
    kasapos.mockReset().mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
    retailPlan.mockReset().mockResolvedValue(new Map());
  });
  it('uses canonical memberships across departments and keeps report categories separate from live attributes', async () => {
    query.mockImplementation(async (sql: string) => {
      if (!sql.includes('from public.crm_retail_pool_memberships rpm')) return { rows: [] };
      expect(sql).toContain('join public.musteriler m on m.id = rpm.customer_id');
      expect(sql).not.toContain("where m.is_kolu = 'Retail'");
      return { rows: [
        { id: 'vertical-canonical', musteri: 'Same name', sektor: 'Live sector', sorumlu: 'Live owner', retail_status: 'Hunter', register_vendor_group: 'Inhouse', kasapos_firmasi: 'Enpos', sabit_kasa_adedi: '120', faz: 'POC', pos_markasi: 'PAX', pos_mulkiyet: 'Firma', pos_mulkiyet_bankalari: ['Bank'], bankalar: ['Bank'] },
        { id: 'retail-canonical', musteri: 'Same name', retail_status: 'Kasa', register_vendor_group: 'Nebim', kasapos_firmasi: 'Nebim', sabit_kasa_adedi: 'Bilinmiyor', faz: 'Sipariş' },
      ] };
    });
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.crm).toHaveLength(2);
    expect(result.crm[0]).toMatchObject({ id: 'vertical-canonical', customerId: 'vertical-canonical', name: 'Same name', status: 'Hunter', phase: 'POC', kasa: 'Inhouse', rawKasa: 'Enpos', sector: 'Live sector', owner: 'Live owner', register: 120, pos: 'PAX', posOwner: 'Firma - Bank', banks: 'Bank' });
    expect(result.crm[1]).toMatchObject({ id: 'retail-canonical', customerId: 'retail-canonical', status: 'Kasa', phase: 'Sipariş', register: null });
  });
  it('returns an empty CRM pool without querying global department membership when the cohort is empty', async () => {
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.crm).toEqual([]);
    const crmQueries = query.mock.calls.filter(([sql]) => sql.includes('musteri_kunye_v2'));
    expect(crmQueries).toHaveLength(1);
    expect(crmQueries[0][0]).toContain('crm_retail_pool_memberships');
    expect(crmQueries[0][0]).not.toContain("where m.is_kolu = 'Retail'");
  });
});
