'use client';
// Widget render'ları — saf görünüm katmanı. İleride components/ui ile değiştirilebilir:
// yalnız bu klasör değişir, veri sözleşmesi (ReportResult / WidgetData) sabit kalır.
import { useMemo, useState, type ReactNode } from 'react';
import type { ColumnMeta } from '@/lib/report-builder/types';
import type { ColorToken, PageWidget } from '@/lib/report-builder/page-types';
import type { WidgetData } from '@/lib/report-builder/pdf';
import { formatCell, pivot, resolvePivotColumn, resolveConditionalRule, PREV_SUFFIX, type ReportResult } from '@/lib/report-builder/result';
import { BarLineChart, PieChart, type DrillHandler } from './Charts';
import { dataBarExtent } from '@/lib/report-builder/visual-format';
import { DENSITY_PAD, TOKEN_CSS, TOKEN_SOFT } from './tokens';

export type RecordDrillHandler = (row: Record<string, unknown>, column: ColumnMeta) => void;

type Style = Extract<PageWidget, { query: unknown }>['style'];
type NumberFormat = NonNullable<Style['numberFormat']>;

/** Drill-down değeri: global/stüdyo button stillerini (kenarlık, padding, min-height, kalın font) sıfırlar; metin gibi görünür. */
const DRILL_BTN = 'inline! min-h-0! cursor-pointer rounded-none! border-0! bg-transparent! p-0! font-[inherit]! text-inherit! shadow-none! underline-offset-4 hover:underline hover:text-[var(--accent)]! hover:translate-y-0!';

const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

function fmt(col: ColumnMeta, v: unknown, override?: NumberFormat): string {
  if (override && typeof v === 'number') {
    if (override === 'compact') return compact.format(v);
    return formatCell({ ...col, format: override }, v);
  }
  return formatCell(col, v);
}

/** Sütun ayarlarını (etiket / gizle / format) uygular. */
function visibleColumns(result: ReportResult, style?: Style) {
  return result.columns
    .filter((c) => !columnSetting(style, c)?.hidden)
    .map((c) => { const s = columnSetting(style, c); return { col: { ...c, label: s?.label || c.label }, format: s?.format ?? (c.role !== 'dimension' ? style?.numberFormat : undefined), setting: s }; });
}

/** Sütun ayarı: sonuç anahtarı (SQL alias) veya kaynak alan adıyla eşleşir. */
function columnSetting(style: Style | undefined, c: ColumnMeta) {
  const list = style?.columns ?? [];
  return list.find((s) => s.key === c.key) ?? (c.sourceField ? list.find((s) => s.key === c.sourceField) : undefined);
}

