import { describe, expect, it } from 'vitest';
import { getDataset, datasetCatalog } from './datasets';
import { compileReport } from './compiler';
import { reportDefinitionSchema } from './types';
import { getPageTemplate } from './templates';
import { isDataWidget } from './page-types';

describe('KasaPOS operational snapshot semantic contract', () => {
  it('aggregates invoices before joining one canonical customer and one current stock row', () => {
    const ds = getDataset('kasapos_snapshot')!;
    expect(ds.from).toContain('with monthly as');
    expect(ds.from).toContain("group by s.customer_id, date_trunc('month', s.period_month)::date");
    expect(ds.from).toContain('select distinct customer_id from monthly');
    expect(ds.from).toContain('order by mk.updated_at desc nulls last limit 1');
    expect(ds.from).toContain("where s.currency = 'USD'");
    expect(ds.measures.utilization_pct.sql).toContain('where stock.active_registers is not null');
    expect(ds.measures.potential_monthly_usd.sql).toContain('snapshot.unit_price is not null');
    expect(ds.measures.known_price_count.sql).toContain('stock.active_registers is not null and snapshot.unit_price is not null');
  });

  it('applies canonical customer owner scope with parameter binding', () => {
    const query = reportDefinitionSchema.parse({ dataset: 'kasapos_snapshot', measures: ['active_registers', 'billed_registers'], dimensions: [{ field: 'customer' }] });
    const compiled = compileReport(query, { today: '2026-10-19', scope: { kind: 'own', userId: 'user-123', email: 'test@example.com', fullName: 'Test Owner' } });
    expect(compiled.sql).toContain('m.owner_user_id::text');
    expect(compiled.params).toContain('user-123');
    expect(compiled.params).toContain('Test Owner');
    expect(compiled.sql).not.toContain('user-123');
    expect(datasetCatalog(() => false)).toEqual([]);
  });

  it('keeps current stock sections independent from historical page date filters', () => {
    const sections = getPageTemplate('kasapos_monthly')!.widgets.filter(isDataWidget).filter((w) => w.query.dataset === 'kasapos_snapshot');
    expect(sections).toHaveLength(2);
    for (const section of sections) {
      expect(section.ignorePageFilters).toBe(true);
      expect(section.query.dateRange).toBeUndefined();
      expect(section.query.measures).toContain('known_price_count');
      expect(() => compileReport(section.query, { today: '2026-10-19', scope: { kind: 'all' } })).not.toThrow();
    }
  });
});
