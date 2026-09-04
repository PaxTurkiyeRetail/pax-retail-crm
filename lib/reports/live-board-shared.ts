// Canlı Ekran (PAX Retail Command Center · TV modu) — saf yardımcılar ve tipler.
// Sunucuya bağımlı değil; API katmanı, istemci ve testler ortak kullanır.
//
// Kaynak doküman: "PAX Retail Command Center — Fonksiyonel Analiz v1.0" (01.09.2026).
// Ekran akışı: Business Pulse → Portföy → Hot Pipeline → POC/Pilot/Rollout →
// Teklifler & Forecast → Uyarılar → (Jira) ve aralara kişi slaytları (Sales Performance).

import type { WeeklyTargetCounters } from '@/lib/reports/weekly-targets-shared';

/* ------------------------------------------------------------------------ */
/* Zamanlama                                                                 */
/* ------------------------------------------------------------------------ */

/** Slayt süreleri ve yenileme aralığı. Spec: 20–30 sn otomatik geçiş, 5–10 dk veri yenileme. */
export const LIVE_BOARD_TIMING = {
  teamMs: 22_000,
  ownerMs: 18_000,
  refreshMs: 5 * 60_000,
  /** Kaç takım ekranından sonra kişi slaytlarına geçilir (dönüşümlü akış). */
  teamBurst: 2,
  ownerBurst: 2,
} as const;

export type LiveBoardSpeed = 'slow' | 'normal' | 'fast';
export const LIVE_BOARD_SPEEDS: Record<LiveBoardSpeed, { label: string; factor: number }> = {
  slow: { label: 'Yavaş', factor: 1.5 },
  normal: { label: 'Normal', factor: 1 },
  fast: { label: 'Hızlı', factor: 0.6 },
};

/* ------------------------------------------------------------------------ */
/* Kurallar (spec: eşikler parametrik olmalı — tek noktadan yönetilir)       */
/* ------------------------------------------------------------------------ */

export const LIVE_BOARD_RULES = {
  /** Aktif fırsatta bu kadar gün aktivite yoksa "dikkat" (turuncu). */
  staleWarnDays: 7,
  /** Bu kadar gün aktivite yoksa "aksiyon" (kırmızı). */
  staleDangerDays: 14,
  /** Hedef tarihe bu kadar gün kalmışsa "yaklaşıyor" (turuncu). */
  dueSoonDays: 7,
  /** Ciro gerçekleşmesi, yılın geçen süresinden bu kadar puan gerideyse turuncu; fazlası kırmızı. */
  paceWarnPoints: 10,
  /** Kazanılmış sayılan ilk faz (Sipariş). */
  orderPhase: 15,
  /** POC / pilot / uçtan uca test fazları. */
  pocPhases: [11, 12, 13] as readonly number[],
  /** Rollout fazı. */
  rolloutPhase: 24,
  /** Aktif satış pipeline'ı sayılan faz aralığı (lead validasyonu → sözleşme). */
  pipelinePhaseMin: 4,
  pipelinePhaseMax: 14,
  /** Hot Pipeline'a doğrudan giren fazlar (Teklif → Sözleşme + Rollout). */
  hotPhases: [10, 11, 12, 13, 14, 24] as readonly number[],
  /** TV'de listelenen maksimum fırsat sayısı. */
  hotTeamLimit: 10,
  hotOwnerLimit: 5,
  pocLimit: 10,
  alertLimit: 4,
  recentActivities: 5,
} as const;

// Olasılık kaynağı (spec §9): CRM'deki mevcut yapı DOĞRUDAN kullanılır —
// teklifler için quotes.probability (10/30/60/90), forecast kalemleri için
// crm_forecasts.probability (30/60/90). Bağımsız bir faz-ağırlık tablosu
// bilinçli olarak eklenmedi; ikinci bir olasılık sistemi üretmemek için.

export type PhaseGroupKey = 'none' | 'lead' | 'discovery' | 'quote' | 'poc' | 'contract' | 'order' | 'live' | 'rollout';
export const PHASE_GROUPS: Array<{ key: PhaseGroupKey; label: string; from: number | null; to: number | null }> = [
  { key: 'none', label: 'Fazsız', from: null, to: null },
  { key: 'lead', label: 'Lead / Temas', from: 1, to: 3 },
  { key: 'discovery', label: 'Keşif & Sunum', from: 4, to: 9 },
  { key: 'quote', label: 'Teklif', from: 10, to: 10 },
  { key: 'poc', label: 'Konsinye / POC / Test', from: 11, to: 13 },
  { key: 'contract', label: 'Sözleşme', from: 14, to: 14 },
  { key: 'order', label: 'Sipariş & Teslimat', from: 15, to: 18 },
  { key: 'live', label: 'Eğitim & Devir', from: 19, to: 23 },
  { key: 'rollout', label: 'Rollout / Referans', from: 24, to: 25 },
];

