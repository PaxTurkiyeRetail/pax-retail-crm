// HAYALET EKRAN EK FİLTRELERİ — /crm/kirilim (Sinan, 17.09.2026).
// Ortak filtreler (Satıcı) merkezi FilterBar'dadır (mode="form"); sayfaya özel GET alanları
// (liste tipi · yıl · durum · cihaz) bu tiplerle tarif edilip aynı formun içinde basılır.

export type GhostFilterOption = { value: string; label: string };
export type GhostFilterField = {
  name: string;
  label: string;
  value: string;
  options: GhostFilterOption[];
};

/** Yıl seçenekleri: bu yıl ve önceki iki yıl (canlı veri 2026'da başladı; geri gitmek isteyen için). */
export function yearOptions(currentYear: number, selected: number): GhostFilterOption[] {
  const years = new Set([currentYear, currentYear - 1, currentYear - 2, selected]);
  return Array.from(years).filter((year) => year >= 2020).sort((a, b) => b - a).map((year) => ({ value: String(year), label: String(year) }));
}
