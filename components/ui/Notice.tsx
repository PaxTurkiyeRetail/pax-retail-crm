import type { ReactNode } from 'react';
import { cn } from './cn';

/** Satır içi uyarı/hata bandı: renkli zemin + sol aksan. */
export function Notice({ tone = 'danger', children }: { tone?: 'danger' | 'warn' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border-0 border-l-4 border-solid px-4 py-2.5 text-[13px] font-medium shadow-ds',
        tone === 'danger' && 'border-danger bg-danger-soft text-danger',
        tone === 'warn' && 'border-warn bg-warn-soft text-warn',
        tone === 'ok' && 'border-ok bg-ok-soft text-ok',
        tone === 'info' && 'border-info bg-info-soft text-info',
      )}
    >
      {children}
    </div>
  );
}
