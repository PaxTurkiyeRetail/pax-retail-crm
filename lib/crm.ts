export const HAVUZ_ACCOUNT_NAME = 'Havuz Account';

// Eski PostgreSQL enum kolonuna çift yazım için teknik uyumluluk listesi.
// Kullanıcıya sunulan/izin verilen değerler system_parameters kaynağından gelir.
export const LEGACY_INTEGRATION_ENUM_VALUES = ['A2A', 'D2D', 'D2D+A2A'] as const;

export function normalizeName(value: unknown) {
  return String(value ?? '').trim();
}

export function isHavuzAccount(value: unknown) {
  return normalizeName(value).localeCompare(HAVUZ_ACCOUNT_NAME, 'tr', { sensitivity: 'base' }) === 0;
}
