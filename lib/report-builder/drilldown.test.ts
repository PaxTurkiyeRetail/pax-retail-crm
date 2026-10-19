import { describe, expect, it } from 'vitest';
import { grainRange, prepareDrilldown } from './drilldown';
import { parseReportDefinition } from './types';
import type { ReportUser } from './access';
const user: ReportUser = { id: 'person', email: 'person@example.test', full_name: 'Person', permissions: ['report.read.own', 'quote.read'] };
const definition = parseReportDefinition({ dataset: 'sales', measures: ['sale_count'], dimensions: [{ field: 'sale_date', grain: 'month' }, { field: 'owner' }], filters: [{ field: 'currency', op: 'eq', value: 'USD' }] });
describe('drilldown scope and grouped constraints', () => {
  it('retains scope, original filters, and expands grouped month', () => {
    const result = prepareDrilldown(definition, { d_sale_date_month: '2026-02-01', d_owner: 'Person' }, user);
    expect(result.scope).toEqual({ kind: 'own', userId: user.id, email: user.email, fullName: user.full_name });
    expect(result.definition.filters).toEqual([...definition.filters, { field: 'sale_date', op: 'between', value: ['2026-02-01', '2026-02-28'] }, { field: 'owner', op: 'eq', value: 'Person' }]);
    expect(result.definition.compare).toBe('none');
  });
  it('rejects missing builder or dataset access', () => {
    for (const permissions of [[], ['quote.read'], ['report.read.all']] as ReportUser['permissions'][]) expect(() => prepareDrilldown(definition, {}, { ...user, permissions })).toThrow('FORBIDDEN');
  });
  it('rejects malicious fields and missing row constraints', () => {
    expect(() => prepareDrilldown({ ...definition, dimensions: [{ field: 'owner); drop table users' }] }, {}, user)).toThrow();
    expect(() => prepareDrilldown(definition, { d_owner: 'Person' }, user)).toThrow('Kırılım değeri eksik');
    expect(() => prepareDrilldown(definition, { d_sale_date_month: '2026-02-30', d_owner: 'Person' }, user)).toThrow();
  });
  it('supports KPI without grouped dimensions', () => {
    expect(prepareDrilldown({ ...definition, dimensions: [] }, {}, user).definition.filters).toEqual(definition.filters);
  });
});
describe('date grains', () => {
  it.each([
    ['day', '2026-10-19', '2026-10-19'], ['week', '2026-10-19', '2026-10-25'],
    ['month', '2026-10-01', '2026-10-31'], ['quarter', '2026-10-01', '2026-12-31'], ['year', '2026-01-01', '2026-12-31'],
  ] as const)('%s produces inclusive absolute bounds', (grain, from, to) => expect(grainRange('2026-10-19', grain)).toEqual({ from, to }));
});

describe('comparison dataset permission and monthly boundary guards', () => {
  const comparison = parseReportDefinition({ dataset: 'performance_comparison', measures: ['actual_quantity'], dateRange: { type: 'absolute', from: '2026-10-01', to: '2026-10-31' } });
  const allPermissions: ReportUser['permissions'] = ['report.read.own', 'report.performance.read', 'quote.read', 'forecast.read'];
  it('requires every underlying dataset permission', () => {
    for (const missing of ['report.performance.read', 'quote.read', 'forecast.read']) {
      expect(() => prepareDrilldown(comparison, {}, { ...user, permissions: allPermissions.filter(p => p !== missing) })).toThrow('FORBIDDEN');
    }
    expect(prepareDrilldown(comparison, {}, { ...user, permissions: allPermissions }).definition.dimensions).toContainEqual({ field: 'month', grain: 'month' });
  });
  it.each([['2026-10-02', '2026-10-31'], ['2026-10-01', '2026-10-19'], ['2026-10-02', '2026-10-19']])('rejects partial monthly range %s to %s', (from, to) => {
    expect(() => prepareDrilldown({ ...comparison, dateRange: { type: 'absolute', from, to } }, {}, { ...user, permissions: allPermissions })).toThrow('tam ay');
  });
});

describe('aggregate filter granularity', () => {
  it('validates HAVING at original grouping and keeps only row filters for detail', () => {
    const filtered = parseReportDefinition({ ...definition, filters: [...definition.filters, { field: 'sale_count', op: 'gt', value: 10 }] });
    const prepared = prepareDrilldown(filtered, { d_sale_date_month: '2026-02-01', d_owner: 'Person' }, user);
    expect(prepared.validationDefinition?.dimensions).toEqual(filtered.dimensions);
    expect(prepared.validationDefinition?.filters).toContainEqual({ field: 'sale_count', op: 'gt', value: 10 });
    expect(prepared.validationDefinition?.limit).toBe(1);
    expect(prepared.definition.filters).not.toContainEqual({ field: 'sale_count', op: 'gt', value: 10 });
    expect(prepared.definition.filters).toEqual([...definition.filters, { field: 'sale_date', op: 'between', value: ['2026-02-01', '2026-02-28'] }, { field: 'owner', op: 'eq', value: 'Person' }]);
    expect(prepared.definition.dimensions).toContainEqual({ field: 'sale_id' });
  });
});
