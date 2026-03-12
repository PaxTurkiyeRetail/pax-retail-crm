export const HAVUZ_ACCOUNT_NAME = 'Havuz Account';

export const ENTEGRASYON_OPTIONS = ['', 'A2A', 'D2D', 'D2D+A2A'] as const;
export const SATIS_OLASILIGI_OPTIONS = ['', 'Düşük', 'Orta', 'Yüksek'] as const;

export function normalizeName(value: unknown) {
  return String(value ?? '').trim();
}

export function isHavuzAccount(value: unknown) {
  return normalizeName(value).localeCompare(HAVUZ_ACCOUNT_NAME, 'tr', { sensitivity: 'base' }) === 0;
}
