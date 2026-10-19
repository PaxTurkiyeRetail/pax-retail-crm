import { describe, expect, it } from 'vitest';
import { compileReport } from '@/lib/report-builder/compiler';
import { FormulaError, formulaRefs, formulaToSql, parseFormula } from '@/lib/report-builder/formula';
import { parseReportDefinition, ReportDefinitionError } from '@/lib/report-builder/types';

const ctx = { measureSql: (k: string) => { if (k !== 'a' && k !== 'b') throw new Error('bilinmeyen'); return `sum(${k})`; }, orderBy: ['d1'] };

describe('formula parser', () => {
  it('öncelik ve parantez', () => {
    const ast = parseFormula('[a] + [b] * 2');
    expect(ast).toMatchObject({ t: 'bin', op: '+', r: { t: 'bin', op: '*' } });
    expect(parseFormula('([a] + [b]) * 2')).toMatchObject({ t: 'bin', op: '*' });
  });
  it('çıplak referans ve büyük/küçük harf fonksiyon', () => {
    expect([...formulaRefs(parseFormula('pct(a, b) + ABS(-a)'))].sort()).toEqual(['a', 'b']);
  });
  it('IF + karşılaştırma', () => {
    const sql = formulaToSql(parseFormula('IF([a] >= 10, [a], 0)'), ctx);
    expect(sql).toContain('case when');
    expect(sql).toContain('>=');
  });
  it('güvenli bölme', () => {
    expect(formulaToSql(parseFormula('[a] / [b]'), ctx)).toContain('nullif(');
  });
  it('pencere fonksiyonları', () => {
    expect(formulaToSql(parseFormula('RUNNING_SUM([a])'), ctx)).toContain('rows between unbounded preceding');
    expect(formulaToSql(parseFormula('RANK([a])'), ctx)).toContain('rank() over');
    expect(formulaToSql(parseFormula('SHARE([a])'), ctx)).toContain('over ()');
    expect(formulaToSql(parseFormula('GROWTH([a],[b])'), ctx)).toContain('100.0 *');
  });
  it.each([
    "[a]; drop table x",
    "'x'",
    '[a] -- yorum',
    'pg_sleep(10)',
    'SUM(SUM([a]))',
    '[a] > 1',
    'IF([a], 1, 2)',
    'ROUND([a], 99)',
    'ROUND([a], [b])',
    'ABS()',
    '[A]',
    'Tablo',
    '[a] +',
    '((([a])',
    '',
    '"a"',
    '[a] $1',
  ])('reddeder: %j', (src) => {
    expect(() => parseFormula(src)).toThrow(FormulaError);
  });
  it('uzunluk/derinlik sınırı', () => {
    expect(() => parseFormula('1+'.repeat(300) + '1')).toThrow(FormulaError);
    expect(() => parseFormula('('.repeat(40) + '1' + ')'.repeat(40))).toThrow(FormulaError);
  });
});

describe('derleyici formül entegrasyonu', () => {
  const base = { version: 1, dataset: 'sales', measures: ['amount_usd', 'sale_count'], dimensions: [{ field: 'sale_date', grain: 'month' }] };
  it('formül derlenir, bilinmeyen ölçü reddedilir', () => {
    const def = parseReportDefinition({ ...base, calculated: [{ key: 'avg_ticket', label: 'Ort.', formula: 'DIV([amount_usd], [sale_count])' }] });
    const q = compileReport(def, { scope: { kind: 'all' }, today: '2026-10-19' });
    expect(q.sql).toContain('"c_avg_ticket"');
    expect(q.columns.some((c) => c.key === 'c_avg_ticket')).toBe(true);
    const bad = parseReportDefinition({ ...base, calculated: [{ key: 'x', label: 'X', formula: '[nope] + 1' }] });
    expect(() => compileReport(bad, { scope: { kind: 'all' }, today: '2026-10-19' })).toThrow(ReportDefinitionError);
  });
  it('kümülatif tarih kırılımına göre sıralanır', () => {
    const def = parseReportDefinition({ ...base, calculated: [{ key: 'cum', label: 'Küm.', formula: 'CUMULATIVE([amount_usd])' }] });
    const q = compileReport(def, { scope: { kind: 'all' }, today: '2026-10-19' });
    expect(q.sql).toMatch(/over \(order by date_trunc/);
  });
  it('expr ve formula birlikte reddedilir', () => {
    expect(() => parseReportDefinition({ ...base, calculated: [{ key: 'x', label: 'X', formula: '1', expr: { const: 1 } }] })).toThrow(ReportDefinitionError);
  });
});
