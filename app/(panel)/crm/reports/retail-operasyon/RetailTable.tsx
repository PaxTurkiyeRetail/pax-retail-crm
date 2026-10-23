'use client';

import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, Filter, Search, X } from 'lucide-react';
import { downloadCsv, type Column } from '@/components/ui';
import { retailTableView, type RetailTableSort } from './retail-table-view';
import s from './retail-operasyon.module.css';

export type RetailColumn<T> = Column<T> & {
  filterValue?: (row: T) => string;
  searchable?: boolean;
  sortable?: boolean;
  cellStyle?: (row: T) => CSSProperties | undefined;
};
const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export default function RetailTable<T>({ title, rows, columns, name, detail, summary, rowStyle }: {
  title: string; rows: T[]; columns: RetailColumn<T>[]; name?: string;
  detail?: (row: T) => ReactNode; summary?: (rows: T[]) => T;
  rowStyle?: (row: T) => CSSProperties | undefined;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<RetailTableSort>(null);
  const activeFilters = Object.values(filters).filter(value => value.trim()).length;
  const filtered = !!query.trim() || activeFilters > 0;
  const visible = useMemo(() => retailTableView(rows, columns, query, filters, sort), [rows, columns, query, filters, sort]);
  const footer = summary?.(visible);
  const cells = (row: T) => columns.map(col => <td key={col.key} className={col.num ? s.num : ''} style={col.cellStyle?.(row)}>{col.render ? col.render(row) : typeof col.value(row) === 'number' ? nf.format(col.value(row) as number) : col.value(row) ?? '—'}</td>);
  return <section className={s.card} aria-label={title}>
    <div className={s.cardHeader}><h3>{title} <small aria-live="polite">{filtered ? `${nf.format(visible.length)} / ${nf.format(rows.length)}` : nf.format(rows.length)} kayıt</small></h3>
      {name && <button type="button" className={s.button} onClick={() => downloadCsv(name, columns, footer ? [...visible, footer] : visible)}><ArrowDownToLine size={13} />CSV indir</button>}
    </div>
    <div className={s.tableTools}>
      <label className={s.tableSearch}><Search size={16} aria-hidden="true" /><input aria-label={`${title} içinde ara`} placeholder="Bu tabloda ara…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label={`${title} aramasını temizle`} onClick={() => setQuery('')}><X size={14} /></button>}</label>
      <button type="button" className={`${s.button} ${filtersOpen ? s.filterActive : ''}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><Filter size={14} />Sütun filtreleri{activeFilters > 0 && <span className={s.filterCount}>{activeFilters}</span>}</button>
      {(filtered || sort) && <button type="button" className={s.tableReset} onClick={() => { setQuery(''); setFilters({}); setSort(null); }}><X size={13} />Temizle</button>}
      <span className={s.tableHint}>{filtered ? 'Arama ve filtreler yalnız bu tabloyu etkiler.' : 'Başlıklardan sırala · sütunlara göre filtrele'}</span>
    </div>
    <div className={s.tableWrap}><table><thead>
      <tr>{columns.map(col => <th key={col.key} className={col.num ? s.num : ''} aria-sort={col.sortable === false ? undefined : sort?.key === col.key ? sort.dir === 1 ? 'ascending' : 'descending' : 'none'}>
        {col.sortable === false ? col.label : <button type="button" className={s.sortButton} aria-label={`${col.label} sütununu sırala`} onClick={() => setSort({ key: col.key, dir: sort?.key === col.key ? sort.dir === 1 ? -1 : 1 : col.num ? -1 : 1 })}>{col.label}{sort?.key === col.key ? sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className={s.sortIdle} />}</button>}
        {filtersOpen && col.searchable !== false && <input className={s.columnFilter} aria-label={`${title} · ${col.label} filtresi`} placeholder={col.num && !col.filterValue ? 'Örn. >=100' : 'Filtrele…'} title={col.num && !col.filterValue ? 'Eşitlik: 100 · karşılaştırma: >=100 · aralık: 10..50' : `${col.label} içinde ara`} value={filters[col.key] ?? ''} onChange={event => setFilters({ ...filters, [col.key]: event.target.value })} />}
      </th>)}</tr>
    </thead><tbody>{visible.length ? visible.map((row, i) => {
      const expanded = detail?.(row);
      return <Fragment key={i}><tr style={rowStyle?.(row)}>{cells(row)}</tr>{expanded && <tr><td colSpan={columns.length} className={s.planDetail}>{expanded}</td></tr>}</Fragment>;
    }) : <tr><td colSpan={columns.length} className={s.empty}>{filtered ? 'Arama veya filtreye uyan kayıt yok.' : 'Kayıt bulunmuyor.'}</td></tr>}</tbody>
    {footer && <tfoot><tr>{cells(footer)}</tr></tfoot>}
    </table></div>
  </section>;
}
