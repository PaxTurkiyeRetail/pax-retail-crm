import type { ReactNode } from 'react';
import { cn } from './cn';

/** Satır içi uyarı/hata bandı: sol kenar çizgisi, kutu yok. */
export function Notice({ tone = 'danger', children }: { tone?: 'danger' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'border-0 border-l-2 border-solid px-3 py-2 text-[13px]',
        tone === 'danger' && 'border-danger bg-danger-soft text-danger',
        tone === 'warn' && 'border-warn bg-warn-soft text-warn',
        tone === 'ok' && 'border-ok bg-ok-soft text-ok',
      )}
    >
      {children}
    </div>
  );
}
