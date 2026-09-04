// Canlı Ekran (Satışçı Takip Raporu → "Canlı Ekran" sekmesi) — saf yardımcılar.
// Sunucuya bağımlı değil; hem API katmanı hem istemci hem testler kullanır.

import type { WeeklyTargetCounters } from '@/lib/reports/weekly-targets-shared';

/** Slayt süreleri ve yenileme aralığı. Yönetici ekranı gün boyu açık kalır;
 *  veri 5 dakikada bir sessizce yenilenir, slaytlar döner. */
export const LIVE_BOARD_TIMING = {
  overviewMs: 15_000,
  ownerMs: 12_000,
  refreshMs: 5 * 60_000,
  /** Kaç kişi slaytında bir genel özet tekrar gösterilir (uzun ekiplerde bağlam kaybolmasın). */
  overviewEvery: 4,
} as const;

export type LiveBoardSpeed = 'slow' | 'normal' | 'fast';
export const LIVE_BOARD_SPEEDS: Record<LiveBoardSpeed, { label: string; factor: number }> = {
  slow: { label: 'Yavaş', factor: 1.6 },
  normal: { label: 'Normal', factor: 1 },
  fast: { label: 'Hızlı', factor: 0.65 },
};

export type LiveFollowup = {
  customerId: string;
  musteri: string;
  konuKimde: string;
  takipKonusu: string;
  modelAdetLabel: string;
  totalQuantity: number;
  cozumTarihi: string | null;
  overdue: boolean;
  nearTerm: boolean;
};

export type LiveActivity = {
  id: string;
  at: string;            // ISO
  musteri: string;
  label: string;         // aktivite türü (Satış Fiziki Ziyaret, …)
  kind: string;          // hedef kovası ya da 'other'
  note: string | null;
};

export type LiveOwner = {
  owner: string;
  initials: string;
  rank: number;
  actual: WeeklyTargetCounters;
  target: WeeklyTargetCounters;
  /** Toplam aktivite gerçekleşme yüzdesi; hedef yoksa null. */
  achievementPct: number | null;
  todayActivities: number;
  quotes: { count: number; devices: number };
  followups: { open: number; overdue: number; nearTermQuantity: number; top: LiveFollowup[] };
  recentActivities: LiveActivity[];
};

export type LiveBoardPayload = {
  generatedAt: string;
  range: { from: string; to: string; label: string; today: string };
  team: {
    ownerCount: number;
    actual: WeeklyTargetCounters;
    target: WeeklyTargetCounters;
    achievementPct: number | null;
    todayActivities: number;
    quotes: { count: number; devices: number };
    followups: { open: number; overdue: number; nearTermQuantity: number; nearTermLabel: string; soonest: LiveFollowup[] };
  };
  owners: LiveOwner[];
};

export type LiveSlide = { type: 'overview' } | { type: 'owner'; index: number };

/** "Ömer Canatar" → "ÖC", "Seda" → "SE", boş → "?" */
export function initialsOf(name: string) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
}

/** Sıralama: bu hafta en çok aktivite → en çok tekil firma → ad. Rank 1'den başlar. */
export function rankOwners<T extends { owner: string; actual: WeeklyTargetCounters }>(owners: T[]): Array<T & { rank: number }> {
  return [...owners]
    .sort((a, b) =>
      b.actual.totalActivities - a.actual.totalActivities
      || b.actual.uniqueCustomers - a.actual.uniqueCustomers
      || a.owner.localeCompare(b.owner, 'tr'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Slayt planı: genel özetle başlar, her `overviewEvery` kişide bir özete döner.
 * 0 kişi → yalnız özet. Döngü istemcide sonsuz tekrar eder.
 */
export function slidePlan(ownerCount: number, overviewEvery = LIVE_BOARD_TIMING.overviewEvery): LiveSlide[] {
  const plan: LiveSlide[] = [{ type: 'overview' }];
  for (let index = 0; index < ownerCount; index += 1) {
    if (index > 0 && overviewEvery > 0 && index % overviewEvery === 0) plan.push({ type: 'overview' });
    plan.push({ type: 'owner', index });
  }
  return plan;
}

export function slideDurationMs(slide: LiveSlide, speed: LiveBoardSpeed = 'normal') {
  const base = slide.type === 'overview' ? LIVE_BOARD_TIMING.overviewMs : LIVE_BOARD_TIMING.ownerMs;
  return Math.round(base * LIVE_BOARD_SPEEDS[speed].factor);
}

/** İstanbul saatiyle 'YYYY-MM-DD' gün anahtarı (sunucu UTC'de olsa da doğru gün). */
export function istanbulDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** "01–07 Eyl 2026" biçiminde hafta etiketi. */
export function weekRangeLabel(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${from} – ${to}`;
  const day = (d: Date) => String(d.getDate()).padStart(2, '0');
  const month = (d: Date) => d.toLocaleDateString('tr-TR', { month: 'short' });
  if (a.getMonth() === b.getMonth()) return `${day(a)}–${day(b)} ${month(b)} ${b.getFullYear()}`;
  return `${day(a)} ${month(a)} – ${day(b)} ${month(b)} ${b.getFullYear()}`;
}
