import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Section } from './Section';
import { Badge, toneFor, type Tone } from './Badge';
import { cn } from './cn';

export type Column<T> = {
  key: string;
  label: string;
  value: (r: T) => string | number | null;
  render?: (r: T) => ReactNode;
  num?: boolean;
  /** Hücreye ek sınıf (ör. durum tonu) */
  cellClass?: (r: T) => string | undefined;
  /** true: değer metninden otomatik tonlu rozet; fonksiyon: tonu sen ver */
  badge?: boolean | ((r: T) => Tone);
};

const nf = new Intl.NumberFormat('tr-TR');

export function downloadCsv<T>(name: string, cols: Column<T>[], rows: T[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [cols.map((c) => esc(c.label)).join(';'), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const th =
  'ds-thead sticky top-0 z-[1] border-0 border-b border-solid border-border px-3 py-2 text-left text-[11px] font-bold tracking-wider whitespace-nowrap text-thead-text uppercase';
export const td = 'border-0 border-b border-solid border-border/70 px-3 py-1.5 whitespace-nowrap';
export const numCls = 'text-right tabular-nums';

/** Sıralanabilir, CSV'li, sticky başlıklı, kendi içinde kayan tablo. */
export function DataTable<T>({
  title,
  rows,
  columns,
  csvName,
  loading,
  emptyText = 'Kayıt yok',
  tall = false,
  footer,
  sortable = true,
}: {
  title?: ReactNode;
  rows: T[];
  columns: Column<T>[];
  csvName?: string;
  loading?: boolean;
  emptyText?: string;
  /** true: 75vh, false: 560px üst sınır */
  tall?: boolean;
  footer?: ReactNode;
  sortable?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'tr') * sort.dir;
    });
  }, [rows, columns, sort]);

  const empty = cn(td, 'py-6 text-center text-text-4');
  const table = (
    <div className={cn('overflow-auto overscroll-x-contain', tall ? 'max-h-[75vh]' : 'max-h-[560px]')}>
      <table className="w-full border-collapse text-[13px] leading-5 text-text-2">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                className={cn(th, c.num && 'text-right', sortable && 'cursor-pointer select-none hover:text-accent')}
                onClick={
                  sortable
                    ? () => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.num ? -1 : 1 }))
                    : undefined
                }
              >
                {c.label}
                {sort?.key === c.key && <span className="ml-1 text-accent">{sort.dir === 1 ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className={empty}>Yükleniyor…</td>
            </tr>
          ) : sorted.length ? (
            sorted.map((r, i) => (
              <tr key={i} className="transition-colors even:bg-row-zebra hover:bg-row-hover">
                {columns.map((c) => {
                  const v = c.value(r);
                  return (
                    <td key={c.key} className={cn(td, c.num && numCls, c.cellClass?.(r))}>
                      {c.render ? c.render(r) : c.badge && v != null && v !== '' ? <Badge tone={typeof c.badge === 'function' ? c.badge(r) : toneFor(String(v))}>{v}</Badge> : typeof v === 'number' ? nf.format(v) : v ?? '–'}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className={empty}>{emptyText}</td>
            </tr>
          )}
        </tbody>
        {footer}
      </table>
    </div>
  );

  if (!title) return <div className="min-w-0 overflow-hidden rounded-xl border border-solid border-border bg-surface shadow-ds">{table}</div>;
  return (
    <Section
      title={title}
      count={loading ? undefined : rows.length}
      actions={
        csvName && (
          <Button size="sm" variant="ghost" onClick={() => downloadCsv(csvName, columns, sorted)}>
            CSV
          </Button>
        )
      }
    >
      {table}
    </Section>
  );
}
