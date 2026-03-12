export const ACTIVITY_CHANNEL_OPTIONS = ['Telefon', 'Yerinde Ziyaret', 'Online Toplantı', 'Teknik Ziyaret', 'Teknik Online', 'E-posta', 'Diğer'] as const;
export type ActivityChannel = (typeof ACTIVITY_CHANNEL_OPTIONS)[number];

export function normalizeChannel(value: string | null | undefined): ActivityChannel {
  const raw = String(value ?? '').trim();
  if (raw === 'Telefon') return 'Telefon';
  if (raw === 'Yerinde Ziyaret') return 'Yerinde Ziyaret';
  if (raw === 'Online Toplantı') return 'Online Toplantı';
  if (raw === 'Teknik Ziyaret') return 'Teknik Ziyaret';
  if (raw === 'Teknik Online') return 'Teknik Online';
  if (raw === 'E-posta') return 'E-posta';
  return 'Diğer';
}

export function isSalesChannel(channel: string | null | undefined) {
  const normalized = normalizeChannel(channel);
  return normalized === 'Telefon' || normalized === 'Yerinde Ziyaret' || normalized === 'Online Toplantı';
}

export function isTechnicalChannel(channel: string | null | undefined) {
  const normalized = normalizeChannel(channel);
  return normalized === 'Teknik Ziyaret' || normalized === 'Teknik Online';
}
