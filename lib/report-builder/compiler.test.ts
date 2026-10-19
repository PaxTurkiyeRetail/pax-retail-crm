import { describe, expect, it } from 'vitest';
import { compileReport } from '@/lib/report-builder/compiler';
import { compareRange, resolvePreset } from '@/lib/report-builder/dates';
import { canAccessDataset, resolveRowScope } from '@/lib/report-builder/access';
import { DATASETS, datasetCatalog } from '@/lib/report-builder/datasets';
import { mergeCompare, pivot, toCsv } from '@/lib/report-builder/result';
import { parseReportDefinition, ReportDefinitionError, type RowScope } from '@/lib/report-builder/types';

const ALL: RowScope = { kind: 'all' };
const OWN: RowScope = { kind: 'own', userId: 'u-1', email: 'ali@pax.com', fullName: 'Ali Veli' };
const TODAY = '2026-10-19';

const compile = (input: unknown, scope: RowScope = ALL, period?: 'compare') =>
  compileReport(parseReportDefinition(input), { scope, today: TODAY, period });

describe('rapor tanımı şeması', () => {
  it('varsayılanları doldurur', () => {
    const def = parseReportDefinition({ dataset: 'sales', measures: ['amount_usd'] });
    expect(def.limit).toBe(500);
    expect(def.visualization.type).toBe('table');
    expect(def.compare).toBe('none');
  });

  it('identifier biçimine uymayan anahtarları şemada reddeder', () => {
    for (const bad of ['amount_usd; drop table x', 'A"B', 's.amount', '1abc', 'x--', '']) {
      expect(() => parseReportDefinition({ dataset: 'sales', measures: [bad] })).toThrow(ReportDefinitionError);
    }
    expect(() => parseReportDefinition({ dataset: 'sales"; select 1 --', measures: ['sale_count'] })).toThrow(ReportDefinitionError);
  });

  it('limit üst sınırını aşmaz', () => {
    expect(() => parseReportDefinition({ dataset: 'sales', measures: ['sale_count'], limit: 100000 })).toThrow(ReportDefinitionError);
  });
});

describe('derleyici — beyaz liste', () => {
  it('bilinmeyen dataset / ölçü / kırılım / filtre / sıralama alanını reddeder', () => {
    expect(() => compile({ dataset: 'allowed_users', measures: ['sale_count'] })).toThrow(/Bilinmeyen dataset/);
    expect(() => compile({ dataset: 'sales', measures: ['password_hash'] })).toThrow(/Bilinmeyen ölçü/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], dimensions: [{ field: 'password_hash' }] })).toThrow(/Bilinmeyen alan/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], filters: [{ field: 'email', op: 'eq', value: 'x' }] })).toThrow(/Bilinmeyen filtre/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], sort: [{ field: 'owner', dir: 'asc' }] })).toThrow(/Sıralama/);
  });

  it('prototype anahtarlarını alan saymaz', () => {
    expect(() => compile({ dataset: 'constructor', measures: ['sale_count'] })).toThrow(/Bilinmeyen dataset/);
    expect(() => compile({ dataset: 'sales', measures: ['constructor'] })).toThrow(/Bilinmeyen ölçü/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], dimensions: [{ field: 'to_string' }] })).toThrow(/Bilinmeyen alan/);
  });

  it('zaman kırılımını yalnız tarih alanında ve izinli kırılımda kabul eder', () => {
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], dimensions: [{ field: 'owner', grain: 'month' }] })).toThrow(/zaman kırılımı/);
    expect(() => compile({ dataset: 'forecast', measures: ['quantity'], dimensions: [{ field: 'forecast_month', grain: 'day' }] })).toThrow(/desteklenmiyor/);
  });
});

