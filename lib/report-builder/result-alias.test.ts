import { describe, expect, it } from 'vitest';
import { compileReport } from './compiler';
import { matchConditionalRule, pivot, resolvePivotColumn, resolveResultColumn, mergeCompare } from './result';
import { parseReportDefinition, type ColumnMeta, type ConditionalRule } from './types';
import { ruleColor } from '@/app/(panel)/crm/report-builder/_components/renderers/tokens';
import { matchConditionalRule as pdfRuleColor } from './pdf';

const options = { scope: { kind: 'all' as const }, today: '2026-10-19' };

describe('semantic fields and result aliases', () => {
  it('pivots actual compiler monthly invoice aliases using the saved semantic field', () => {
    const compiled = compileReport(parseReportDefinition({ dataset: 'service_invoice_items', measures: ['quantity'], dimensions: [{ field: 'customer' }, { field: 'period_month', grain: 'month' }] }), options);
    const date = resolvePivotColumn(compiled.columns, 'period_month')!;
    expect(date.key).toBe('d_period_month_month');
    const measure = compiled.columns.find((column) => column.role === 'measure')!;
    const customer = resolveResultColumn(compiled.columns, 'customer')!;
    const rows = [{ [date.key]: '2026-01-01', [customer.key]: 'Firma A', [measure.key]: 3 }, { [date.key]: '2026-02-01', [customer.key]: 'Firma A', [measure.key]: 7 }];
    const table = pivot(compiled.columns, rows, 'period_month', measure.key)!;
    expect(table.columnValues).toEqual(['2026-01-01', '2026-02-01']);
    expect(table.rows[0].cells).toEqual([3, 7]);
    expect(table.grandTotal).toBe(10);
    expect(pivot(compiled.columns, rows, date.key, measure.key)).toEqual(table);
  });

  it('matches wizard raw measure rules and existing saved alias rules in web and PDF', () => {
    const columns = compileReport(parseReportDefinition({ dataset: 'sales', measures: ['device_count'] }), options).columns;
    const measure = columns[0];
    const rules: ConditionalRule[] = [{ column: 'device_count', op: 'gte', value: 10, color: 'success' }];
    for (const match of [matchConditionalRule, ruleColor, pdfRuleColor]) {
      expect(match(rules, measure, 20, columns)).toBe('success');
      expect(match([{ ...rules[0], column: measure.key }], measure, 20, columns)).toBe('success');
      expect(match(rules, measure, 1, columns)).toBeNull();
    }
    const compared = mergeCompare(columns, [], []).columns;
    expect(resolveResultColumn(compared, 'device_count')?.key).toBe(measure.key);
    expect(matchConditionalRule(rules, compared[1], 20, compared)).toBeNull();
  });

  it('supports legacy metadata without guessing arbitrary prefixes or ambiguous grains', () => {
    const monthly: ColumnMeta = { key: 'd_period_month_month', role: 'dimension', type: 'date', grain: 'month', label: 'Ay' };
    expect(resolvePivotColumn([monthly], 'period_month')).toEqual(monthly);
    expect(resolvePivotColumn([monthly], 'period')).toBeUndefined();
    const yearly: ColumnMeta = { ...monthly, key: 'd_period_month_year', grain: 'year' };
    expect(resolvePivotColumn([monthly, yearly], 'period_month')).toBeUndefined();
    expect(resolvePivotColumn([monthly, yearly], monthly.key)).toEqual(monthly);
    expect(resolvePivotColumn([{ key: 'm_quantity', role: 'measure', type: 'number', label: 'Adet' }], 'quantity')).toBeUndefined();
  });
});
