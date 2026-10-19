import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
const T: Record<Tone, string> = {
  neutral: 'text-text-3 border-border',
  accent: 'text-accent border-accent-border',
  ok: 'text-ok border-ok/30',
  warn: 'text-warn border-warn/30',
  danger: 'text-danger border-danger/30',
};

/** Ölçülü rozet: dolgu yok, ince kenarlık, küçük metin. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-[2px] border border-solid px-1.5 text-[11px] font-medium whitespace-nowrap', T[tone])}>
      {children}
    </span>
  );
}