describe('derleyici — SQL injection', () => {
  const payloads = [
    "'; drop table public.crm_sales; --",
    "x' or '1'='1",
    '1) or (1=1',
    "Ali\\'; select pg_sleep(10); --",
    '$1; delete from musteriler',
  ];

  it('değerleri SQL metnine asla gömmez, parametre olarak geçer', () => {
    for (const payload of payloads) {
      const q = compile({
        dataset: 'sales', measures: ['amount_usd'], dimensions: [{ field: 'owner' }],
        filters: [
          { field: 'owner', op: 'eq', value: payload },
          { field: 'customer', op: 'contains', value: payload },
          { field: 'sector', op: 'in', value: [payload, 'Perakende'] },
        ],
      });
      expect(q.sql).not.toContain(payload);
      expect(q.sql).not.toMatch(/drop table|pg_sleep|delete from|'1'='1/i);
      expect(q.params).toContain(payload);
      expect(q.params).toContain(`%${payload.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
  });

  it('LIKE jokerlerini kaçışlar', () => {
    const q = compile({ dataset: 'sales', measures: ['sale_count'], filters: [{ field: 'customer', op: 'contains', value: '100%_a' }] });
    expect(q.params).toContain('%100\\%\\_a%');
  });

  it('tip uyumsuz değerleri reddeder (sayı/tarih/boolean)', () => {
    expect(() => compile({ dataset: 'forecast', measures: ['quantity'], filters: [{ field: 'probability', op: 'eq', value: '30 or 1=1' }] })).toThrow(/sayı/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], filters: [{ field: 'sale_date', op: 'gte', value: "2026-01-01' or '1'='1" }] })).toThrow(/tarih/);
    expect(() => compile({ dataset: 'sale_items', measures: ['quantity'], filters: [{ field: 'is_device', op: 'eq', value: 'yes' }] })).toThrow(/true\/false/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], filters: [{ field: 'owner', op: 'gt', value: 'a' }] })).toThrow(/metin alanında/);
  });

  it('mutlak tarih aralığında geçersiz tarihleri reddeder', () => {
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], dateRange: { type: 'absolute', from: '2026-02-30', to: '2026-03-01' } })).toThrow(/Geçersiz tarih/);
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], dateRange: { type: 'absolute', from: '2026-05-01', to: '2026-01-01' } })).toThrow(/başlangıç/);
  });

  it('alias ve SQL parçaları yalnız registry anahtarlarından oluşur', () => {
    const q = compile({ dataset: 'activities', measures: ['activity_count'], dimensions: [{ field: 'activity_date', grain: 'month' }, { field: 'channel' }] });
    const aliases = [...q.sql.matchAll(/as "([^"]+)"/g)].map((m) => m[1]);
    expect(aliases).toEqual(['d_activity_date_month', 'd_channel', 'm_activity_count']);
    expect(q.sql).toContain("date_trunc('month'");
  });
});

describe('derleyici — satır düzeyinde yetki', () => {
  it('all kapsamında sahip filtresi eklemez', () => {
    const q = compile({ dataset: 'sales', measures: ['sale_count'] }, ALL);
    expect(q.sql).not.toContain('owner_user_id');
    expect(q.params).not.toContain('u-1');
  });

  it('own kapsamında her datasete sahip filtresi ekler (id > e-posta > ad)', () => {
    for (const key of Object.keys(DATASETS)) {
      const ds = DATASETS[key];
      const q = compile({ dataset: key, measures: [Object.keys(ds.measures)[0]] }, OWN);
      expect(q.sql).toContain(ds.owner.userId);
      expect(q.params).toContain('u-1');
      if (ds.owner.email) expect(q.params).toContain('ali@pax.com');
      if (ds.owner.name) expect(q.params).toContain('Ali Veli');
    }
  });

  it('kullanıcı filtresi yetki filtresini genişletemez (AND ile bağlanır)', () => {
    const q = compile({ dataset: 'sales', measures: ['sale_count'], filters: [{ field: 'owner', op: 'neq', value: 'x' }] }, OWN);
    const where = q.sql.split('\n').find((l) => l.startsWith('where'))!;
    expect(where).toMatch(/^where \(s\.status = 'active'\) and \(\(\(s\.owner_user_id::text\) = \$1::text or/);
    expect(where).toContain(') and ((');
  });

  it('kullanıcı kimliği olmayan own kapsamını reddeder', () => {
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'] }, { kind: 'own', userId: '', email: '', fullName: null })).toThrow(/kimliği/);
  });

  it('resolveRowScope: izin → kapsam', () => {
    const base = { id: 'u-1', email: 'a@b.c', full_name: 'A' };
    expect(resolveRowScope({ ...base, permissions: ['report.read.all'] })).toEqual({ kind: 'all' });
    expect(resolveRowScope({ ...base, permissions: ['report.read.own'] })?.kind).toBe('own');
    expect(resolveRowScope({ ...base, permissions: ['report.read.team'] })?.kind).toBe('own');
    expect(resolveRowScope({ ...base, permissions: ['customer.read'] })).toBeNull();
  });

  it('dataset erişimi action permission ister', () => {
    expect(canAccessDataset({ permissions: ['report.read.all'] }, DATASETS.forecast)).toBe(false);
    expect(canAccessDataset({ permissions: ['report.read.all', 'forecast.read'] }, DATASETS.forecast)).toBe(true);
    expect(datasetCatalog((p) => p === 'activity.read').map((d) => d.key)).toEqual(['activities']);
    expect(JSON.stringify(datasetCatalog(() => true))).not.toMatch(/public\.|select /);
  });
});

describe('derleyici — özellikler', () => {
  it('limit + 1 parametre olarak gelir', () => {
    const q = compile({ dataset: 'sales', measures: ['sale_count'], limit: 50 });
    expect(q.sql).toMatch(/limit \$\d+::int$/);
    expect(q.params[q.params.length - 1]).toBe(51);
    expect(q.limit).toBe(50);
  });

  it('göreli tarih aralığını çözer ve parametre olarak ekler', () => {
    const q = compile({ dataset: 'sales', measures: ['sale_count'], dateRange: { type: 'relative', preset: 'this_month' } });
    expect(q.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(q.params).toEqual(expect.arrayContaining(['2026-10-01', '2026-10-31']));
  });

  it('ölçü filtresini HAVING olarak uygular', () => {
    const q = compile({ dataset: 'sales', measures: ['amount_usd'], dimensions: [{ field: 'owner' }], filters: [{ field: 'amount_usd', op: 'gte', value: 1000 }] });
    expect(q.sql).toMatch(/having/);
  });

  it('hesaplanmış alan: güvenli bölme', () => {
    const q = compile({
      dataset: 'sales', measures: ['amount_usd', 'device_count'],
      calculated: [{ key: 'per_device', label: 'Cihaz başı', expr: { op: 'div', left: { measure: 'amount_usd' }, right: { measure: 'device_count' } } }],
      sort: [{ field: 'per_device', dir: 'desc' }],
    });
    expect(q.sql).toContain('nullif(');
    expect(q.sql).toContain('"c_per_device" desc');
    expect(() => compile({ dataset: 'sales', measures: ['sale_count'], calculated: [{ key: 'x', label: 'x', expr: { measure: 'nope' } }] })).toThrow(/Bilinmeyen ölçü/);
  });

  it('karşılaştırma: YoY aralığı ve tarih hizalaması', () => {
    const def = { dataset: 'sales', measures: ['amount_usd'], dimensions: [{ field: 'sale_date', grain: 'month' }], dateRange: { type: 'absolute', from: '2026-01-01', to: '2026-06-30' }, compare: 'yoy' };
    const q = compile(def, ALL, 'compare');
    expect(q.range).toEqual({ from: '2025-01-01', to: '2025-06-30' });
    expect(q.params).toContain('1 year');
    expect(q.sql).toContain('::interval');
    expect(() => compile({ ...def, compare: 'none' }, ALL, 'compare')).toThrow(/Karşılaştırma/);
  });
});

describe('tarih yardımcıları', () => {
  it('presetler', () => {
    expect(resolvePreset('last_month', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(resolvePreset('this_week', TODAY)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(resolvePreset('last_quarter', TODAY)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(resolvePreset('ytd', TODAY)).toEqual({ from: '2026-01-01', to: TODAY });
  });
  it('önceki dönem: ay hizalı ve gün bazlı', () => {
    expect(compareRange({ from: '2026-04-01', to: '2026-06-30' }, 'previous_period')).toEqual({ range: { from: '2026-01-01', to: '2026-03-31' }, interval: '3 months' });
    expect(compareRange({ from: '2026-10-13', to: '2026-10-19' }, 'previous_period')).toEqual({ range: { from: '2026-10-06', to: '2026-10-12' }, interval: '7 days' });
  });
});

describe('sonuç yardımcıları', () => {
  const columns = [
    { key: 'd_owner', label: 'Satıcı', role: 'dimension' as const, type: 'string' as const },
    { key: 'd_sale_date_month', label: 'Ay', role: 'dimension' as const, type: 'date' as const, grain: 'month' as const },
    { key: 'm_amount_usd', label: 'Ciro', role: 'measure' as const, type: 'number' as const, format: 'money' as const },
  ];
  const rows = [
    { d_owner: 'Ali', d_sale_date_month: '2026-01-01', m_amount_usd: 10 },
    { d_owner: 'Ali', d_sale_date_month: '2026-02-01', m_amount_usd: 5 },
    { d_owner: 'Can', d_sale_date_month: '2026-01-01', m_amount_usd: 7 },
  ];
  it('pivot', () => {
    const p = pivot(columns, rows, 'd_sale_date_month', 'm_amount_usd')!;
    expect(p.columnValues).toEqual(['2026-01-01', '2026-02-01']);
    expect(p.rows.find((r) => r.key[0] === 'Ali')!.total).toBe(15);
    expect(p.grandTotal).toBe(22);
  });
  it('mergeCompare', () => {
    const merged = mergeCompare(columns, rows, [{ d_owner: 'Ali', d_sale_date_month: '2026-01-01', m_amount_usd: 3 }]);
    expect(merged.rows[0].m_amount_usd__prev).toBe(3);
    expect(merged.rows[1].m_amount_usd__prev).toBeNull();
  });
  it('CSV formül enjeksiyonunu etkisizleştirir', () => {
    const csv = toCsv(columns, [{ d_owner: '=HYPERLINK("x")', d_sale_date_month: '2026-01-01', m_amount_usd: -5.5 }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('-5,5');
  });
});
