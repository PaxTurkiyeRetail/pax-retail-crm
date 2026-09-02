// Haftalık hedef/gerçekleşme kartının saf yardımcıları (sunucuya bağımlı değil,
// testlerden de kullanılır).

export type WeeklyTargetKind =
  | 'salesPhysical'
  | 'salesOnline'
  | 'salesPhone'
  | 'salesEmail'
  | 'technicalPhysical'
  | 'technicalOnline';

export type WeeklyTargetCounters = Record<WeeklyTargetKind, number> & {
  totalActivities: number;
  uniqueCustomers: number;
};

export const WEEKLY_TARGET_LABELS: Array<{ key: WeeklyTargetKind; label: string }> = [
  { key: 'salesPhysical', label: 'Satış Fiziki' },
  { key: 'salesOnline', label: 'Satış Online' },
  { key: 'salesPhone', label: 'Satış Telefon' },
  { key: 'salesEmail', label: 'Satış E-posta' },
  { key: 'technicalPhysical', label: 'Teknik Fiziki' },
  { key: 'technicalOnline', label: 'Teknik Online' },
];

export function emptyWeeklyCounters(): WeeklyTargetCounters {
  return {
    salesPhysical: 0,
    salesOnline: 0,
    salesPhone: 0,
    salesEmail: 0,
    technicalPhysical: 0,
    technicalOnline: 0,
    totalActivities: 0,
    uniqueCustomers: 0,
  };
}

export function addWeeklyCounters(a: WeeklyTargetCounters, b: WeeklyTargetCounters): WeeklyTargetCounters {
  return {
    salesPhysical: a.salesPhysical + b.salesPhysical,
    salesOnline: a.salesOnline + b.salesOnline,
    salesPhone: a.salesPhone + b.salesPhone,
    salesEmail: a.salesEmail + b.salesEmail,
    technicalPhysical: a.technicalPhysical + b.technicalPhysical,
    technicalOnline: a.technicalOnline + b.technicalOnline,
    totalActivities: a.totalActivities + b.totalActivities,
    uniqueCustomers: a.uniqueCustomers + b.uniqueCustomers,
  };
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

/**
 * Aktivite tipini hedef kovasına eşler. Haftalık yönetim sunumundaki
 * normalizeActivityKind ile aynı kuralları izler; iki ekranın aynı sayıyı
 * göstermesi için mantık burada tek noktada tutulur.
 */
export function activityTargetKind(activityType: unknown): WeeklyTargetKind | 'other' {
  const text = normalize(activityType);
  if (!text) return 'other';

  const isTechnical = includesAny(text, ['teknik', 'pom']);
  if (includesAny(text, ['pom'])) return 'technicalOnline';
  if (isTechnical && includesAny(text, ['online', 'teams', 'meet', 'uzaktan', 'video'])) return 'technicalOnline';
  if (isTechnical && includesAny(text, ['fiziki', 'fizik', 'yerinde', 'saha', 'ziyaret', 'toplanti'])) return 'technicalPhysical';
  if (isTechnical) return 'other';

  if (includesAny(text, ['e-posta', 'eposta', 'e posta', 'mail'])) return 'salesEmail';
  if (includesAny(text, ['telefon', 'phone', 'arama', 'cagri'])) return 'salesPhone';
  if (includesAny(text, ['online', 'teams', 'meet', 'uzaktan', 'video'])) return 'salesOnline';
  if (includesAny(text, ['fiziki', 'fizik', 'yerinde', 'saha', 'ziyaret', 'toplanti'])) return 'salesPhysical';

  return 'other';
}

/** Pazartesi 00:00 (yerel). */
export function startOfWeek(date = new Date()) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 0, 0, 0, 0);
}

/** Pazar 23:59:59 (yerel). */
export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Gerçekleşme yüzdesi; hedef 0 ise null (kartta oran gösterilmez). */
export function achievementPct(actual: number, target: number) {
  if (!target) return null;
  return Math.round((actual / target) * 100);
}
