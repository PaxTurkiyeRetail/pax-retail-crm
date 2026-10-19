import { describe, expect, it } from 'vitest';
import { compileReport } from './compiler';
import { DATASETS, datasetCatalog } from './datasets';
import { parseReportDefinition } from './types';
import { RENTAL_OPS_STATUSES } from '@/lib/sales/rental-ops';

const scope = { kind: 'own', userId: 'record-owner', email: 'owner@example.test', fullName: 'Owner' } as const;

describe('existing record details in the report field catalog', () => {
  it.each([
    ['sales', 'sale_count', 'rental_start_date', '2026-10-01'],
    ['sales', 'sale_count', 'rental_end_date', '2026-10-31'],
    ['sales', 'sale_count', 'rental_ops_status', 'aktif'],
    ['sale_items', 'line_count', 'is_recurring', false],
    ['forecast', 'line_count', 'sale_type', 'rental'],
    ['forecast', 'line_count', 'include_in_retail_plan', true],
    ['quotes', 'quote_count', 'valid_until', '2026-10-31'],
    ['customers', 'customer_count', 'pipeline_policy', 'phase_optional'],
  ] as const)('supports %s / %s / %s filtering and grouping', (dataset, measure, field, value) => {
    const definition = parseReportDefinition({
      dataset, measures: [measure], dimensions: [{ field }], filters: [{ field, op: 'eq', value }],
    });
    const compiled = compileReport(definition, { scope, today: '2026-10-19' });
    expect(compiled.params).toContain(value);
    expect(compiled.params).toContain(scope.userId);
    expect(compiled.columns.find(column => column.sourceField === field)?.role).toBe('dimension');
    expect(DATASETS[dataset].dimensions[field].description).toBeTruthy();
    const exposed = datasetCatalog(() => true).find(source => source.key === dataset);
    expect(exposed?.dimensions.some(dimension => dimension.key === field)).toBe(true);
  });

  it('uses canonical rental operation values and retains mixed sales', () => {
    expect(DATASETS.sales.dimensions.rental_ops_status.options).toEqual(RENTAL_OPS_STATUSES.map(status => status.value));
    expect(DATASETS.sales.dimensions.sale_type.options).toContain('mixed');
    expect(DATASETS.sales.baseWhere).toEqual(["s.status = 'active'"]);
    expect(DATASETS.forecast.baseWhere).toEqual(['f.is_active = true']);
    expect(DATASETS.sale_items.dimensions.is_recurring.sql).toBe('i.is_recurring');
    expect(DATASETS.forecast.dimensions.include_in_retail_plan.sql).toBe('f.include_in_retail_plan');
  });
});
