import type { ReactNode } from 'react';

/** Tek satır araç/filtre şeridi. Mobilde sarar. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-1 text-[13px] text-text-2">{children}</div>;
}

/** Yan yana etiket + kontrol (Toolbar içinde). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-text-3">{label}</span>
      {children}
    </label>
  );
}

/** Çok filtreli ekranlar: üstte etiket, altta kontrol; 1 → 2 → 4 → 6 sütun. footer sağ altta. */
export function FilterGrid({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="rounded-xl border border-solid border-border bg-surface px-3 py-3 shadow-ds sm:px-4">
      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[480px]:grid-cols-2 md:grid-cols-4 2xl:grid-cols-6">{children}</div>
      {footer && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-3">{footer}</div>}
    </div>
  );
}

export function StackField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-text-3 uppercase">{label}</span>
      {children}
    </label>
  );
}
