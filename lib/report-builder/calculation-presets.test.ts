import { describe, expect, it } from 'vitest';
import { calculationPreset } from './calculation-presets';
import { formulaRefs, formulaToSql, parseFormula } from './formula';
import { parseReportDefinition } from './types';
const amount = { key: 'amount_usd', label: 'Ciro (USD)' };
const count = { key: 'sale_count', label: 'Satış adedi' };
describe('friendly calculation presets', () => {
  it.each(['average', 'difference', 'percentage'] as const)('%s generates a valid report and parser-supported formula', preset => {
    const calculation = calculationPreset(preset, amount, count);
    expect(parseReportDefinition({ dataset: 'sales', measures: [amount.key, count.key], calculated: [calculation] }).calculated[0]).toEqual(calculation);
    const ast = parseFormula(calculation.formula);
    expect([...formulaRefs(ast)]).toEqual([amount.key, count.key]);
    const sql = formulaToSql(ast, { measureSql: key => `sum(${key})`, orderBy: [] });
    if (preset !== 'difference') expect(sql).toContain('nullif(');
    expect(calculation.label).toContain(amount.label);
    expect(calculation.label).toContain(count.label);
  });
  it('uses percentage format only for percentage and correct subtraction order', () => {
    expect(calculationPreset('percentage', amount, count)).toMatchObject({ formula: 'PCT([amount_usd], [sale_count])', format: 'percent' });
    expect(calculationPreset('difference', amount, count)).toMatchObject({ formula: '[amount_usd] - [sale_count]', format: 'number' });
    expect(calculationPreset('average', amount, count)).toMatchObject({ formula: 'DIV([amount_usd], [sale_count])', format: 'number' });
  });
  it('keeps labels and keys within limits and avoids collisions', () => {
    const a = { key: 'a'.repeat(64), label: 'A'.repeat(80) };
    const b = { key: 'b'.repeat(64), label: 'B'.repeat(80) };
    const first = calculationPreset('average', a, b);
    const second = calculationPreset('average', a, b, [first.key]);
    expect(second.key).not.toBe(first.key);
    expect(second.key.length).toBeLessThanOrEqual(64);
    expect(second.label.length).toBeLessThanOrEqual(80);
  });
  it('rejects malformed measure identifiers', () => {
    expect(() => calculationPreset('average', { ...amount, key: 'a];drop' }, count)).toThrow();
  });
});
