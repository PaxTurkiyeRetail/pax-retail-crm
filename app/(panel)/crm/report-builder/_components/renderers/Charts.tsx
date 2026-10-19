'use client';
// Paketsiz SVG grafikler (bar / line / pie). Erişilebilirlik: role="img" + aria-label + gizli veri tablosu.
import { formatCell, type ReportResult } from '@/lib/report-builder/result';
import type { ColorToken } from '@/lib/report-builder/page-types';
import { SERIES, TOKEN_CSS } from './tokens';

type Point = { label: string; value: number };

function series(result: ReportResult): { points: Point[]; measureLabel: string; fmt: (v: number) => string } | null {
  const dim = result.columns.find((c) => c.role === 'dimension');
  const m = result.columns.find((c) => c.role !== 'dimension');
  if (!m) return null;
  return {
    points: result.rows.slice(0, 120).map((r) => ({ label: dim ? formatCell(dim, r[dim.key]) : m.label, value: Number(r[m.key] ?? 0) || 0 })),
    measureLabel: m.label,
    fmt: (v) => formatCell(m, v),
  };
}

function SrTable({ points, fmt, caption }: { points: Point[]; fmt: (v: number) => string; caption: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td>{fmt(p.value)}</td></tr>)}</tbody>
    </table>
  );
}

export function BarLineChart({ result, kind, accent = 'primary', title }: { result: ReportResult; kind: 'bar' | 'line'; accent?: ColorToken; title: string }) {
  const s = series(result);
  if (!s || !s.points.length) return <p className="pax-empty text-sm">Veri yok</p>;
  const W = 640; const H = 240; const L = 48; const B = 28; const T = 10;
  const max = Math.max(0, ...s.points.map((p) => p.value)) || 1;
  const min = Math.min(0, ...s.points.map((p) => p.value));
  const span = max - min || 1;
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / span);
  const step = (W - L) / s.points.length;
  const color = TOKEN_CSS[accent];
  const every = Math.max(1, Math.ceil(s.points.length / 12));
  return (
    <figure className="h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`${title}: ${s.measureLabel}`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = min + (span * i) / 4;
          return (
            <g key={i}>
              <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 4} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{s.fmt(Math.round(v))}</text>
            </g>
          );
        })}
        {kind === 'bar'
          ? s.points.map((p, i) => {
              const bw = Math.max(2, step * 0.62);
              const y0 = y(Math.max(0, min));
              return <rect key={i} x={L + step * i + (step - bw) / 2} y={Math.min(y0, y(p.value))} width={bw} height={Math.abs(y0 - y(p.value))} fill={color} rx={2}><title>{`${p.label}: ${s.fmt(p.value)}`}</title></rect>;
            })
          : (
            <>
              <polyline fill="none" stroke={color} strokeWidth={2} points={s.points.map((p, i) => `${L + step * i + step / 2},${y(p.value)}`).join(' ')} />
              {s.points.map((p, i) => <circle key={i} cx={L + step * i + step / 2} cy={y(p.value)} r={3} fill={color}><title>{`${p.label}: ${s.fmt(p.value)}`}</title></circle>)}
            </>
          )}
        {s.points.map((p, i) => (i % every === 0 ? (
          <text key={`l${i}`} x={L + step * i + step / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">{p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}</text>
        ) : null))}
      </svg>
      <SrTable points={s.points} fmt={s.fmt} caption={title} />
    </figure>
  );
}

export function PieChart({ result, title }: { result: ReportResult; title: string }) {
  const s = series(result);
  const pts = (s?.points ?? []).filter((p) => p.value > 0).slice(0, 12);
  const total = pts.reduce((a, p) => a + p.value, 0);
  if (!s || !total) return <p className="pax-empty text-sm">Veri yok</p>;
  let a0 = -Math.PI / 2;
  const R = 80;
  return (
    <figure className="flex h-full w-full flex-wrap items-center gap-4">
      <svg viewBox="-90 -90 180 180" className="h-full max-h-56 min-h-32 w-auto" role="img" aria-label={title}>
        {pts.map((p, i) => {
          const a1 = a0 + (p.value / total) * Math.PI * 2;
          const d = pts.length === 1
            ? `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`
            : `M 0 0 L ${R * Math.cos(a0)} ${R * Math.sin(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
          a0 = a1;
          return <path key={i} d={d} fill={TOKEN_CSS[SERIES[i % SERIES.length]]} stroke="var(--surface)" strokeWidth={1.5}><title>{`${p.label}: ${s.fmt(p.value)}`}</title></path>;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {pts.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: TOKEN_CSS[SERIES[i % SERIES.length]] }} />
            <span className="truncate">{p.label}</span>
            <span className="ml-auto tabular-nums text-[var(--muted)]">{s.fmt(p.value)} · %{((p.value / total) * 100).toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
