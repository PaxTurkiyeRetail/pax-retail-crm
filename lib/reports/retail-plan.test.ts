import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { query } }));
import { canEditRetailPlan, loadRetailPlan, patchRetailPlan, retailPlanPatchSchema } from './retail-plan';

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