export function phaseGroupOf(phaseNo: number | null | undefined): PhaseGroupKey {
  const n = Number(phaseNo);
  if (!Number.isFinite(n) || phaseNo == null) return 'none';
  for (const group of PHASE_GROUPS) {
    if (group.from != null && group.to != null && n >= group.from && n <= group.to) return group.key;
  }
  return n > 25 ? 'rollout' : 'none';
}

/* ------------------------------------------------------------------------ */
/* Tipler                                                                    */
/* ------------------------------------------------------------------------ */

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

/** Ciro / hedef bloğu — kişi ve takım için aynı şekil. Para birimi USD (teklif kataloğu). */
export type RevenueBlock = {
  year: number;
  /** Yıllık ciro hedefi (crm_target_values · sales_revenue). Yoksa null. */
  target: number | null;
  /** Yılbaşından bugüne kazanılan tekliflerin tutarı (Teklif Raporları ile aynı tanım). */
  actualYtd: number;
  attainmentPct: number | null;
  remaining: number | null;
  /** Yıl sonu tahmini = gerçekleşen + geçerli açık tekliflerin ağırlıklı değeri (spec §6.1 weighted model). */
  forecast: number;
  forecastGap: number | null;
  forecastPct: number | null;
  /** Açık (gönderilmiş) teklifler. */
  pipeline: number;
  weightedPipeline: number;
  openQuotes: number;
  /** Geçerlilik tarihi geçmiş ama kapatılmamış açık teklif sayısı. */
  expiredOpenQuotes: number;
  /** Yıllık cihaz hedefi (device_count) ve kazanılan cihaz adedi. */
  deviceTarget: number | null;
  deviceActualYtd: number;
  wonYtd: { count: number; amount: number };
  wonMonth: { count: number; amount: number };
  lostYtd: { count: number; amount: number };
  /** Yılın geçen süre oranı ve hıza göre durum (spec §6.2). */
  yearElapsedPct: number;
  pace: Tone | null;
};

export type Funnel = {
  activities: number;
  customers: number;
  advanced: number;
  quotes: number;
  orders: number;
};

export type PipelineStats = {
  /** Faz 4–14 arasındaki (aktif satış sürecindeki) firma sayısı. */
  activeCustomers: number;
  potentialDevices: number;
  potentialValue: number;
  weightedValue: number;
  poc: number;
  rollout: number;
  stale: number;
  staleCritical: number;
  overdueActions: number;
  plannedActions: number;
};

export type HotItem = {
  customerId: string;
  musteri: string;
  owner: string | null;
  phaseNo: number | null;
  phaseName: string | null;
  phaseStatus: string | null;
  models: string;
  quantity: number;
  /** Liste fiyatı tahmini (≈). Fiyat bulunamadıysa 0. */
  potentialValue: number;
  weightedValue: number;
  /** Açık teklif tutarı varsa (gerçek teklif). */
  quoteAmount: number;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  daysSinceActivity: number | null;
  nextAction: string | null;
  actionOwner: string | null;
  targetDate: string | null;
  /** Hedef tarihe kalan gün (negatif = gecikmiş). */
  daysToTarget: number | null;
  tone: Tone;
  source: 'blocker' | 'plan' | 'phase';
};

export type PocItem = {
  customerId: string;
  musteri: string;
  owner: string | null;
  phaseNo: number;
  phaseName: string | null;
  phaseStatus: string | null;
  models: string;
  quantity: number;
  startDate: string | null;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  nextAction: string | null;
  actionOwner: string | null;
  targetDate: string | null;
  daysToTarget: number | null;
  tone: Tone;
};

export type AlertItem = {
  kind: 'stale' | 'overdue' | 'target_gap' | 'poc_delay' | 'customer_waiting' | 'contract_waiting' | 'expired_quote';
  title: string;
  detail: string;
  owner: string | null;
  days: number | null;
  tone: Tone;
};

export type LiveActivity = {
  id: string;
  at: string;            // ISO
  musteri: string;
  label: string;         // aktivite türü (Telefon, Yerinde Ziyaret, …)
  kind: string;          // hedef kovası ya da 'other'
  note: string | null;
  phaseFrom: number | null;
  phaseTo: number | null;
  /** 'up' faz ilerledi · 'same' değişmedi · 'first' ilk kayıt · 'down' geri alındı */
  phaseChange: 'up' | 'same' | 'first' | 'down';
};

export type LiveOwner = {
  owner: string;
  initials: string;
  rank: number;
  portfolio: { total: number; active: number };
  revenue: RevenueBlock;
  funnel: Funnel;
  pipeline: PipelineStats;
  actual: WeeklyTargetCounters;
  target: WeeklyTargetCounters;
  /** Haftalık toplam aktivite gerçekleşme yüzdesi; hedef yoksa null. */
  achievementPct: number | null;
  todayActivities: number;
  quotes: { weekCount: number; weekAmount: number; monthCount: number; monthAmount: number };
  hot: HotItem[];
  recentActivities: LiveActivity[];
  jira: { open: number; customerWaiting: number } | null;
};

