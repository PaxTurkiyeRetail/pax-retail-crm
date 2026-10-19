// GÜVENLİ SORGU DERLEYİCİ — rapor tanımı → parametreli SQL.
// Kurallar:
//  1) Tüm identifier/SQL parçaları dataset registry'den gelir (beyaz liste). Kullanıcı metni SQL'e
//     hiçbir zaman string olarak eklenmez; değerler yalnız $n parametresidir.
//  2) Satır düzeyinde yetki (RowScope) her sorguya otomatik eklenir; tanım bunu kapatamaz.
//  3) Satır limiti her zaman uygulanır (MAX_ROW_LIMIT), +1 satır kesinti tespiti için.
// Saf modül: DB/oturum bilmez → birim testlenebilir.
import { getDataset, type DatasetDef, type DimensionDef } from '@/lib/report-builder/datasets';
import { FormulaError, formulaToSql, parseFormula } from '@/lib/report-builder/formula';
import { compareRange, resolveDateRange, type ResolvedRange } from '@/lib/report-builder/dates';
import {
  MAX_ROW_LIMIT, ReportDefinitionError,
  type CalcExpr, type ColumnMeta, type ReportDefinition, type ReportFilter, type RowScope, type TimeGrain,
} from '@/lib/report-builder/types';

export type CompiledQuery = {
  sql: string;
  params: unknown[];
  columns: ColumnMeta[];
  range: ResolvedRange | null;
  limit: number;
};

export type CompileContext = {
  scope: RowScope;
  /** Europe/Istanbul bugünü (YYYY-MM-DD). */
  today: string;
  /** 'compare' → karşılaştırma dönemi sorgusu (tarih kırılımı cari döneme hizalanır). */
  period?: 'current' | 'compare';
};

class Params {
  values: unknown[] = [];
  add(value: unknown, cast?: string) {
    this.values.push(value);
    return cast ? `$${this.values.length}::${cast}` : `$${this.values.length}`;
  }
}

const CAST: Record<DimensionDef['type'], string> = { string: 'text', number: 'numeric', date: 'date', boolean: 'boolean' };

function fail(message: string): never {
  throw new ReportDefinitionError(message);
}

function dimensionOf(dataset: DatasetDef, field: string): DimensionDef {
  const dim = Object.prototype.hasOwnProperty.call(dataset.dimensions, field) ? dataset.dimensions[field] : undefined;
  if (!dim) fail(`Bilinmeyen alan: ${field}`);
  return dim;
}

function measureSql(dataset: DatasetDef, key: string): string {
  const m = Object.prototype.hasOwnProperty.call(dataset.measures, key) ? dataset.measures[key] : undefined;
  if (!m) fail(`Bilinmeyen ölçü: ${key}`);
  return m.sql;
}

