export const DURUM_CANONICAL: Record<string, string> = {
  'Başlamadı': 'Başlamadı',
  'Bekleniyor': 'Bekleniyor',
  'Devam Ediyor': 'Devam Ediyor',
  'Tamamlandı': 'Tamamlandı',
  'İhtiyaç Duyulmadı': 'İhtiyaç Duyulmadı',
};

function normalizeDurumKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

const DURUM_CANONICAL_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.values(DURUM_CANONICAL).map((label) => [normalizeDurumKey(label), label])
);

export function normalizeDurum(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return DURUM_CANONICAL[trimmed] ?? DURUM_CANONICAL_BY_KEY[normalizeDurumKey(trimmed)] ?? null;
}

export function presentDurum(value: string | null | undefined): string | null {
  const v = normalizeDurum(value);
  if (!v) return null;
  if (v === 'Devam Ediyor') return 'Devam Ediyor';
  if (v === 'İhtiyaç Duyulmadı') return 'İhtiyaç duyulmadı';
  if (v === 'Bekleniyor') return 'Bekleniyor';
  return v;
}

export function activityLabelFromRow(row: any): string {
  const raw = String(row?.aksiyon ?? '').trim();
  if (raw.startsWith('AKTIVITE:')) return raw.replace(/^AKTIVITE:/, '');
  if (raw === 'AKTIVITE_TAMAMLANDI') return 'Aktivite Tamamlandı';
  if (row?.durum === 'Tamamlandı' && (!raw || raw === '-')) return 'Faz Durumu Güncellendi';
  return raw || '-';
}

export function isDisplayableActivityRow(row: any): boolean {
  const label = activityLabelFromRow(row);
  const hasActivity = Boolean(label && label !== '-');
  const hasDueDate = Boolean(row?.hedef_tarihi ?? null);
  const hasNotes = Boolean(String(row?.notlar ?? '').trim());
  return hasActivity || hasDueDate || hasNotes;
}