export type Distribution = Array<{ label: string; value: number; tone?: Tone }>;

export type QuoteRow = {
  quoteNo: string;
  musteri: string;
  owner: string | null;
  amount: number;
  devices: number;
  probability: number;
  status: 'open' | 'won' | 'lost' | 'draft';
  reason: string | null;
  date: string | null;
  expired: boolean;
};

export type LiveBoardPayload = {
  generatedAt: string;
  range: { from: string; to: string; label: string; today: string; year: number };
  status: { crm: 'ok'; jira: 'ok' | 'off' | 'error' };
  team: {
    ownerCount: number;
    revenue: RevenueBlock;
    funnel: Funnel;
    pipeline: PipelineStats;
    actual: WeeklyTargetCounters;
    target: WeeklyTargetCounters;
    achievementPct: number | null;
    todayActivities: number;
    quotes: { weekCount: number; weekAmount: number; monthCount: number; monthAmount: number };
    hot: HotItem[];
    poc: PocItem[];
    alerts: AlertItem[];
    alertCounts: Record<AlertItem['kind'], number>;
    jira: { open: number; created: number; closed: number; customerWaiting: number; developmentWaiting: number } | null;
  };
  portfolio: {
    total: number;
    byOwner: Distribution;
    byPhaseGroup: Distribution;
    bySector: Distribution;
    kunye: Distribution;
  };
  quotes: {
    open: QuoteRow[];
    recentClosed: QuoteRow[];
    byOwner: Array<{ owner: string; open: number; openAmount: number; weighted: number; won: number; wonAmount: number; lost: number }>;
    lostReasons: Distribution;
  };
  forecast: {
    year: number;
    totalQuantity: number;
    weightedQuantity: number;
    byMonth: Array<{ month: number; label: string; quantity: number; weighted: number }>;
    byOwner: Distribution;
  };
  owners: LiveOwner[];
};

export type TeamSlideKey = 'pulse' | 'portfolio' | 'hot' | 'poc' | 'quotes' | 'alerts' | 'jira';
export type LiveSlide = { type: 'team'; key: TeamSlideKey } | { type: 'owner'; index: number };

export const TEAM_SLIDE_TITLES: Record<TeamSlideKey, { title: string; sub: string }> = {
  pulse: { title: 'Business Pulse', sub: 'ciro · hedef · forecast · aktivite' },
  portfolio: { title: 'Portföy', sub: 'account yapısı · faz · sektör · künye' },
  hot: { title: 'Hot Pipeline', sub: 'sonuçlanmaya yakın fırsatlar' },
  poc: { title: 'POC · Pilot · Rollout', sub: 'canlıya ve satışa yakın projeler' },
  quotes: { title: 'Teklifler & Forecast', sub: 'açık · kazanılan · kaybedilen · yıl forecast' },
  alerts: { title: 'Yönetim Uyarıları', sub: 'aksiyon gerektiren başlıklar' },
  jira: { title: 'Jira · Retail Support', sub: 'teknik operasyon sağlığı' },
};

/* ------------------------------------------------------------------------ */
/* Yardımcılar                                                               */
/* ------------------------------------------------------------------------ */

/** "Ömer Canatar" → "ÖC", "Seda" → "SE", boş → "?" */
export function initialsOf(name: string) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
}

/**
 * Sıralama: ciro hedefi olan kişilerde ciro gerçekleşme %'si, yoksa haftalık
 * aktivite gerçekleşmesi → tekil firma → ad. Rank 1'den başlar.
 */
