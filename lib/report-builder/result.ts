// Sonuç yardımcıları (istemci + sunucu): karşılaştırma birleştirme, pivot, CSV, biçim.
import type { ColorToken, ConditionalRule, ColumnMeta } from '@/lib/report-builder/types';

export type ResultRow = Record<string, string | number | boolean | null>;

export type ReportResult = {
  columns: ColumnMeta[];
  rows: ResultRow[];
  truncated: boolean;
  range: { from: string; to: string } | null;
  compareRange: { from: string; to: string } | null;
  durationMs: number;
  provenance?: { queriedAt: string; source: string; sourceLabel: string; scope: 'all' | 'own'; description: string; measures: {label: string; description: string}[]; warnings: string[] };

};

export const PREV_SUFFIX = '__prev';

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'bigint') return Number(value);
  return String(value);
}

/** pg satırlarını sütun tipine göre normalize eder (numeric → number, date → YYYY-MM-DD). */
export function normalizeRows(columns: ColumnMeta[], raw: Record<string, unknown>[]): ResultRow[] {
  return raw.map((row) => {
    const out: ResultRow = {};
    for (const c of columns) {
      const v = normalizeCell(row[c.key]);
      if (c.type === 'number' && v !== null) out[c.key] = Number(v);
      else if (c.type === 'date' && typeof v === 'string') out[c.key] = v.slice(0, 10);
      else out[c.key] = v;
    }
    return out;
  });
}

const dimKey = (columns: ColumnMeta[], row: ResultRow) =>
  columns.filter((c) => c.role === 'dimension').map((c) => String(row[c.key] ?? '∅')).join('\u0001');

/** Karşılaştırma dönemini cari satırlara `<ölçü>__prev` olarak ekler. */
export function mergeCompare(columns: ColumnMeta[], current: ResultRow[], previous: ResultRow[]): { columns: ColumnMeta[]; rows: ResultRow[] } {
  const valueCols = columns.filter((c) => c.role !== 'dimension');
  const prevByKey = new Map(previous.map((r) => [dimKey(columns, r), r]));
  const rows = current.map((row) => {
    const prev = prevByKey.get(dimKey(columns, row));
    const out: ResultRow = { ...row };
    for (const c of valueCols) out[c.key + PREV_SUFFIX] = prev ? (prev[c.key] ?? null) : null;
    return out;
  });
  const extra: ColumnMeta[] = valueCols.map((c) => ({ ...c, key: c.key + PREV_SUFFIX, label: `${c.label} (önceki)` }));
  return { columns: [...columns, ...extra], rows };
}

export type PivotTable = {
  rowDims: ColumnMeta[];
  columnValues: string[];
  measure: ColumnMeta;
  rows: { key: string[]; cells: (number | null)[]; total: number }[];
  columnTotals: number[];
  grandTotal: number;
};

