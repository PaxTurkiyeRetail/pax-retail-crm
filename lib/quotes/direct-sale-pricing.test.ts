import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query, catalog } = vi.hoisted(() => ({ query: vi.fn(), catalog: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
vi.mock('@/lib/pg/admin', () => ({ createPgAdminClient: () => ({}) }));
vi.mock('@/lib/quotes/service', async (importOriginal) => ({
  ...await importOriginal<typeof import('./service')>(), getQuoteCatalog: catalog,
}));
import { createDirectSale } from './sales-service';

const product = { id: 'im30', code: 'IM30', name: 'PAX IM30', product_type: 'device', category: 'EFT POS', is_recurring: false, billing_period: 'one_time' };
const actor = { id: 'seller', name: 'Seller', email: 'seller@example.test' };
const input = { customerId: 'customer', saleDate: '2026-10-15', lines: [{ product_id: 'im30', quantity: 500, manual_unit_price: 290 }] };
beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [{ id: 'sale-id' }] });
  catalog.mockReset().mockResolvedValue({ products: [product], rules: [] });
});

describe('direct sale unit price override', () => {
  it('saves 500 × 290 without a catalog tier and persists the line amounts', async () => {
    const result = await createDirectSale(actor, input, { allowManualPrice: true });
    expect(result).toMatchObject({ amount: 145000, deviceCount: 500, priceSource: 'manual' });
    const header = query.mock.calls.find(([sql]) => sql.includes('insert into public.crm_sales'));
    expect(header?.[1][6]).toBe(145000);
    expect(header?.[1][7]).toBe(145000);
    const item = query.mock.calls.find(([sql]) => sql.includes('insert into public.crm_sale_items'));
    expect(item?.[1].slice(7, 11)).toEqual([500, 'sale', 290, 145000]);
  });

  it('rejects an unauthorized override before writing anything', async () => {
    await expect(createDirectSale(actor, input)).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports the missing tier as an actionable validation error without writing', async () => {
    await expect(createDirectSale(actor, { ...input, lines: [{ product_id: 'im30', quantity: 500 }] })).rejects.toMatchObject({ status: 400, code: 'PRICE_RULE_NOT_FOUND' });
    expect(query).not.toHaveBeenCalled();
  });

  it('continues using the catalog when no override is entered', async () => {
    catalog.mockResolvedValue({ products: [product], rules: [{ product_id: 'im30', min_qty: 1, max_qty: null, unit_price: 350 }] });
    const result = await createDirectSale(actor, { ...input, lines: [{ product_id: 'im30', quantity: 500 }] });
    expect(result).toMatchObject({ amount: 175000, priceSource: 'catalog' });
  });
});
