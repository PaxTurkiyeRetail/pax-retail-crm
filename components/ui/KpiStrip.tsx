import type { ReactNode } from 'react';
import { TONE_DOT, TONE_SOFT, TONE_TEXT, type Tone } from './Badge';
import { cn } from './cn';

export type Kpi = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Verilmezse sıraya göre kategori rengi atanır. */
  tone?: Tone;
  icon?: ReactNode;
  /** Yüzde değişim; + yeşil, − kırmızı. */
  trend?: number | null;
};

const AUTO: Tone[] = ['c1', 'c3', 'c2', 'c5', 'c4', 'c6'];

function Glyph({ label }: { label: string }) {
  const t = label.toLocaleLowerCase('tr-TR');
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (/(ciro|gelir|bedel|usd|tl|tutar|potansiyel)/.test(t))
    return <svg {...p}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
  if (/(fırsat|senaryo|tahmin|forecast|plan)/.test(t))
    return <svg {...p}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>;
  if (/(gecik|risk|fark|kayıp|bekle)/.test(t))
    return <svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;
  if (/(gerçekleş|tamam|faturalan|aktif)/.test(t))
    return <svg {...p}><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m22 4-10 10-3-3" /></svg>;
  if (/(müşteri|firma|ziyaret|kişi|satışçı)/.test(t))
    return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>;
  return <svg {...p}><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>;
}

/** Renkli KPI kartları: ikon rozeti, üst aksan çizgisi, opsiyonel trend. Mobil 2 sütun. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-3">
      {items.map((k, i) => {
        const tone = k.tone ?? AUTO[i % AUTO.length];
        return (
          <div
            key={i}
            className="group relative min-w-0 overflow-hidden rounded-xl border border-solid border-border bg-surface px-3 pt-3 pb-2.5 shadow-ds transition-shadow hover:shadow-ds-lg sm:px-4 sm:pt-3.5"
          >
            <i className={cn('absolute inset-x-0 top-0 block h-[3px] opacity-90', TONE_DOT[tone])} aria-hidden="true" />
            <div className="flex items-start justify-between gap-2">
              <dt className="min-w-0 truncate pt-0.5 text-[11.5px] font-semibold text-text-3">{k.label}</dt>
              <span className={cn('hidden size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset min-[400px]:inline-flex', TONE_SOFT[tone])}>
                {k.icon ?? <Glyph label={k.label} />}
              </span>
            </div>
            <dd className="m-0 mt-1 truncate text-[22px] leading-8 font-bold tracking-tight text-text tabular-nums">{k.value}</dd>
            {(k.sub || k.trend != null) && (
              <dd className="m-0 flex min-w-0 items-center gap-1.5 text-xs text-text-3">
                {k.trend != null && (
                  <span className={cn('inline-flex shrink-0 items-center rounded-full px-1.5 text-[11px] font-semibold', k.trend >= 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
                    {k.trend >= 0 ? '▲' : '▼'} %{Math.abs(k.trend).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                  </span>
                )}
                {k.sub && <span className={cn('truncate', TONE_TEXT[tone], 'opacity-90')}>{k.sub}</span>}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
