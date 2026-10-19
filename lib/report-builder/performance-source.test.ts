import { describe, expect, it } from 'vitest';
import { compileReport } from '@/lib/report-builder/compiler';
import { DATASETS, datasetCatalog } from '@/lib/report-builder/datasets';
import { parseReportDefinition } from '@/lib/report-builder/types';

const compile = (extra: Record<string, unknown> = {}) => compileReport(parseReportDefinition({
  dataset: 'performance_comparison',
  measures: ['actual_quantity', 'target_quantity', 'forecast_quantity', 'quantity_gap', 'usd_achievement'],
  dimensions: [{ field: 'owner' }, { field: 'month', grain: 'month' }],
  ...extra,
}), { scope: { kind: 'own', userId: 'user-1', email: 'owner@example.test', fullName: 'Owner' }, today: '2026-10-19' });

describe('actual / target / forecast common grain', () => {
  it('requires all source permissions before appearing in the catalog', () => {
    const has = (permissions: string[]) => datasetCatalog((p) => permissions.includes(p)).some((d) => d.key === 'performance_comparison');
    expect(has(['report.performance.read', 'quote.read', 'forecast.read'])).toBe(true);
    for (const missing of ['report.performance.read', 'quote.read', 'forecast.read']) {
      expect(has(['report.performance.read', 'quote.read', 'forecast.read'].filter((p) => p !== missing))).toBe(false);
    }
  });

  it('compiles combined metrics with parameterized own scope after independent fact branches', () => {
    const query = compile();
    expect(query.sql).toContain('union all');
    expect(query.sql).toContain('pc.owner_user_id');
    expect(query.params).toContain('user-1');
    expect(query.sql).not.toContain("= 'user-1'");
    expect(query.sql).toContain("s.currency = 'USD'");
    expect(query.sql).toContain("i.sale_type is distinct from 'rental'");
    expect(query.sql).toContain('nullif(sum(pc.target_usd), 0)');
  });

  it('rejects customer/model/day target slicing and invented forecast USD', () => {
    for (const field of ['customer', 'product', 'department']) {
      expect(() => compile({ dimensions: [{ field }] })).toThrow(/Bilinmeyen alan/);
    }
    expect(() => compile({ dimensions: [{ field: 'month', grain: 'day' }] })).toThrow(/desteklenmiyor/);
    expect(() => compile({ measures: ['forecast_usd'] })).toThrow(/Bilinmeyen ölçü/);
  });

  it('keeps missing targets null and selects one user allocation per owner/month/code', () => {
    const source = DATASETS.performance_comparison;
    expect(source.measures.target_quantity.sql).toBe('sum(pc.target_quantity)');
    expect(source.from).toContain("tv.scope_type = 'user'");
    expect(source.from).toContain('partition by tv.scope_user_id, td.code, g.month');
    expect(source.from).toContain("when 'quarter' then 3 when 'year' then 12");
    expect(source.from).toContain('where t.priority = 1');
    expect(source.from).not.toMatch(/join public\.crm_forecasts/);
  });
});
