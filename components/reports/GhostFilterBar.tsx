// HAYALET EKRAN FİLTRE ÇUBUĞU — /crm/kirilim ve /crm/hareketsiz (Sinan, 17.09.2026):
//   "hayalet ekranlara Canlı Ekran'daki linkten gidince filtre ve sayı gelsin."
// Bu iki sayfa menüde yoktur, yalnız Canlı Ekran'daki kutulardan yeni sekmede açılır; filtre o güne
// kadar YALNIZ URL'de gizliydi — hangi kişi/yıl/tip görüntülendiği ekranda yazmıyordu, değiştirmek için
// URL elle düzenlenmeliydi. Çubuk, linkten gelen değeri seçili gösterir ve değiştirmeye izin verir.
//
// Sunucu bileşeni, istemci JS'i YOK (TV'de açılır; sayfa tek seferde basılır): `<form method="get">`
// + `<select>` + "Uygula" düğmesi. Adres çubuğuyla aynı parametreler kullanılır, böylece Canlı
// Ekran'ın ürettiği linkler ve elle yazılan adresler aynı kapıdan geçer (drilldown-shared.parse…).

import type { ReactNode } from 'react';

export type GhostFilterOption = { value: string; label: string };
export type GhostFilterField = {
  name: string;
  label: string;
  value: string;
  options: GhostFilterOption[];
};

export function GhostFilterBar({
  action,
  fields,
  hidden,
  className,
  children,
}: {
  action: string;
  fields: GhostFilterField[];
  /** Değiştirilmeyen ama korunması gereken parametreler (ör. model, sıralama). */
  hidden?: Record<string, string | null | undefined>;
  className: string;
  children?: ReactNode;
}) {
  return (
    <form method="get" action={action} className={className} aria-label="Filtre">
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input type="hidden" name={name} value={value} key={name} /> : null))}
      {fields.map((field) => (
        <label key={field.name}>
          <span>{field.label}</span>
          <select name={field.name} defaultValue={field.value}>
            {field.options.map((option) => (
              <option value={option.value} key={option.value || '__all'}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit">Uygula</button>
      {children}
    </form>
  );
}

/** Yıl seçenekleri: bu yıl ve önceki iki yıl (canlı veri 2026'da başladı; geri gitmek isteyen için). */
export function yearOptions(currentYear: number, selected: number): GhostFilterOption[] {
  const years = new Set([currentYear, currentYear - 1, currentYear - 2, selected]);
  return Array.from(years).filter((year) => year >= 2020).sort((a, b) => b - a).map((year) => ({ value: String(year), label: String(year) }));
}

/** Satıcı seçenekleri: "Tümü" + sabit satıcı sırası; linkten gelen ad listede yoksa o da eklenir (kaybolmasın). */
export function ownerOptions(order: readonly string[], selected: string | null): GhostFilterOption[] {
  const names = [...order];
  if (selected && !names.includes(selected)) names.push(selected);
  return [{ value: '', label: 'Tümü' }, ...names.map((name) => ({ value: name, label: name }))];
}
