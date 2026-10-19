import { describe, expect, it } from 'vitest';
import { compileReport } from './compiler';
import { parseReportDefinition } from './types';

const base = { dataset: 'sales', measures: ['device_count'] };

describe('saved report styles', () => {
  it('preserves conditional colors across validation and JSON save/load', () => {
    const style = { accent: 'info', conditional: [
      { column: 'device_count', op: 'gte', value: 100, color: 'success' },
      { column: 'device_count', op: 'between', value: 10, value2: 50, color: 'warning' },
    ] };
    const saved = JSON.stringify(parseReportDefinition({ ...base, style }));
    const reopened = parseReportDefinition(JSON.parse(saved));
    expect(reopened.style).toEqual(style);
    const options = { scope: { kind: 'all' as const }, today: '2026-10-19' };
    expect(compileReport(reopened, options)).toEqual(compileReport(parseReportDefinition(base), options));
  });

  it('accepts existing unstyled reports and explicit removal of all rules', () => {
    expect(parseReportDefinition(base).style).toBeUndefined();
    expect(parseReportDefinition({ ...base, style: { conditional: [] } }).style?.conditional).toEqual([]);
  });

  it('rejects arbitrary CSS colors and unbounded rule payloads', () => {
    const rule = { column: 'device_count', op: 'gte', value: 0, color: '#00ff00' };
    expect(() => parseReportDefinition({ ...base, style: { conditional: [rule] } })).toThrow();
    expect(() => parseReportDefinition({ ...base, style: { conditional: Array(21).fill({ ...rule, color: 'success' }) } })).toThrow();
  });
});
