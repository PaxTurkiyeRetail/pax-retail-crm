import type { ReactNode } from 'react';

/** Sayfa başlığı: marka gradyanlı başlık, canlı meta. actions sağda (mobilde alta iner). */
export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="m-0 bg-gradient-to-r from-brand-navy to-brand bg-clip-text text-[22px] leading-8 font-bold tracking-tight text-transparent dark:from-white dark:to-brand-2">
          {title}
        </h1>
        {meta && (
          <p className="m-0 mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
            <i className="inline-block size-1.5 shrink-0 rounded-full bg-ok shadow-[0_0_0_3px_var(--ds-ok-soft)]" aria-hidden="true" />
            <span className="min-w-0 truncate">{meta}</span>
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