export function KpiStrip({ result, style, onDrill }: { result: ReportResult; style?: Style; onDrill?: RecordDrillHandler }) {
  const row = result.rows[0] ?? {};
  const measures = visibleColumns(result, style).filter((c) => c.col.role !== 'dimension' && !c.col.key.endsWith(PREV_SUFFIX));
  if (!measures.length) return <p className="pax-empty text-sm">Ölçü yok</p>;
  return (
    <div className="grid h-full gap-[9px]" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))` }}>
      {measures.map(({ col, format }) => {
        const v = row[col.key];
        const prev = row[col.key + PREV_SUFFIX];
        const matched=resolveConditionalRule(style?.conditional??[],col,v,result.columns,row);
        const rc=matched?.color;
        const delta = typeof v === 'number' && typeof prev === 'number' && prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null;
        return (
          <div key={col.key} className="min-h-[82px] rounded-[9px] border bg-[var(--surface)] px-[14px] py-3 tabular-nums" style={{ borderColor: 'var(--border)', ...(rc ? { boxShadow: `inset 3px 0 0 ${TOKEN_CSS[rc]}` } : {}) }}>
            <div className="mb-1.5 text-[11px] text-[var(--muted)]">{col.label}</div>
            <div className="text-[23px] leading-[1.2] font-extrabold tracking-[-0.6px] text-[var(--text)]">{onDrill ? <button type="button" className={DRILL_BTN} title="Katkıda bulunan kayıtlar" onClick={() => onDrill(row, col)}>{fmt(col, v, format)}</button> : fmt(col, v, format)}</div>
            {matched?.label&&<div className="mt-1 text-xs font-medium">{matched.label}</div>}
            {delta !== null && (
              <div className="mt-0.5 text-xs tabular-nums" style={{ color: TOKEN_CSS[delta >= 0 ? 'success' : 'danger'] }}>
                <span aria-hidden>{delta >= 0 ? '▲' : '▼'}</span> %{Math.abs(delta).toFixed(1)}
                <span className="sr-only">{delta >= 0 ? ' artış' : ' azalış'}</span>
                <span className="text-[var(--muted)]"> · önceki {fmt(col, prev, format)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function sumOf(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((a, r) => a + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
}

function groupRows<T extends Record<string, unknown>>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const r of rows) { const k = String(r[key] ?? '').trim(); (map.get(k) ?? map.set(k, []).get(k)!).push(r); }
  return [...map].sort(([a], [b]) => groupRank(a) - groupRank(b) || a.localeCompare(b, 'tr')).map(([k, rs]) => ({ key: k, rows: rs }));
}

const TOOL_BTN = 'inline-flex! h-7! min-h-7! items-center! gap-1 rounded-md! border! border-[var(--border)]! bg-[var(--surface)]! px-2.5! py-0! text-[12px]! font-medium! leading-none! shadow-none! hover:translate-y-0! hover:bg-[var(--surface-2)]!';

/** Grup sırası: bilinen segmentler önce (Hunter → Farmer → Lead → Bank), diğerleri alfabetik. */
const GROUP_ORDER = ['Hunter', 'Farmer', 'Lead', 'Bank', 'Kasa Firması'];
/** Segment renkleri: sekme, blok başlığı ve ara toplamda aynı renk. */
const GROUP_COLOR: Record<string, string> = { Hunter: '#2563eb', Farmer: '#16a34a', Lead: '#d97706', Bank: '#7c3aed', 'Kasa Firması': '#0891b2' };
const EXTRA_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#dc2626', '#0d9488', '#9333ea'];
const groupColor = (k: string) => {
  if (GROUP_COLOR[k]) return GROUP_COLOR[k];
  if (!k) return '#64748b';
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_COLORS[h % EXTRA_COLORS.length];
};
const groupRank = (k: string) => { const i = GROUP_ORDER.indexOf(k); return i < 0 ? GROUP_ORDER.length : i; };

export function DataTableView({ result, style, onDrill, groupBy }: { result: ReportResult; style?: Style; onDrill?: RecordDrillHandler; groupBy?: string }) {
  const allCols = visibleColumns(result, style);
  const groupCol = groupBy ? result.columns.find((c) => c.key === groupBy || (c as { sourceField?: string }).sourceField === groupBy) : undefined;
  const cols = groupCol ? allCols.filter(({ col }) => col.key !== groupCol.key) : allCols;
  const pad = DENSITY_PAD[style?.density ?? 'normal'];
  const [fit, setFit] = useState(true);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<string | null>(null);
  const [subtotals, setSubtotals] = useState(true);
  const segTabs = useMemo(() => (groupCol ? groupRows(result.rows, groupCol.key).map((g) => ({ key: g.key, count: g.rows.length })) : []), [result.rows, groupCol]);
  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    const base = groupCol && seg != null ? result.rows.filter((r) => String(r[groupCol.key] ?? '').trim() === seg) : result.rows;
    let out = needle ? base.filter((r) => cols.some(({ col }) => String(r[col.key] ?? '').toLocaleLowerCase('tr').includes(needle))) : base;
    if (sort) {
      const { key, dir } = sort;
      out = [...out].sort((a, b) => {
        const x = a[key], y = b[key];
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'tr', { numeric: true }) * dir;
      });
    }
    return out;
  }, [result.rows, q, sort, cols, groupCol, seg]);
  const startResize = (key: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = e.clientX, startW = th.getBoundingClientRect().width;
    const move = (ev: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(60, Math.round(startW + ev.clientX - startX)) }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  if (!result.rows.length) return <p className="pax-empty text-sm">Kayıt yok</p>;
  const downloadCsv = () => {
    const all = groupCol ? [{ col: groupCol }, ...cols] : cols;
    const esc = (v: unknown) => { const t = v == null ? '' : String(v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const lines = [all.map(({ col }) => esc(col.label)).join(';'), ...rows.map((r) => all.map(({ col }) => esc(r[col.key])).join(';'))];
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'rapor.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const customWidth = Object.keys(widths).length > 0;
  // Ara toplam yalnız toplanabilir ölçülerde (oran/ortalama/yüzde ve önceki dönem kolonları hariç).
  const sumCols = groupCol ? cols.filter(({ col }) => col.role !== 'dimension' && !col.key.endsWith(PREV_SUFFIX) && !/avg|ratio|rate|pct|oran|ortalama|%|customer_count|distinct/i.test(col.key + ' ' + col.label) && result.rows.some((r) => typeof r[col.key] === 'number')).map(({ col }) => col.key) : [];
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {segTabs.length > 1 && (
        <div role="tablist" aria-label="Segment" className="flex flex-wrap gap-1.5">
          {[{ key: null as string | null, label: 'Tümü', count: result.rows.length }, ...segTabs.map((t) => ({ key: t.key as string | null, label: t.key || '—', count: t.count }))].map((t) => {
            const on = seg === t.key;
            return (
              <button key={t.label} type="button" role="tab" aria-selected={on} onClick={() => setSeg(t.key)}
                style={on && t.key ? { background: groupColor(t.key), borderColor: groupColor(t.key) } : undefined} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]'}`}>{t.key ? <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: on ? '#fff' : groupColor(t.key) }} /> : null}
                {t.label} <span className={`ml-1 tabular-nums ${on ? 'text-white/80' : 'text-[var(--muted)]'}`}>{t.count.toLocaleString('tr-TR')}</span>
              </button>
            );
          })}
        </div>
      )}
      {sumCols.length > 1 && groupCol?.key === 'portfolio_segment' && (() => {
        const accent = seg ? groupColor(seg) : 'var(--accent)';
        const stages = [{ label: 'Firma', value: rows.length }, ...sumCols.map((k) => { const c = cols.find((x) => x.col.key === k)!; return { label: c.col.label, value: sumOf(rows, k), col: c.col, format: c.format }; })];
        return (
          <div aria-label="Dönüşüm hunisi" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))` }}>
            {stages.map((st, i) => {
              // Aşama = bu ölçüsü > 0 olan firma sayısı; oran tüm firmalara göre.
              const hit = i > 0 && 'col' in st && st.col ? rows.filter((r) => typeof r[st.col!.key] === 'number' && (r[st.col!.key] as number) > 0).length : 0;
              const pct = rows.length ? Math.round((hit / rows.length) * 100) : 0;
              return (
                <div key={st.label} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2" style={{ boxShadow: `inset 0 3px 0 ${accent}` }}>
                  <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]" title={st.label}>{st.label}</div>
                  <div className="text-[18px] font-extrabold tabular-nums text-[var(--text)]">{'col' in st && st.col ? fmt(st.col, st.value, st.format) : st.value.toLocaleString('tr-TR')}</div>
                  {i === 0 ? <div className="text-[11px] text-[var(--muted)]">{seg ?? 'Tüm segmentler'}</div> : (
                    <div title={`${hit} / ${rows.length} firmada var`}>
                      <div className="text-[11px] tabular-nums text-[var(--muted)]">{hit.toLocaleString('tr-TR')} firmada · %{pct}</div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface),var(--surface-2))] px-2.5 py-2 text-[12px] text-[var(--muted)]">
        <label className="relative flex items-center">
          <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-2.5 text-[var(--muted)]"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tabloda ara…" aria-label="Tabloda ara" className="h-8! min-h-8! w-60 rounded-lg! border border-[var(--border)] bg-[var(--surface)] pr-2.5! pl-8! text-[12.5px]! text-[var(--text)]" />
        </label>
        <span className="font-semibold tabular-nums text-[var(--text)]">{rows.length.toLocaleString('tr-TR')}{rows.length !== result.rows.length ? ` / ${result.rows.length.toLocaleString('tr-TR')}` : ''} kayıt</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={TOOL_BTN} onClick={downloadCsv} title="Görünen satırları CSV olarak indir">⤓ CSV indir</button>
          <details className="relative">
            <summary aria-label="Tablo seçenekleri" className={`${TOOL_BTN} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>⋯</summary>
            <div className="absolute right-0 z-20 mt-1 grid min-w-48 gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-[12.5px] text-[var(--text)] shadow-lg">
              <button type="button" className="rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-2)]" onClick={() => { setFit((v) => !v); setWidths({}); }}>{fit ? '↔ Sütunları genişlet' : '⇔ Ekrana sığdır'}</button>
              {groupCol && sumCols.length > 0 && <button type="button" className="rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-2)]" onClick={() => setSubtotals((v) => !v)}>{subtotals ? '✓ ' : ''}Grup ara toplamları</button>}
            </div>
          </details>
          {(customWidth || sort) && <button type="button" className={TOOL_BTN} onClick={() => { setWidths({}); setSort(null); }}>Sıfırla</button>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)] [scrollbar-color:var(--muted)_transparent] [scrollbar-gutter:stable] [scrollbar-width:auto]">
      <table className="pax-table" style={{ width: fit && !customWidth ? '100%' : 'max-content', minWidth: fit && !customWidth ? `max(100%, ${cols.length * 120}px)` : '100%', tableLayout: fit || customWidth ? 'fixed' : 'auto' }}>
        <thead className="sticky top-0 z-[1] shadow-[0_1px_0_var(--border)]" style={{ background: 'var(--surface)' }}>
          <tr>{cols.map(({ col }) => {
            const active = sort?.key === col.key;
            return (
              <th key={col.key} scope="col" aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25, verticalAlign: 'bottom', textAlign: col.role !== 'dimension' ? 'right' : 'left', ...(widths[col.key] ? { width: widths[col.key] } : {}) }}
                className={`${pad} relative cursor-pointer select-none whitespace-normal break-words ${col.role !== 'dimension' ? 'text-right' : 'text-left'}`}
                onClick={() => setSort((s) => (s?.key === col.key ? (s.dir === 1 ? { key: col.key, dir: -1 } : null) : { key: col.key, dir: 1 }))}>
                {col.label}<span aria-hidden className="ml-1 text-[10px] opacity-60">{active ? (sort!.dir === 1 ? '▲' : '▼') : '↕'}</span>
                <span role="separator" aria-orientation="vertical" aria-label={`${col.label} genişliğini ayarla`} onPointerDown={(e) => startResize(col.key, e)} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setWidths((w) => { const n = { ...w }; delete n[col.key]; return n; }); }}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize border-r-2 border-transparent hover:border-[var(--accent)]" />
              </th>
            );
          })}</tr>
        </thead>
        <tbody>
          {(groupCol && seg == null ? groupRows(rows, groupCol.key) : [{ key: '', rows }]).flatMap((g) => [
            ...(groupCol && seg == null ? [
              <tr key={`g-${g.key}`} style={{ background: `${groupColor(g.key)}12` }}>
                <th scope="colgroup" colSpan={cols.length} style={{ boxShadow: `inset 4px 0 0 ${groupColor(g.key)}`, color: groupColor(g.key) }} className={`${pad} text-left text-[13px] font-bold`}>
                  {g.key || '—'} <span className="ml-1 text-[11px] font-medium text-[var(--muted)]">{g.rows.length.toLocaleString('tr-TR')} kayıt</span>
                </th>
              </tr>,
            ] : []),
            ...g.rows.map((r, i) => (
            <tr key={`${g.key}-${i}`}>
              {cols.map(({ col, format, setting }) => {
                const matched=resolveConditionalRule(style?.conditional??[],col,r[col.key],result.columns,r);const rc=matched?.color;
                const bar=setting?.dataBar?dataBarExtent(result.rows.map(row=>row[col.key]),r[col.key]):null;
                const barColor=TOKEN_SOFT[rc??style?.accent??'primary'];
                // Bar sağdan başlar (sayılar sağa yaslı), hücre içinde ince ve dikey ortalı; satır ızgarasını bozmaz.
                const barStyle=bar?{backgroundImage:`linear-gradient(to left, transparent ${bar.start*100}%, ${barColor} ${bar.start*100}%, ${barColor} ${(bar.start+bar.width)*100}%, transparent ${(bar.start+bar.width)*100}%)`,backgroundRepeat:'no-repeat',backgroundSize:'calc(100% - 12px) 70%',backgroundPosition:'center',backgroundClip:'padding-box'}:{};
                return (
                  <td key={col.key} className={`${pad} ${fit || customWidth ? 'break-words whitespace-normal' : 'whitespace-nowrap'} ${col.role !== 'dimension' ? 'text-right tabular-nums' : ''}`} style={{...(rc?{backgroundColor:TOKEN_SOFT[rc],color:TOKEN_CSS[rc],fontWeight:600}:{}),...barStyle}}>
                    {onDrill && col.role !== 'dimension' && !col.key.endsWith(PREV_SUFFIX) ? <button type="button" className={DRILL_BTN} title="Katkıda bulunan kayıtlar" onClick={() => onDrill(r, col)}>{fmt(col, r[col.key], format)}</button> : fmt(col, r[col.key], format)}{matched?.label&&<span className="ml-2 inline-block text-[10px] font-medium">{matched.label}</span>}
                  </td>
                );
              })}
            </tr>
          )),
            ...(subtotals && groupCol && seg == null && sumCols.length ? [
              <tr key={`s-${g.key}`} className="border-b-2 border-[var(--border)]">
                {cols.map(({ col, format }, ci) => (
                  <td key={col.key} className={`${pad} text-[12px] font-bold ${col.role !== 'dimension' ? 'text-right tabular-nums' : 'text-left'}`} style={{ color: groupColor(g.key) }}>
                    {ci === 0 ? `${g.key || '—'} toplamı` : sumCols.includes(col.key) ? fmt(col, sumOf(g.rows, col.key), format) : ''}
                  </td>
                ))}
              </tr>,
            ] : []),
          ])}
          {groupCol && sumCols.length && rows.length ? (
            <tr className="bg-[var(--surface-2)]">
              {cols.map(({ col, format }, ci) => (
                <td key={col.key} className={`${pad} text-[12.5px] font-extrabold text-[var(--text)] ${col.role !== 'dimension' ? 'text-right tabular-nums' : 'text-left'}`}>
                  {ci === 0 ? (seg == null ? 'Genel toplam' : `${seg || '—'} toplamı`) : sumCols.includes(col.key) ? fmt(col, sumOf(rows, col.key), format) : ''}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
      </div>
      {result.truncated && <p className="text-xs text-[var(--muted)]">Satır limiti nedeniyle kesildi.</p>}
    </div>
  );
}

/** Pivot; heatmap modunda gerçekleşen yeşil, yalnız tahmini olan hücre sarı. */
export function PivotView({ result, forecast, pivotColumn, heat, style, onDrill }: { result: ReportResult; forecast?: ReportResult; pivotColumn?: string; heat?: boolean; style?: Style; onDrill?: RecordDrillHandler }) {
  const measure = result.columns.find((c) => c.role !== 'dimension' && !c.key.endsWith(PREV_SUFFIX));
  const pc = resolvePivotColumn(result.columns, pivotColumn)?.key;
  const p = pc && measure ? pivot(result.columns, result.rows, pc, measure.key) : null;
  if (!p || !measure) return <DataTableView result={result} style={style} onDrill={onDrill} />;
  const f = forecast && pc ? pivot(forecast.columns, forecast.rows, pc, forecast.columns.find((c) => c.role !== 'dimension')?.key ?? '') : null;
  const fMap = new Map<string, number | null>();
  f?.rows.forEach((r) => f.columnValues.forEach((cv, i) => fMap.set(`${r.key.join('\u0001')}\u0002${cv}`, r.cells[i])));
  const columnValues = Array.from(new Set([...p.columnValues, ...(f?.columnValues ?? [])])).sort((a, b) => a.localeCompare(b, 'tr'));
  const pcMeta = result.columns.find((c) => c.key === pc)!;
  const pad = DENSITY_PAD[style?.density ?? 'normal'];
  const max = Math.max(1, ...p.rows.flatMap((r) => r.cells.map((v) => v ?? 0)));
  return (
    <div className="h-full overflow-auto">
      {heat && (
        <p className="mb-1 flex gap-3 text-xs text-[var(--muted)]">
          <span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TOKEN_SOFT.success }} />Gerçekleşen</span>
          {f && <span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TOKEN_SOFT.warning }} />Tahmin</span>}
        </p>
      )}
      <table className="pax-table w-full">
        <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
          <tr>
            {p.rowDims.map((d) => <th key={d.key} scope="col" className={`${pad} text-left`}>{d.label}</th>)}
            {columnValues.map((cv) => <th key={cv} scope="col" className={`${pad} text-right`}>{formatCell(pcMeta, cv)}</th>)}
            <th scope="col" className={`${pad} text-right`}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r) => {
            const k = r.key.join('\u0001');
            return (
              <tr key={k}>
                {r.key.map((v, i) => <th key={i} scope="row" className={`${pad} text-left font-normal`}>{formatCell(p.rowDims[i], v)}</th>)}
                {columnValues.map((cv) => {
                  const idx = p.columnValues.indexOf(cv);
                  const actual = idx >= 0 ? r.cells[idx] : null;
                  const fc = fMap.get(`${k}\u0002${cv}`) ?? null;
                  const isForecast = (actual === null || actual === 0) && fc !== null && fc !== 0;
                  const v = isForecast ? fc : actual;
                  const matches = onDrill && !isForecast && actual !== null ? result.rows.filter(row =>
                    String(row[pc!] ?? '—') === cv && p.rowDims.every((dim, i) => String(row[dim.key] ?? '—') === r.key[i])
                  ) : [];
                  const drillRow = matches.length === 1 ? matches[0] : undefined;
                  let bg: string | undefined;
                  const matched=resolveConditionalRule(style?.conditional??[],measure,v,result.columns,drillRow);
                  let color:ColorToken|null=matched?.color??null;
                  if (heat && v) {
                    bg = isForecast ? TOKEN_SOFT.warning : `color-mix(in srgb, ${TOKEN_CSS.success} ${Math.round(12 + 50 * ((v ?? 0) / max))}%, transparent)`;
                    color = color ?? null;
                  }
                  return (
                    <td key={cv} className={`${pad} text-right tabular-nums`} style={{ background: color ? TOKEN_SOFT[color] : bg, fontStyle: isForecast ? 'italic' : undefined }} title={isForecast ? 'Tahmin' : undefined}>
                      {drillRow && onDrill ? <button type="button" className={DRILL_BTN} title="Katkıda bulunan kayıtlar" onClick={() => onDrill(drillRow, measure)}>{fmt(measure, v, style?.numberFormat)}</button> : v === null ? '' : fmt(measure, v, style?.numberFormat)}{isForecast && <span className="sr-only"> (tahmin)</span>}{matched?.label&&<span className="ml-2 text-[10px]">{matched.label}</span>}
                    </td>
                  );
                })}
                <td className={`${pad} text-right font-semibold tabular-nums`}>{fmt(measure, r.total, style?.numberFormat)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={Math.max(1, p.rowDims.length)} className={`${pad} text-left`}>Toplam</th>
            {columnValues.map((cv) => {
              const idx = p.columnValues.indexOf(cv);
              return <td key={cv} className={`${pad} text-right font-semibold tabular-nums`}>{idx >= 0 ? fmt(measure, p.columnTotals[idx], style?.numberFormat) : ''}</td>;
            })}
            <td className={`${pad} text-right font-semibold tabular-nums`}>{fmt(measure, p.grandTotal, style?.numberFormat)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function TextBlock({ variant, text }: { variant: 'heading' | 'paragraph' | 'note'; text: string }) {
  if (variant === 'heading') return <h2 className="text-lg font-semibold">{text}</h2>;
  if (variant === 'note') return <p className="rounded-md border-l-4 p-2 text-sm" style={{ borderColor: TOKEN_CSS.info, background: TOKEN_SOFT.info }}>{text}</p>;
  return <p className="whitespace-pre-line text-sm">{text}</p>;
}

/** Veri widget'ının gövdesi. Filtre/sekme widget'ları designer/viewer'da ayrıca çizilir. */
export function DataWidgetBody({ widget, data, onDrill }: { widget: Extract<PageWidget, { query: unknown }>; data?: WidgetData; onDrill?: RecordDrillHandler }): ReactNode {
  if (!data) return <div className="h-full animate-pulse rounded-md" style={{ background: 'var(--border)', opacity: 0.35 }} aria-busy="true" aria-label="Yükleniyor" />;
  if (data.error) return <p role="alert" className="text-sm" style={{ color: TOKEN_CSS.danger }}>{data.error}</p>;
  if (!data.result) return <p className="pax-empty text-sm">Veri yok</p>;
  const r = data.result;
  const chartDrill: DrillHandler | undefined = onDrill ? (value) => {
    const dim = r.columns.find(c => c.role === 'dimension');
    const measure = r.columns.find(c => c.role !== 'dimension' && !c.key.endsWith(PREV_SUFFIX));
    const matches = dim ? r.rows.filter(row => row[dim.key] === value) : r.rows;
    const row = matches.length === 1 ? matches[0] : undefined;
    if (row && measure) onDrill(row, measure);
  } : undefined;
  switch (widget.type) {
    case 'kpi':
    case 'kpi_strip': return <KpiStrip result={r} style={widget.style} onDrill={onDrill} />;
    case 'bar':
    case 'line': return <BarLineChart result={r} kind={widget.type} accent={widget.style.accent} title={widget.title} onDrill={chartDrill} />;
    case 'pie': return <PieChart result={r} title={widget.title} onDrill={chartDrill} />;
    case 'pivot': return <PivotView result={r} pivotColumn={widget.query.visualization.pivotColumn} style={widget.style} onDrill={onDrill} />;
    case 'heatmap': return <PivotView result={r} forecast={data.forecast} pivotColumn={widget.query.visualization.pivotColumn} heat style={widget.style} onDrill={onDrill} />;
    default: return <DataTableView result={r} style={widget.style} onDrill={onDrill} groupBy={widget.pdf?.groupBy} />;
  }
}

/** Tek sorgu sonucunu (QueryBuilder önizlemesi) görselleştirme tipine göre çizer. */
export function ResultView({ result, viz, pivotColumn, title, style, onDrill }: { result: ReportResult; viz: string; pivotColumn?: string; title: string; style?: Partial<Style>; onDrill?: DrillHandler }) {
  const st = style as Style | undefined;
  if (viz === 'kpi') return <KpiStrip result={result} style={st} />;
  if (viz === 'bar' || viz === 'line') return <div className="h-64"><BarLineChart result={result} kind={viz} title={title} accent={st?.accent} onDrill={onDrill} /></div>;
  if (viz === 'pie') return <div className="h-64"><PieChart result={result} title={title} onDrill={onDrill} /></div>;
  if (viz === 'pivot' || viz === 'heatmap') return <PivotView result={result} pivotColumn={pivotColumn} heat={viz === 'heatmap'} style={st} />;
  return <DataTableView result={result} style={st} />;
}
