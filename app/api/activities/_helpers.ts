export const DURUM_CANONICAL: Record<string, string> = {
  'Başlamadı': 'Başlamadı',
  'Devam ediyor': 'Devam Ediyor',
  'Devam Ediyor': 'Devam Ediyor',
  'Tamamlandı': 'Tamamlandı',
  'İhtiyaç duyulmadı': 'İhtiyaç Duyulmadı',
  'İhtiyaç Duyulmadı': 'İhtiyaç Duyulmadı',
};

export function normalizeDurum(value: string | null | undefined): string | null {
  if (!value) return null;
  return DURUM_CANONICAL[String(value).trim()] ?? String(value).trim();
}

export function presentDurum(value: string | null | undefined): string | null {
  const v = normalizeDurum(value);
  if (!v) return null;
  if (v === 'Devam Ediyor') return 'Devam ediyor';
  if (v === 'İhtiyaç Duyulmadı') return 'İhtiyaç duyulmadı';
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
