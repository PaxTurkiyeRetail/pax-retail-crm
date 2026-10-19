// Tema token'ı → CSS rengi. Serbest hex yok; açık/koyu temada okunur orta tonlar.
// İleride components/ui token sistemi gelirse yalnız bu eşleme değişir.
import type { ColorToken } from '@/lib/report-builder/page-types';

export const TOKEN_CSS: Record<ColorToken, string> = {
  primary: 'var(--brand, #0e6fc7)',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0891b2',
  neutral: '#6b7280',
  accent: '#7c3aed',
};

export const TOKEN_SOFT: Record<ColorToken, string> = {
  primary: 'rgba(14,111,199,.14)',
  success: 'rgba(22,163,74,.18)',
  warning: 'rgba(234,179,8,.26)',
  danger: 'rgba(220,38,38,.16)',
  info: 'rgba(8,145,178,.16)',
  neutral: 'rgba(107,114,128,.16)',
  accent: 'rgba(124,58,237,.16)',
};

export const SERIES: ColorToken[] = ['primary', 'success', 'warning', 'danger', 'info', 'accent', 'neutral'];

export { matchConditionalRule as ruleColor } from '@/lib/report-builder/result';

export const DENSITY_PAD: Record<'compact' | 'normal' | 'comfortable', string> = {
  compact: 'px-2 py-1 text-xs',
  normal: 'px-3 py-1.5 text-sm',
  comfortable: 'px-3 py-2.5 text-sm',
};
