import { describe, expect, it } from 'vitest';
import { conditionalRuleSchema, type ColumnMeta, type ConditionalRule } from './types';
import { matchConditionalRule, resolveConditionalRule } from './result';
const columns: ColumnMeta[] = [
  { key: 'm_actual_quantity', sourceField: 'actual_quantity', label: 'Actual', role: 'measure', type: 'number' },
  { key: 'm_target_quantity', sourceField: 'target_quantity', label: 'Target', role: 'measure', type: 'number' },
];
const rule: ConditionalRule = { column: 'actual_quantity', op: 'lt', value: 100, compareColumn: 'target_quantity', color: 'danger', label: 'Hedefin altında' };
describe('conditional styles', () => {
  it('keeps old rules and color wrapper compatible', () => {
    const old = conditionalRuleSchema.parse({ column: 'm_actual_quantity', op: 'gte', value: 10, color: 'success' });
    expect(matchConditionalRule([old], columns[0], 10, columns)).toBe('success');
    expect(resolveConditionalRule([old], columns[0], 10, columns)).toBe(old);
  });
  it('matches inclusive between thresholds', () => {
    const between: ConditionalRule = { ...rule, compareColumn: undefined, op: 'between', value: 80, value2: 100 };
    for (const v of [80, 90, 100]) expect(resolveConditionalRule([between], columns[0], v, columns)).toBe(between);
    for (const v of [79, 101]) expect(resolveConditionalRule([between], columns[0], v, columns)).toBeNull();
  });
  it('skips disabled rules and preserves first matching priority', () => {
    const second: ConditionalRule = { ...rule, color: 'warning' };
    const row = { m_target_quantity: 100 };
    expect(resolveConditionalRule([{ ...rule, enabled: false }, second], columns[0], 50, columns, row)).toBe(second);
    expect(resolveConditionalRule([rule, second], columns[0], 50, columns, row)).toBe(rule);
  });
  it('resolves semantic and canonical aliases for relative percentage thresholds', () => {
    const row = { m_target_quantity: 200 };
    expect(matchConditionalRule([rule], columns[0], 199, columns, row)).toBe('danger');
    expect(matchConditionalRule([rule], columns[0], 200, columns, row)).toBeNull();
    const eighty: ConditionalRule = { ...rule, column: 'm_actual_quantity', compareColumn: 'm_target_quantity', value: 80 };
    expect(matchConditionalRule([eighty], columns[0], 159, columns, row)).toBe('danger');
    expect(matchConditionalRule([eighty], columns[0], 160, columns, row)).toBeNull();
    const relativeBetween: ConditionalRule = { ...rule, op: 'between', value: 80, value2: 100 };
    for (const value of [160, 200]) expect(resolveConditionalRule([relativeBetween], columns[0], value, columns, row)).toBe(relativeBetween);
    const canonicalColumns = columns.map(({ sourceField: _sourceField, ...column }) => column);
    expect(matchConditionalRule([rule], columns[0], 100, canonicalColumns, row)).toBe('danger');
  });
  it('does not coerce missing, null, string or nonfinite targets into zero', () => {
    for (const row of [undefined, {}, { m_target_quantity: null }, { m_target_quantity: NaN }, { m_target_quantity: Infinity }, { m_target_quantity: '100' }]) {
      expect(resolveConditionalRule([{ ...rule, op: 'gte' }], columns[0], 100, columns, row)).toBeNull();
    }
    expect(resolveConditionalRule([{ ...rule, compareColumn: 'target_quantity;select' }], columns[0], 1, columns, { m_target_quantity: 100 })).toBeNull();
    expect(resolveConditionalRule([rule], columns[0], NaN, columns, { m_target_quantity: 100 })).toBeNull();
  });
  it('enforces optional schema limits', () => {
    expect(conditionalRuleSchema.safeParse({ ...rule, label: 'a'.repeat(61) }).success).toBe(false);
    expect(conditionalRuleSchema.safeParse({ ...rule, compareColumn: 'a'.repeat(81) }).success).toBe(false);
  });
});

