import type { ReactNode } from 'react';

/** Sola hizalı, kompakt sayfa başlığı. actions sağda (mobilde alta iner). */
export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="m-0 text-[17px] leading-6 font-semibold tracking-tight text-text">{title}</h1>
        {meta && <p className="m-0 text-xs text-text-3">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
