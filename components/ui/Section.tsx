import type { ReactNode } from 'react';

/** Kart değil: başlık satırı + ince alt çizgi. */
export function Section({ title, count, actions, children }: { title: ReactNode; count?: number; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-border">
        <h2 className="m-0 text-[13px] font-semibold text-text">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-text-4 tabular-nums">{count.toLocaleString('tr-TR')}</span>}
        </h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
