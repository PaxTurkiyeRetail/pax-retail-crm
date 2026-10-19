import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'accent' | 'info' | 'ok' | 'warn' | 'danger' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6';
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-text-2',
  accent: 'text-accent',
  info: 'text-info',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  c1: 'text-c1',
  c2: 'text-c2',
  c3: 'text-c3',
  c4: 'text-c4',
  c5: 'text-c5',
  c6: 'text-c6',
};
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2 ring-border',
  accent: 'bg-accent-soft text-accent ring-accent/25',
  info: 'bg-info-soft text-info ring-info/25',
  ok: 'bg-ok-soft text-ok ring-ok/25',
  warn: 'bg-warn-soft text-warn ring-warn/25',
  danger: 'bg-danger-soft text-danger ring-danger/25',
  c1: 'bg-c1-soft text-c1 ring-c1/25',
  c2: 'bg-c2-soft text-c2 ring-c2/25',
  c3: 'bg-c3-soft text-c3 ring-c3/25',
  c4: 'bg-c4-soft text-c4 ring-c4/25',
  c5: 'bg-c5-soft text-c5 ring-c5/25',
  c6: 'bg-c6-soft text-c6 ring-c6/25',
};
export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-text-4', accent: 'bg-accent', info: 'bg-info', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger',
  c1: 'bg-c1', c2: 'bg-c2', c3: 'bg-c3', c4: 'bg-c4', c5: 'bg-c5', c6: 'bg-c6',
};

const CATS: Tone[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

/** Durum/faz metninden ton: bilinen kelimeler semantik, diğerleri sabit kategori rengi. */
export function toneFor(text: string | null | undefined): Tone {
  const t = String(text ?? '').toLocaleLowerCase('tr-TR').trim();
  if (!t || t === '–' || t === '-') return 'neutral';
  if (/(kazan|tamam|aktif|onay|gerçekleş|satış|won|imza|kuruldu|canlı)/.test(t)) return 'ok';
  if (/(kayıp|kaybed|iptal|red|ret|gecik|lost|pasif|feshed|sonlan)/.test(t)) return 'danger';
  if (/(bekle|beklemede|bugün|askı|durdur|teklif|müzakere|pazarlık)/.test(t)) return 'warn';
  if (/(plan|yeni|görüşme|demo|ilk|aday|lead|potansiyel)/.test(t)) return 'info';
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return CATS[h % CATS.length];
}

/** Dolgulu, nokta göstergeli rozet. */
export function Badge({ tone = 'neutral', dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset',
        TONE_SOFT[tone],
      )}
    >
      {dot && <i className={cn('inline-block size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Metinden otomatik tonlu rozet (Faz/Durum kolonları). */
export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-text-4">–</span>;
  return <Badge tone={toneFor(value)}>{value}</Badge>;
}
