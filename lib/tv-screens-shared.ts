// TV cihazında gösterilebilecek Dashboard sekmeleri (istemci + sunucu ortak).
export const TV_SCREENS = [
  { key: 'live', label: 'Canlı Ekran' },
  { key: 'followup', label: 'Takip Listesi' },
  { key: 'activity', label: 'Kişi Bazlı Aktivite' },
  { key: 'faz', label: 'Faz' },
] as const;

export type TvScreen = (typeof TV_SCREENS)[number]['key'];

const KEYS = TV_SCREENS.map((s) => s.key) as string[];

export function normalizeTvScreens(value: unknown): TvScreen[] {
  const list = Array.isArray(value) ? value.filter((v): v is TvScreen => typeof v === 'string' && KEYS.includes(v)) : [];
  const unique = TV_SCREENS.map((s) => s.key).filter((k) => list.includes(k));
  return unique.length ? unique : ['live'];
}
