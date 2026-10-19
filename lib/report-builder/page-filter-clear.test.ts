import { describe, expect, it } from 'vitest';
import { applyPageFilters, type PageFilter } from './page-types';
import { reportDefinitionSchema } from './types';

const base = () => reportDefinitionSchema.parse({
  dataset: 'sales', measures: ['device_count'],
  dateRange: { type: 'relative', preset: 'this_year', field: 'sale_date' },
  compare: 'previous_period',
});
const period: PageFilter = { key: 'period', label: 'Dönem', kind: 'date_range' };
const hasField = (field: string) => field === 'sale_date';

describe('page date filter clearing', () => {
  it('clears the embedded range and comparison for explicit all dates, overriding defaults', () => {
    const query = base();
    const result = applyPageFilters(query, [{ ...period, defaultValue: 'this_month' }], { period: '' }, hasField);
    expect(result.dateRange).toBeUndefined();
    expect(result.compare).toBe('none');
    expect(query.dateRange).toEqual({ type: 'relative', preset: 'this_year', field: 'sale_date' });
    expect(query.compare).toBe('previous_period');
  });

  it('retains the embedded range and comparison when the value is absent', () => {
    const query = base();
    const result = applyPageFilters(query, [period], {}, hasField);
    expect(result.dateRange).toEqual(query.dateRange);
    expect(result.compare).toBe('previous_period');
  });

  it('uses the filter default when the value is absent', () => {
    const result = applyPageFilters(base(), [{ ...period, defaultValue: 'this_month' }], {}, hasField);
    expect(result.dateRange).toEqual({ type: 'relative', preset: 'this_month', field: 'sale_date' });
    expect(result.compare).toBe('previous_period');
  });

  it('applies an explicit relative range', () => {
    const result = applyPageFilters(base(), [period], { period: 'last_month' }, hasField);
    expect(result.dateRange).toEqual({ type: 'relative', preset: 'last_month', field: 'sale_date' });
    expect(result.compare).toBe('previous_period');
  });

  it('applies an explicit absolute range', () => {
    const result = applyPageFilters(base(), [period], { period: { from: '2026-10-01', to: '2026-10-19' } }, hasField);
    expect(result.dateRange).toEqual({ type: 'absolute', from: '2026-10-01', to: '2026-10-19', field: 'sale_date' });
    expect(result.compare).toBe('previous_period');
  });
});
