import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { query, kasapos } = vi.hoisted(() => ({ query: vi.fn(), kasapos: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
vi.mock('./kasapos-entegrasyon', () => ({ buildKasaposEntegrasyonRaporu: kasapos }));

import { buildRetailOperasyon } from './retail-operasyon';
import { computeKasaposEntegrasyon } from './kasapos-entegrasyon-shared';

describe('Retail KasaPOS monthly reconciliation', () => {
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [] });
    kasapos.mockReset();
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

  it('keeps USD invoice quantities separate and preserves the forecast product identity', async () => {
    kasapos.mockResolvedValue(computeKasaposEntegrasyon(2026, [], []));
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('extract(month from s.sale_date)')) {
        expect(sql).toMatch(/sum\(i.quantity\) filter \(where s.currency = 'USD'\)/);
        return { rows: [
          { firm: 'Mixed', product_code: 'A80', ay: 1, qty: 12, usd_qty: 2, usd: 300, sale_type: 'sale' },
          { firm: 'TRY only', product_code: 'A35', ay: 2, qty: 5, usd_qty: 0, usd: 0, sale_type: 'sale' },
        ] };
      }
      if (sql.includes('from public.crm_forecasts f')) return { rows: [{
        forecast_year: 2027, forecast_month: 3, firm: 'Mixed', model: 'PAX A80', quantity: 2,
        id: 'forecast-id', customer_id: 'customer-id', product_id: 'product-id',
      }] };
      return { rows: [] };
    });
    const result = await buildRetailOperasyon({ year: 2026 });
    expect(result.sales[0]).toMatchObject({ qty: 12, usdQty: 2, usd: 300 });
    expect(result.sales[1]).toMatchObject({ qty: 5, usdQty: 0, usd: 0 });
    expect(result.opportunities.next[0]).toMatchObject({ model: 'PAX A80', productId: 'product-id' });
  });
});
