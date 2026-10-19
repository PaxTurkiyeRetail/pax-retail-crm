import type { ReactNode } from 'react';

/** Kart: yumuşak gölge, 12px radius, marka aksanlı başlık. pad: gövdeye iç boşluk. */
export function Section({
  title,
  count,
  actions,
  pad = false,
  children,
}: {
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  pad?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-solid border-border bg-surface shadow-ds">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-border px-3 py-1.5 sm:px-4">
        <h2 className="m-0 flex items-center gap-2 text-[13.5px] font-semibold text-text">
          <i className="inline-block h-3.5 w-1 rounded-full bg-gradient-to-b from-brand-2 to-brand-navy" aria-hidden="true" />
          {title}
          {count !== undefined && (
            <span className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[11px] font-semibold text-accent tabular-nums">
              {count.toLocaleString('tr-TR')}
            </span>
          )}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {pad ? <div className="px-3 py-2 sm:px-4">{children}</div> : children}
    </section>
  );
}
