import { describe, expect, it } from 'vitest';
import { compileReport } from '@/lib/report-builder/compiler';
import { parseReportDefinition, ReportDefinitionError, type RowScope } from '@/lib/report-builder/types';

const dimensions = [
  { field: 'sale_date', grain: 'month' },
  ...['owner', 'sales_channel', 'product_code', 'product_name', 'product_type',
    'item_sale_type', 'is_device', 'currency', 'customer', 'sector', 'department']
    .map((field) => ({ field })),
];
const input = { dataset: 'sale_items', dimensions, measures: ['quantity', 'total_usd'] };
const own: RowScope = { kind: 'own', userId: 'u-12', email: 'owner@example.com', fullName: 'Report Owner' };
const compile = (definition: unknown, scope: RowScope = { kind: 'all' }) =>
  compileReport(parseReportDefinition(definition), { scope, today: '2026-10-19' });

describe('çok kırılımlı ürün raporları', () => {
  it.each<RowScope>([{ kind: 'all' }, own])('12 kırılımı $kind kapsamında tüm kolonlarıyla gruplar', (scope) => {
    const query = compile(input, scope);
    const aliases = ['d_sale_date_month', ...dimensions.slice(1).map(({ field }) => `d_${field}`)];
    expect(query.columns.filter(({ role }) => role === 'dimension').map(({ key }) => key)).toEqual(aliases);
    expect([...query.sql.matchAll(/as "([^"]+)"/g)].map((match) => match[1]))
      .toEqual([...aliases, 'm_quantity', 'm_total_usd']);
    expect(query.sql.split('\n')).toContain('group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12');
    expect(query.sql).toContain("date_trunc('month', s.sale_date)::date");
    expect(query.sql).toContain("where (s.status = 'active')");
    if (scope.kind === 'own') {
      expect(query.sql).toContain('(s.owner_user_id::text) = $1::text');
      expect(query.params).toEqual(['u-12', 'owner@example.com', 'Report Owner', 501]);
      expect(query.sql).not.toContain(scope.email);
    } else {
      expect(query.sql).not.toContain('owner_user_id');
      expect(query.params).toEqual([501]);
    }
  });

  it('13 geçerli ve farklı kırılımı şemada reddeder', () => {
    expect(() => parseReportDefinition({ ...input, dimensions: [...dimensions, { field: 'customer_type' }] }))
      .toThrow(ReportDefinitionError);
  });

  it('12 kırılım içinde bilinmeyen alanı beyaz listede reddeder', () => {
    expect(() => compile({ ...input, dimensions: [...dimensions.slice(0, 11), { field: 'password_hash' }] }))
      .toThrow(/Bilinmeyen alan/);
  });

  it.each(['customer; drop table crm_sales; --', 's.owner_name', 'owner"', 'owner--'])
    ('12 kırılım içinde SQL alan girdisini reddeder: %s', (field) => {
      expect(() => compile({ ...input, dimensions: [...dimensions.slice(0, 11), { field }] }))
        .toThrow(ReportDefinitionError);
    });
});
