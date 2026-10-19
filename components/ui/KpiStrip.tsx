import type { ReactNode } from 'react';

export type Kpi = { label: string; value: ReactNode; sub?: ReactNode };

/** Kompakt KPI şeridi: kutu yok, ince ayırıcılar. Mobil 2 sütun. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 border-0 border-y border-solid border-border sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {items.map((k, i) => (
        <div
          key={i}
          className="min-w-0 border-0 border-b border-solid border-border px-3 py-2.5 odd:border-r sm:border-b-0 sm:border-r sm:last:border-r-0"
        >
          <dt className="truncate text-[11px] font-medium tracking-wide text-text-3 uppercase">{k.label}</dt>
          <dd className="m-0 truncate text-lg leading-7 font-semibold text-text tabular-nums">{k.value}</dd>
          {k.sub && <dd className="m-0 truncate text-xs text-text-4">{k.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
