/**
 * PAX CRM — Shared Utility Functions
 * Tüm component'lerde tekrar eden yardımcı fonksiyonlar burada.
 */

/**
 * Tarihi TR locale formatında gösterir.
 * null/undefined/invalid → '-'
 */
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

/**
 * Tarih + saat (Onaylar gibi hassas işlemler için)
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('tr-TR');
}

/**
 * Array/string listeden unique, boş olmayan seçenekler döner.
 */
export function uniqueOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * 'Faz 10' → 10, parse edilemezse null
 */
export function parsePhaseNo(label: string): number | null {
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Phase range sum for dashboard metrics
 */
export function sumPhaseRange(
  items: Array<{ label: string; value: number }>,
  min: number,
  max: number
): number {
  return items.reduce((acc, item) => {
    const no = parsePhaseNo(item.label);
    if (no && no >= min && no <= max) return acc + item.value;
    return acc;
  }, 0);
}