/** Resolve only exact aliases, explicit source metadata or canonical compiler aliases. */
export function resolveResultColumn(columns: ColumnMeta[], reference: string): ColumnMeta | undefined {
  const exact = columns.find((column) => column.key === reference);
  if (exact) return exact;
  const candidates = columns.filter((column) => {
    if (column.key.endsWith(PREV_SUFFIX)) return false;
    if (column.sourceField) return column.sourceField === reference;
    if (column.role === 'measure') return column.key === 'm_' + reference;
    if (column.role === 'calculated') return column.key === 'c_' + reference;
    return column.key === 'd_' + reference || (column.type === 'date' && column.grain && column.grain !== 'day' && column.key === 'd_' + reference + '_' + column.grain);
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function resolvePivotColumn(columns: ColumnMeta[], reference?: string): ColumnMeta | undefined {
  const column = reference ? resolveResultColumn(columns, reference) : columns.filter((item) => item.role === 'dimension').at(-1);
  return column?.role === 'dimension' ? column : undefined;
}

/** First enabled match; relative thresholds are percentages of another metric in the same row. */
export function resolveConditionalRule(rules: ConditionalRule[], column: string | ColumnMeta, value: unknown, columns?: ColumnMeta[], row?: Record<string, unknown>): ConditionalRule | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const key = typeof column === 'string' ? column : column.key;
  const catalog = columns ?? (typeof column === 'string' ? undefined : [column]);
  for (const rule of rules) {
    if (rule.enabled === false || (catalog ? resolveResultColumn(catalog, rule.column)?.key : rule.column) !== key) continue;
    let threshold = rule.value;
    let threshold2 = rule.value2 ?? rule.value;
    if (rule.compareColumn !== undefined) {
      const compared = catalog && resolveResultColumn(catalog, rule.compareColumn);
      if (!compared || compared.role === 'dimension' || !row || !Object.prototype.hasOwnProperty.call(row, compared.key)) continue;
      const reference = row[compared.key];
      if (typeof reference !== 'number' || !Number.isFinite(reference)) continue;
      threshold = reference * rule.value / 100;
      threshold2 = reference * (rule.value2 ?? rule.value) / 100;
    }
    if (!Number.isFinite(threshold) || !Number.isFinite(threshold2)) continue;
    const matches = rule.op === 'gt' ? value > threshold : rule.op === 'gte' ? value >= threshold : rule.op === 'lt' ? value < threshold
      : rule.op === 'lte' ? value <= threshold : rule.op === 'eq' ? value === threshold : value >= threshold && value <= threshold2;
    if (matches) return rule;
  }
  return null;
}

export function matchConditionalRule(rules: ConditionalRule[], column: string | ColumnMeta, value: unknown, columns?: ColumnMeta[], row?: Record<string, unknown>): ColorToken | null {
  return resolveConditionalRule(rules, column, value, columns, row)?.color ?? null;
}
/** Bir kırılımı sütuna açar (pivot / aylık ısı tablosu). */
export function pivot(columns: ColumnMeta[], rows: ResultRow[], pivotColumnKey: string, measureKey: string): PivotTable | null {
  const pivotCol = resolvePivotColumn(columns, pivotColumnKey);
  const measure = columns.find((c) => c.key === measureKey && c.role !== 'dimension');
  if (!pivotCol || !measure) return null;
  const rowDims = columns.filter((c) => c.role === 'dimension' && c.key !== pivotCol.key);
  const columnValues = Array.from(new Set(rows.map((r) => String(r[pivotCol.key] ?? '—')))).sort((a, b) => a.localeCompare(b, 'tr'));
  const colIndex = new Map(columnValues.map((v, i) => [v, i]));
  const map = new Map<string, { key: string[]; cells: (number | null)[] }>();
  for (const r of rows) {
    const key = rowDims.map((d) => String(r[d.key] ?? '—'));
    const k = key.join('\u0001');
    if (!map.has(k)) map.set(k, { key, cells: columnValues.map(() => null) });
    const i = colIndex.get(String(r[pivotCol.key] ?? '—'))!;
    const entry = map.get(k)!;
    entry.cells[i] = (entry.cells[i] ?? 0) + Number(r[measure.key] ?? 0);
  }
  const out = Array.from(map.values()).map((e) => ({ ...e, total: e.cells.reduce<number>((s, v) => s + (v ?? 0), 0) }));
  const columnTotals = columnValues.map((_, i) => out.reduce((s, e) => s + (e.cells[i] ?? 0), 0));
  return { rowDims, columnValues, measure, rows: out, columnTotals, grandTotal: columnTotals.reduce((s, v) => s + v, 0) };
}

const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const mf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

export function formatCell(column: Pick<ColumnMeta, 'format' | 'type' | 'grain'>, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'boolean') return value === true ? 'Evet' : 'Hayır';
  if (column.type === 'date' && typeof value === 'string') {
    const [y, m, d] = value.split('-');
    if (column.grain === 'year') return y;
    if (column.grain === 'quarter') return `${y} Ç${Math.floor((Number(m) - 1) / 3) + 1}`;
    if (column.grain === 'month') return `${m}.${y}`;
    return `${d}.${m}.${y}`;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (column.format === 'money') return mf.format(n);
  if (column.format === 'percent') return `%${nf.format(n)}`;
  return nf.format(n);
}

/** CSV (Excel uyumlu: UTF-8 BOM + ';' ayırıcı, TR yerel ayarı). Formül enjeksiyonuna karşı korumalı. */
export function toCsv(columns: ColumnMeta[], rows: ResultRow[]): string {
  const esc = (value: unknown) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => {
    const v = r[c.key];
    if (typeof v === 'number') return esc(String(v).replace('.', ','));
    return esc(v);
  }).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}
