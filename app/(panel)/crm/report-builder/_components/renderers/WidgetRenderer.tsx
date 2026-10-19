'use client';
// Widget render'ları — saf görünüm katmanı. İleride components/ui ile değiştirilebilir:
// yalnız bu klasör değişir, veri sözleşmesi (ReportResult / WidgetData) sabit kalır.
import type { ReactNode } from 'react';
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
  const settings = new Map((style?.columns ?? []).map((c) => [c.key, c]));
  return result.columns
    .filter((c) => !settings.get(c.key)?.hidden)
    .map((c) => ({ col: { ...c, label: settings.get(c.key)?.label || c.label }, format: settings.get(c.key)?.format ?? (c.role !== 'dimension' ? style?.numberFormat : undefined) }));
}

export function KpiStrip({ result, style, onDrill }: { result: ReportResult; style?: Style; onDrill?: RecordDrillHandler }) {
  const row = result.rows[0] ?? {};
  const measures = visibleColumns(result, style).filter((c) => c.col.role !== 'dimension' && !c.col.key.endsWith(PREV_SUFFIX));
  if (!measures.length) return <p className="pax-empty text-sm">Ölçü yok</p>;
  return (
    <div className="grid h-full gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}>
      {measures.map(({ col, format }) => {
        const v = row[col.key];
        const prev = row[col.key + PREV_SUFFIX];
        const matched=resolveConditionalRule(style?.conditional??[],col,v,result.columns,row);
        const rc=matched?.color;
        const delta = typeof v === 'number' && typeof prev === 'number' && prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null;
        return (
          <div key={col.key} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', borderTop: `3px solid ${TOKEN_CSS[rc ?? style?.accent ?? 'primary']}` }}>
            <div className="text-xs text-[var(--muted)]">{col.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{onDrill ? <button type="button" className="cursor-pointer underline decoration-dotted underline-offset-4" title="Katkıda bulunan kayıtlar" onClick={() => onDrill(row, col)}>{fmt(col, v, format)}</button> : fmt(col, v, format)}</div>
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

export function DataTableView({ result, style, onDrill }: { result: ReportResult; style?: Style; onDrill?: RecordDrillHandler }) {
  const cols = visibleColumns(result, style);
  const pad = DENSITY_PAD[style?.density ?? 'normal'];
  if (!result.rows.length) return <p className="pax-empty text-sm">Kayıt yok</p>;
  return (
    <div className="h-full overflow-auto">
      <table className="pax-table w-full">
        <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
          <tr>{cols.map(({ col }) => <th key={col.key} scope="col" className={`${pad} ${col.role !== 'dimension' ? 'text-right' : 'text-left'}`}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i}>
              {cols.map(({ col, format }) => {
                const matched=resolveConditionalRule(style?.conditional??[],col,r[col.key],result.columns,r);const rc=matched?.color;
                const bar=style?.columns.find(c=>c.key===col.key)?.dataBar?dataBarExtent(result.rows.map(row=>row[col.key]),r[col.key]):null;
                const barColor=TOKEN_SOFT[rc??style?.accent??'primary'];
                const backgroundImage=bar?`linear-gradient(to right, transparent ${bar.start*100}%, ${barColor} ${bar.start*100}%, ${barColor} ${(bar.start+bar.width)*100}%, transparent ${(bar.start+bar.width)*100}%)`:undefined;
                return (
                  <td key={col.key} className={`${pad} ${col.role !== 'dimension' ? 'text-right tabular-nums' : ''}`} style={{...(rc?{backgroundColor:TOKEN_SOFT[rc],color:TOKEN_CSS[rc],fontWeight:600}:{}),backgroundImage}}>
                    {onDrill && col.role !== 'dimension' && !col.key.endsWith(PREV_SUFFIX) ? <button type="button" className="cursor-pointer underline decoration-dotted underline-offset-4" title="Katkıda bulunan kayıtlar" onClick={() => onDrill(r, col)}>{fmt(col, r[col.key], format)}</button> : fmt(col, r[col.key], format)}{matched?.label&&<span className="ml-2 inline-block text-[10px] font-medium">{matched.label}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {result.truncated && <p className="mt-1 text-xs text-[var(--muted)]">Satır limiti nedeniyle kesildi.</p>}
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
                      {drillRow && onDrill ? <button type="button" className="cursor-pointer underline decoration-dotted underline-offset-4" title="Katkıda bulunan kayıtlar" onClick={() => onDrill(drillRow, measure)}>{fmt(measure, v, style?.numberFormat)}</button> : v === null ? '' : fmt(measure, v, style?.numberFormat)}{isForecast && <span className="sr-only"> (tahmin)</span>}{matched?.label&&<span className="ml-2 text-[10px]">{matched.label}</span>}
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
    default: return <DataTableView result={r} style={widget.style} onDrill={onDrill} />;
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