export function rankOwners<T extends { owner: string; actual: WeeklyTargetCounters; revenue?: { attainmentPct: number | null } }>(owners: T[]): Array<T & { rank: number }> {
  const score = (row: T) => {
    const rev = row.revenue?.attainmentPct;
    return rev == null ? -1 : rev;
  };
  return [...owners]
    .sort((a, b) =>
      score(b) - score(a)
      || b.actual.totalActivities - a.actual.totalActivities
      || b.actual.uniqueCustomers - a.actual.uniqueCustomers
      || a.owner.localeCompare(b.owner, 'tr'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Slayt planı: takım ekranları ile kişi slaytları dönüşümlü akar
 * (2 takım → 2 kişi → 2 takım → …). Kişi bittiğinde kalan takım ekranları,
 * takım bittiğinde kalan kişiler eklenir. Döngü istemcide sonsuz tekrar eder.
 * Jira ekranı yalnız entegrasyon açıkken plana girer.
 */
export function slidePlan(
  ownerCount: number,
  options?: { jira?: boolean; teamBurst?: number; ownerBurst?: number },
): LiveSlide[] {
  const teamKeys: TeamSlideKey[] = ['pulse', 'portfolio', 'hot', 'poc', 'quotes', 'alerts'];
  if (options?.jira) teamKeys.push('jira');
  const teamBurst = Math.max(1, options?.teamBurst ?? LIVE_BOARD_TIMING.teamBurst);
  const ownerBurst = Math.max(1, options?.ownerBurst ?? LIVE_BOARD_TIMING.ownerBurst);

  const plan: LiveSlide[] = [];
  let teamIndex = 0;
  let ownerIndex = 0;
  while (teamIndex < teamKeys.length || ownerIndex < ownerCount) {
    for (let i = 0; i < teamBurst && teamIndex < teamKeys.length; i += 1) {
      plan.push({ type: 'team', key: teamKeys[teamIndex] });
      teamIndex += 1;
    }
    for (let i = 0; i < ownerBurst && ownerIndex < ownerCount; i += 1) {
      plan.push({ type: 'owner', index: ownerIndex });
      ownerIndex += 1;
    }
  }
  return plan;
}

export function slideDurationMs(slide: LiveSlide, speed: LiveBoardSpeed = 'normal') {
  const base = slide.type === 'team' ? LIVE_BOARD_TIMING.teamMs : LIVE_BOARD_TIMING.ownerMs;
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

/** İki 'YYYY-MM-DD' günü arasındaki fark (b - a), gün. Geçersizse null. */
export function dayDiff(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(`${String(a).slice(0, 10)}T00:00:00Z`);
  const db = new Date(`${String(b).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Yılın geçen süre oranı (0–100), İstanbul gününe göre. */
export function yearElapsedPct(todayKey: string): number {
  const year = Number(todayKey.slice(0, 4));
  if (!Number.isFinite(year)) return 0;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const now = new Date(`${todayKey}T12:00:00Z`).getTime();
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

/**
 * Hız durumu (spec §6.2): gerçekleşme ≥ yılın geçen süresi → yeşil;
 * 0–10 puan geride → turuncu; daha fazlası → kırmızı. Hedef yoksa null.
 */
export function paceTone(attainmentPct: number | null, elapsedPct: number, warnPoints = LIVE_BOARD_RULES.paceWarnPoints): Tone | null {
  if (attainmentPct == null) return null;
  const behind = elapsedPct - attainmentPct;
  if (behind <= 0) return 'ok';
  if (behind <= warnPoints) return 'warn';
  return 'danger';
}

/** Hedef tarihe göre renk: geçmiş → kırmızı, yaklaşan → turuncu, yoksa/uzak → nötr. */
export function dueTone(daysToTarget: number | null, soonDays = LIVE_BOARD_RULES.dueSoonDays): Tone {
  if (daysToTarget == null) return 'neutral';
  if (daysToTarget < 0) return 'danger';
  if (daysToTarget <= soonDays) return 'warn';
  return 'ok';
}

/** Son aktiviteye göre bekleme rengi: 14+ gün kırmızı, 7+ gün turuncu. */
export function staleTone(daysSinceActivity: number | null): Tone {
  if (daysSinceActivity == null) return 'neutral';
  if (daysSinceActivity >= LIVE_BOARD_RULES.staleDangerDays) return 'danger';
  if (daysSinceActivity >= LIVE_BOARD_RULES.staleWarnDays) return 'warn';
  return 'ok';
}

/** "🔴 5 gün gecikti" / "🟠 3 gün kaldı" / "bugün" metni — yönetici hesap yapmasın. */
export function dueLabel(daysToTarget: number | null): string {
  if (daysToTarget == null) return 'tarih yok';
  if (daysToTarget < 0) return `${Math.abs(daysToTarget)} gün gecikti`;
  if (daysToTarget === 0) return 'bugün';
  if (daysToTarget === 1) return 'yarın';
  return `${daysToTarget} gün kaldı`;
}

/** "4 gün önce" / "bugün" — son hareket metni. */
export function agoLabel(days: number | null): string {
  if (days == null) return 'hareket yok';
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  return `${days} gün önce`;
}

/** Para (USD): 1234567 → "$1,23M", 82000 → "$82K", 950 → "$950". */
export function fmtMoney(value: number | null | undefined, opts?: { sign?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : opts?.sign && value > 0 ? '+' : '';
  let text: string;
  if (abs >= 1_000_000) text = `${(abs / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: abs >= 10_000_000 ? 0 : 2 })}M`;
  else if (abs >= 1_000) text = `${Math.round(abs / 1_000).toLocaleString('tr-TR')}K`;
  else text = Math.round(abs).toLocaleString('tr-TR');
  return `${sign}$${text}`;
}

export function pctOf(actual: number, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.round((actual / target) * 100);
}