function coerce(dim: DimensionDef, field: string, value: unknown): string | number | boolean {
  if (value === null || value === undefined || Array.isArray(value)) fail(`${field}: değer gerekli`);
  switch (dim.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) fail(`${field}: sayı bekleniyor`);
      return n;
    }
    case 'date': {
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${field}: tarih YYYY-AA-GG olmalı`);
      return s;
    }
    case 'boolean': {
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return fail(`${field}: true/false bekleniyor`);
    }
    default:
      return String(value).slice(0, 500);
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function filterClause(expr: string, dim: DimensionDef, filter: ReportFilter, p: Params): string {
  const { field, op, value } = filter;
  const cast = CAST[dim.type];
  const list = () => {
    if (!Array.isArray(value) || value.length === 0) fail(`${field}: liste değeri gerekli`);
    return value.map((v) => coerce(dim, field, v));
  };
  if (dim.type === 'boolean' && !['eq', 'neq', 'is_null', 'not_null'].includes(op)) fail(`${field}: bu operatör desteklenmiyor`);
  switch (op) {
    case 'is_null': return `(${expr}) is null`;
    case 'not_null': return `(${expr}) is not null`;
    case 'eq': return `(${expr}) = ${p.add(coerce(dim, field, value), cast)}`;
    case 'neq': return `(${expr}) is distinct from ${p.add(coerce(dim, field, value), cast)}`;
    case 'in': return `(${expr}) = any(${p.add(list(), `${cast}[]`)})`;
    case 'not_in': return `not ((${expr}) = any(${p.add(list(), `${cast}[]`)}))`;
    case 'contains':
    case 'starts_with': {
      if (dim.type !== 'string') fail(`${field}: metin operatörü yalnız metin alanında`);
      const raw = escapeLike(String(coerce(dim, field, value)));
      return `(${expr}) ilike ${p.add(op === 'contains' ? `%${raw}%` : `${raw}%`, 'text')}`;
    }
    case 'gt': case 'gte': case 'lt': case 'lte': {
      if (dim.type === 'string') fail(`${field}: karşılaştırma operatörü metin alanında kullanılamaz`);
      const sym = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
      return `(${expr}) ${sym} ${p.add(coerce(dim, field, value), cast)}`;
    }
    case 'between': {
      const [a, b] = list();
      if (!Array.isArray(value) || value.length !== 2) fail(`${field}: aralık iki değer olmalı`);
      return `(${expr}) between ${p.add(a, cast)} and ${p.add(b, cast)}`;
    }
  }
}

function measureFilterClause(expr: string, filter: ReportFilter, p: Params): string {
  const { field, op, value } = filter;
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) fail(`${field}: sayı bekleniyor`);
    return n;
  };
  switch (op) {
    case 'eq': return `(${expr}) = ${p.add(num(value), 'numeric')}`;
    case 'neq': return `(${expr}) is distinct from ${p.add(num(value), 'numeric')}`;
    case 'gt': return `(${expr}) > ${p.add(num(value), 'numeric')}`;
    case 'gte': return `(${expr}) >= ${p.add(num(value), 'numeric')}`;
    case 'lt': return `(${expr}) < ${p.add(num(value), 'numeric')}`;
    case 'lte': return `(${expr}) <= ${p.add(num(value), 'numeric')}`;
    case 'between': {
      if (!Array.isArray(value) || value.length !== 2) fail(`${field}: aralık iki değer olmalı`);
      return `(${expr}) between ${p.add(num(value[0]), 'numeric')} and ${p.add(num(value[1]), 'numeric')}`;
    }
    default: return fail(`${field}: ölçü filtresinde bu operatör desteklenmiyor`);
  }
}

/** Satır düzeyinde yetki. lib/resource-ownership.ts isResourceOwner ile aynı öncelik: id > e-posta > ad. */
export function ownerScopeClause(dataset: DatasetDef, scope: RowScope, p: Params): string | null {
  if (scope.kind === 'all') return null;
  if (!scope.userId) fail('Kapsam: kullanıcı kimliği yok');
  const { userId, email, name } = dataset.owner;
  const noId = `nullif(trim(${userId}), '') is null`;
  const parts = [`(${userId}) = ${p.add(scope.userId, 'text')}`];
  if (email && scope.email) {
    parts.push(`(${noId} and lower(trim(${email})) = lower(${p.add(scope.email.trim(), 'text')}))`);
  }
  const fullName = scope.fullName?.trim();
  if (name && fullName) {
    const noEmail = email ? ` and nullif(trim(${email}), '') is null` : '';
    parts.push(`(${noId}${noEmail} and lower(trim(${name})) = lower(${p.add(fullName, 'text')}))`);
  }
  return `(${parts.join(' or ')})`;
}

function calcSql(dataset: DatasetDef, expr: CalcExpr, depth = 0): string {
  if (depth > 4) fail('Hesaplanmış alan çok derin');
  if ('measure' in expr) return `(${measureSql(dataset, expr.measure)})::numeric`;
  if ('const' in expr) {
    if (!Number.isFinite(expr.const)) fail('Hesaplanmış alan: geçersiz sabit');
    // Sabit sayı: string'e çevrilip doğrulanmış bir sayıdır (identifier değil); yine de literal güvenli biçimde yazılır.
    return `(${Number(expr.const).toString()})::numeric`;
  }
  const l = calcSql(dataset, expr.left, depth + 1);
  const r = calcSql(dataset, expr.right, depth + 1);
  switch (expr.op) {
    case 'add': return `(${l} + ${r})`;
    case 'sub': return `(${l} - ${r})`;
    case 'mul': return `(${l} * ${r})`;
    case 'div': return `(${l} / nullif(${r}, 0))`;
    case 'pct': return `(100.0 * ${l} / nullif(${r}, 0))`;
    default: return fail('Hesaplanmış alan: geçersiz operatör');
  }
}

const GRAIN_SQL: Record<TimeGrain, string> = { day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year' };

export function compileReport(def: ReportDefinition, ctx: CompileContext): CompiledQuery {
  const dataset = getDataset(def.dataset);
  if (!dataset) fail(`Bilinmeyen dataset: ${def.dataset}`);
  const p = new Params();
  const columns: ColumnMeta[] = [];
  const aliasByField = new Map<string, string>();

  // --- Tarih aralığı + karşılaştırma ---
  let range: ResolvedRange | null = null;
  let shiftInterval: string | null = null;
  if (def.dateRange) range = resolveDateRange(def.dateRange, ctx.today);
  if (ctx.period === 'compare') {
    if (!range) fail('Karşılaştırma için tarih aralığı gerekli');
    if (def.compare === 'none') fail('Karşılaştırma modu seçilmedi');
    const shifted = compareRange(range, def.compare);
    range = shifted.range;
    shiftInterval = shifted.interval;
  }

  // --- Kırılımlar ---
  const selects: string[] = [];
  const groupBy: string[] = [];
  const dimExprs: string[] = [];
  const seenAlias = new Set<string>();
  def.dimensions.forEach((ref) => {
    const dim = dimensionOf(dataset, ref.field);
    let expr = dim.sql;
    let grain: TimeGrain | undefined;
    if (dim.type === 'date') {
      grain = ref.grain ?? 'day';
      if (dim.grains && !dim.grains.includes(grain)) fail(`${ref.field}: '${grain}' kırılımı desteklenmiyor`);
      if (shiftInterval) expr = `((${expr}) + ${p.add(shiftInterval, 'interval')})::date`;
      expr = grain === 'day' ? `(${expr})::date` : `date_trunc('${GRAIN_SQL[grain]}', ${expr})::date`;
    } else if (ref.grain) {
      fail(`${ref.field}: zaman kırılımı yalnız tarih alanında`);
    }
    const alias = `d_${ref.field}${grain && grain !== 'day' ? `_${grain}` : ''}`;
    if (seenAlias.has(alias)) fail(`Kırılım tekrarlanmış: ${ref.field}`);
    seenAlias.add(alias);
    aliasByField.set(ref.field, alias);
    aliasByField.set(alias, alias);
    selects.push(`${expr} as "${alias}"`);
    dimExprs.push(expr);
    groupBy.push(String(selects.length));
    columns.push({ key: alias, label: dim.label, role: 'dimension', type: dim.type, grain, format: dim.type === 'date' ? 'date' : undefined });
  });

  // --- Ölçüler ---
  const uniqueMeasures = Array.from(new Set(def.measures));
  for (const key of uniqueMeasures) {
    const alias = `m_${key}`;
    selects.push(`${measureSql(dataset, key)} as "${alias}"`);
    aliasByField.set(key, alias);
    aliasByField.set(alias, alias);
    const m = dataset.measures[key];
    columns.push({ key: alias, label: m.label, role: 'measure', type: 'number', format: m.format });
  }

  // --- Hesaplanmış alanlar ---
  for (const calc of def.calculated) {
    const alias = `c_${calc.key}`;
    if (aliasByField.has(calc.key)) fail(`Hesaplanmış alan anahtarı çakışıyor: ${calc.key}`);
    let sql: string;
    if (calc.formula) {
      let ast;
      try { ast = parseFormula(calc.formula); } catch (e) {
        if (e instanceof FormulaError) fail(`${calc.label}: ${e.message}`);
        throw e;
      }
      sql = formulaToSql(ast, { measureSql: (k) => measureSql(dataset, k), orderBy: dimExprs });
    } else {
      sql = calcSql(dataset, calc.expr!);
    }
    selects.push(`${sql} as "${alias}"`);
    aliasByField.set(calc.key, alias);
    aliasByField.set(alias, alias);
    columns.push({ key: alias, label: calc.label, role: 'calculated', type: 'number', format: calc.format ?? 'number' });
  }

  // --- WHERE ---
  const where: string[] = [...dataset.baseWhere];
  const scopeSql = ownerScopeClause(dataset, ctx.scope, p);
  if (scopeSql) where.push(scopeSql);
  if (range) {
    const field = def.dateRange?.field ?? dataset.defaultDateField;
    const dim = dimensionOf(dataset, field);
    if (dim.type !== 'date') fail(`${field}: tarih alanı değil`);
    where.push(`(${dim.sql}) between ${p.add(range.from, 'date')} and ${p.add(range.to, 'date')}`);
  }
  // Varsayılan departman (musteriler.is_kolu). 'all' / yok = filtre yok; dataset'te alan yoksa hata.
  if (def.department && def.department !== 'all') {
    const dep = dimensionOf(dataset, 'department');
    where.push(`(${dep.sql}) = ${p.add(def.department, 'text')}`);
  }
  const having: string[] = [];
  for (const filter of def.filters) {
    if (Object.prototype.hasOwnProperty.call(dataset.dimensions, filter.field)) {
      where.push(filterClause(dataset.dimensions[filter.field].sql, dataset.dimensions[filter.field], filter, p));
    } else if (Object.prototype.hasOwnProperty.call(dataset.measures, filter.field)) {
      having.push(measureFilterClause(dataset.measures[filter.field].sql, filter, p));
    } else {
      fail(`Bilinmeyen filtre alanı: ${filter.field}`);
    }
  }

  // --- ORDER BY ---
  const order: string[] = [];
  for (const s of def.sort) {
    const alias = aliasByField.get(s.field);
    if (!alias) fail(`Sıralama alanı raporda yok: ${s.field}`);
    order.push(`"${alias}" ${s.dir === 'asc' ? 'asc' : 'desc'} nulls last`);
  }
  if (!order.length) {
    const dateCols = columns.filter((c) => c.role === 'dimension' && c.type === 'date');
    for (const c of dateCols) order.push(`"${c.key}" asc`);
    const firstMeasure = columns.find((c) => c.role !== 'dimension');
    if (firstMeasure) order.push(`"${firstMeasure.key}" desc nulls last`);
  }

  const limit = Math.min(Math.max(1, Math.trunc(def.limit)), MAX_ROW_LIMIT);
  const sql = [
    `select ${selects.join(', ')}`,
    `from ${dataset.from}`,
    where.length ? `where ${where.map((w) => `(${w})`).join(' and ')}` : '',
    groupBy.length ? `group by ${groupBy.join(', ')}` : '',
    having.length ? `having ${having.map((h) => `(${h})`).join(' and ')}` : '',
    order.length ? `order by ${order.join(', ')}` : '',
    `limit ${p.add(limit + 1, 'int')}`,
  ].filter(Boolean).join('\n');

  return { sql, params: p.values, columns, range, limit };
}
