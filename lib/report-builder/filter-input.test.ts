import { describe, expect, it } from 'vitest';
import { compileReport } from './compiler';
import { changeFilterOperator, definitionFilterIssue, filterInputIssue, normalizeDefinitionFilters } from './filter-input';
import { parseReportDefinition, type ReportFilter } from './types';

const base = { dataset: 'sales', measures: ['device_count'] };
const options = { scope: { kind: 'all' as const }, today: '2026-10-19' };

describe('report filter editor transitions', () => {
  it('converts a date scalar into a list when operator switches without losing date', () => {
    const filter = changeFilterOperator({ field: 'sale_date', op: 'eq', value: '2026-10-01' }, 'in');
    expect(filter.value).toEqual(['2026-10-01']);
    expect(filterInputIssue(filter)).toBeNull();
    const compiled = compileReport(parseReportDefinition({ ...base, filters: [filter] }), options);
    expect(compiled.params).toContainEqual(['2026-10-01']);
    expect(compiled.sql).toContain('date[]');
    expect(changeFilterOperator(filter, 'eq').value).toBe('2026-10-01');
  });

  it('requires both range endpoints before querying, then compiles parameterized dates', () => {
    const filter = changeFilterOperator({ field: 'sale_date', op: 'eq', value: '2026-10-01' }, 'between');
    expect(filterInputIssue(filter)).toContain('başlangıç ve bitiş');
    const complete: ReportFilter = { ...filter, value: ['2026-10-01', '2026-10-31'] };
    expect(filterInputIssue(complete)).toBeNull();
    const compiled = compileReport(parseReportDefinition({ ...base, filters: [complete] }), options);
    expect(compiled.params).toContain('2026-10-01');
    expect(compiled.params).toContain('2026-10-31');
    expect(compiled.sql).not.toContain('2026-10-01');
    expect(filterInputIssue({ ...complete, value: ['2026-10-31', '2026-10-01'] })).toContain('önce olamaz');
  });

  it('recovers saved legacy scalar lists without discarding constraints', () => {
    const restored = normalizeDefinitionFilters({ ...base, filters: [{ field: 'sale_date', op: 'between' as const, value: '2026-10-01, 2026-10-31' }] });
    expect(restored.filters[0].value).toEqual(['2026-10-01', '2026-10-31']);
    expect(definitionFilterIssue(restored)).toBeNull();
    expect(() => compileReport(parseReportDefinition(restored), options)).not.toThrow();
  });

  it('does not silently discard incomplete filters or falsy valid values', () => {
    expect(definitionFilterIssue({ ...base, filters: [{ field: 'sale_date', op: 'in', value: [] }] })).toContain('en az bir');
    expect(filterInputIssue({ field: 'device_count', op: 'eq', value: 0 })).toBeNull();
    expect(filterInputIssue({ field: 'x', op: 'eq', value: false })).toBeNull();
    expect(changeFilterOperator({ field: 'x', op: 'eq', value: 'old' }, 'is_null').value).toBeUndefined();
  });
});
