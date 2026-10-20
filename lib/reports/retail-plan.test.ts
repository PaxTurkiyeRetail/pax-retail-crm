import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
import { canEditRetailPlan, createRetailPlan, loadRetailPlan, patchRetailPlan, retailPlanCreateSchema, retailPlanPatchSchema } from './retail-plan';

const entry = { id: 'entry', reference_key: 'reference', source_name: 'Retail_2026_2027.html', plan_year: 2027, plan_month: 3, customer_id: null, firm_name: 'Çetinkaya', product_code: 'A80', quantity: 500, business_model: 'bank', probability: 30, note: 'Kaynak', unit_price: null, rental_monthly_price: null, is_active: true, updated_at: '2026-10-19 12:00:00+03' };
beforeEach(() => query.mockReset().mockResolvedValue({ rows: [entry] }));

describe('separate Retail plan persistence', () => {
  it('loads only requested active plan years and preserves bank origin without using Forecast', async () => {
    const result = await loadRetailPlan([2026, 2027]);
    expect(result.get(2026)).toEqual([]);
    expect(result.get(2027)?.[0]).toMatchObject({ firm: 'Çetinkaya', qty: 500, month: 3, source: 'retail_plan', businessModel: 'bank', saleType: 'bank', updatedAt: entry.updated_at, sourceName: entry.source_name });
    const [sql, parameters] = query.mock.calls[0];
    expect(sql).toContain('public.crm_retail_plan_entries');
    expect(sql).toContain('is_active=true');
    expect(sql).not.toContain('crm_forecasts');
    expect(parameters).toEqual([[2026, 2027]]);
  });
  it('does not allow read or own Forecast rights to mutate a global plan', async () => {
    expect(canEditRetailPlan({ permissions: ['forecast.write.own', 'report.read.all'] })).toBe(false);
    await expect(patchRetailPlan({ id: 'user', permissions: ['forecast.write.own'] }, 'entry', { expectedUpdatedAt: entry.updated_at, quantity: 20 })).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
  });
  it('updates only the separate plan with optimistic locking and bound values', async () => {
    const input = retailPlanPatchSchema.parse({ expectedUpdatedAt: entry.updated_at, planMonth: 4, note: "' ; select secret --" });
    await patchRetailPlan({ id: 'user', permissions: ['forecast.write.any'] }, 'entry', input);
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('updated_at=$2::timestamptz');
    expect(sql).not.toContain('crm_forecasts');
    expect(sql).not.toContain('select secret');
    expect(sql).not.toContain('reference_snapshot=');
    expect(values).toEqual(['entry', entry.updated_at, 'user', 4, input.note]);
  });
  it('returns a conflict instead of overwriting a newer user edit', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(patchRetailPlan({ id: 'user', permissions: ['forecast.write.any'] }, 'entry', { expectedUpdatedAt: entry.updated_at, quantity: 20 })).rejects.toMatchObject({ status: 409 });
  });
  it('rejects unsupported source fields and invalid quantities/months', () => {
    for (const patch of [{ customerId: 'other' }, { referenceSnapshot: {} }, { quantity: -1 }, { planMonth: 13 }, { businessModel: 'other' }]) {
      expect(retailPlanPatchSchema.safeParse({ expectedUpdatedAt: entry.updated_at, ...patch }).success).toBe(false);
    }
  });
});

describe('manual plans stay inside the separate Retail plan source', () => {
  const customerId = '00000000-0000-4000-8000-000000000001';
  const productId = '00000000-0000-4000-8000-000000000002';
  const input = { customerId, productCode: 'A80', quantity: 12, planYear: 2027, planMonth: 5, businessModel: 'rental' as const, probability: 60, note: "Plan ' metni", unitPrice: null, rentalMonthlyPrice: 15 };
  const user = { id: 'user', permissions: ['forecast.write.any'] as const };

  it('denies readers and own-only writers before any catalog or membership query', async () => {
    for (const permissions of [['report.read.all'], ['forecast.write.own']] as const) {
      await expect(createRetailPlan({ id: 'user', permissions }, input)).rejects.toMatchObject({ status: 403 });
    }
    expect(query).not.toHaveBeenCalled();
  });
  it('requires existing pool membership without trusting client labels or department guesses', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(createRetailPlan(user, input)).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('public.crm_retail_pool_memberships');
    expect(query.mock.calls[0][0]).not.toContain("is_kolu='Retail'");
    expect(query.mock.calls[0][1]).toEqual([customerId]);
  });
  it.each([{ products: [] }, { products: [{ id: productId }, { id: 'other' }] }])('rejects absent or ambiguous catalog codes', async ({ products }) => {
    query.mockResolvedValueOnce({ rows: [{ customer_id: customerId }] }).mockResolvedValueOnce({ rows: products });
    await expect(createRetailPlan(user, input)).rejects.toMatchObject({ status: 400 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('public.quote_products');
    expect(query.mock.calls[1][0]).toContain('is_active=true');
  });
  it('inserts a manual source row with server labels/product snapshot and returns it for reload', async () => {
    query.mockResolvedValueOnce({ rows: [{ customer_id: customerId }] })
      .mockResolvedValueOnce({ rows: [{ id: productId, product_code: 'A80' }] })
      .mockResolvedValueOnce({ rows: [{ ...entry, reference_key: 'retail-manual:new-id', source_name: 'CRM Retail planı', customer_id: customerId, firm_name: 'Server membership label', product_code: 'A80', quantity: 12, plan_month: 5, business_model: 'rental', rental_monthly_price: '15' }] });
    const result = await createRetailPlan(user, input);
    expect(result).toMatchObject({ customerId, firm: 'Server membership label', model: 'A80', qty: 12, month: 5, businessModel: 'rental', source: 'retail_plan', sourceName: 'CRM Retail planı', updatedAt: entry.updated_at, rentalMonthlyPrice: 15 });
    const [sql, values] = query.mock.calls[2];
    expect(sql).toContain('insert into public.crm_retail_plan_entries');
    expect(sql).toContain('member.reference_name');
    expect(sql).toContain("'kind','manual'");
    expect(sql).toContain('product.is_active=true');
    expect(sql).not.toContain('crm_forecasts');
    expect(sql).not.toContain(input.note);
    expect(values[1]).toMatch(/^retail-manual:[0-9a-f-]{36}$/);
    expect(values).toEqual([customerId, expect.any(String), 2027, 5, 12, 'rental', 60, input.note, null, 15, 'user', productId, 'A80']);
  });
  it('fails closed if membership or active product changes before insertion', async () => {
    query.mockResolvedValueOnce({ rows: [{ customer_id: customerId }] }).mockResolvedValueOnce({ rows: [{ id: productId }] }).mockResolvedValueOnce({ rows: [] });
    await expect(createRetailPlan(user, input)).rejects.toMatchObject({ status: 409 });
  });
  it('validates camel-case inputs and rejects forged source fields and unsupported model strings', () => {
    expect(retailPlanCreateSchema.parse({ ...input, productCode: ' a80 ' }).productCode).toBe('A80');
    for (const patch of [{ quantity: 0 }, { customerId: 'invalid' }, { productCode: "x');delete" }, { planMonth: 13 }, { planYear: 2101 }, { probability: 101 }, { firmName: 'Forged' }, { referenceSnapshot: {} }]) {
      expect(retailPlanCreateSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });
});
