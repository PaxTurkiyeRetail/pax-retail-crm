// Canlı Ekran (PAX Retail Command Center · TV modu) — saf yardımcılar ve tipler.
// Sunucuya bağımlı değil; API katmanı, istemci ve testler ortak kullanır.
//
// Kaynak doküman: "PAX Retail Command Center — Fonksiyonel Analiz v1.0" (01.09.2026).
// Ekran akışı: Business Pulse → Portföy → Hot Pipeline → POC/Pilot/Rollout →
// Teklifler & Forecast → Uyarılar → (Jira) ve aralara kişi slaytları (Sales Performance).

import type { WeeklyTargetCounters } from '@/lib/reports/weekly-targets-shared';
import type { GoalPair } from '@/lib/reports/targets-shared';

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
  /**
   * Günlük tam yenileme saati (İstanbul) — Sinan, 10.09: "ekran uzun süre açık kalacak, her sabah
   * 08:00'de otomatik güncellensin". TV modunda (tam ekran) veri + döngü sıfırlanır (sayfa yenilenirse
   * tam ekran düşer); tam ekran değilse sayfa yeniden yüklenir (yeni sürüm de alınır).
   */
  dailyRefreshHour: 8,
  dailyRefreshMinute: 0,
} as const;

/**
 * İstanbul saatine göre bir sonraki HH:MM'e kalan milisaniye (bugün geçtiyse yarın).
 * Saf fonksiyon: `now` verilerek test edilir.
 */
export function msUntilIstanbulTime(now: Date, hour: number, minute: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // İstanbul duvar saati (UTC gibi kurulur; fark hesabı için yeter)
  const wallNow = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  let wallTarget = Date.UTC(get('year'), get('month') - 1, get('day'), hour, minute, 0);
  if (wallTarget <= wallNow) wallTarget += 86_400_000;
  return Math.max(60_000, wallTarget - wallNow);
}

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
  hotTeamLimit: 20,
  /** Kişi slaydı: en yakın hedef tarihli 5 fırsat, sayfalanmaz (Çağdaş Bey, 04.09). */
  hotOwnerLimit: 5,
  /** Entegrasyon firması bu fazdan itibaren "entegre" sayılır (Entegrasyon Raporu yeşil eşiği). */
  integrationDonePhase: 9,
  /** Açık teklif bu kadar gün dokunulmadıysa "pasif" sayılır (Çağdaş Bey, 07.09: 30 gün cevap yoksa). */
  quotePassiveDays: 30,
  /** Bir sorumlunun üzerinde bu kadar ve fazla firma varsa "portföy yükü" uyarısı (Çağdaş Bey, 07.09: 50–60'ı geçmesin). */
  portfolioLoadLimit: 60,
  pocLimit: 20,
  alertLimit: 6,
  recentActivities: 8,
  openQuotesLimit: 12,
  closedQuotesLimit: 6,
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
  /** Yılbaşından bugüne aktif satış kayıtlarının tutarı (crm_sales; Teklif Raporları ile aynı tanım). */
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
  /** Yıllık cihaz hedefi (device_count) ve satışa dönen cihaz adedi. */
  deviceTarget: number | null;
  deviceActualYtd: number;
  /** KasaPOS entegrasyon hedefi (integration_count) ve tamamlanan (faz ≥ 9) / toplam entegrasyon firması. */
  integrationTarget: number | null;
  integrationDone: number;
  integrationTotal: number;
  wonYtd: { count: number; amount: number };
  wonMonth: { count: number; amount: number };
  lostYtd: { count: number; amount: number };
  /** Satış kaydına dönen teklifler (crm_sales · status='active'); ciro artık buradan gelir. */
  saleYtd: { count: number; amount: number; devices: number };
  saleMonth: { count: number; amount: number };
  /** İptal edilmiş satış kaydı sayısı (YTD) — kazanılan ama cirodan düşen teklifler. */
  saleCancelled: number;
  /** Kapanan tekliflerin kaçı satışa döndü: satış / (satış + kayıp). Kapanan yoksa null. */
  conversionPct: number | null;
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
  kind: 'stale' | 'overdue' | 'target_gap' | 'poc_delay' | 'customer_waiting' | 'contract_waiting' | 'expired_quote' | 'portfolio_load';
  title: string;
  detail: string;
  owner: string | null;
  days: number | null;
  tone: Tone;
};

export type LiveActivity = {
  id: string;
  at: string;            // ISO — kayıt zamanı
  /** Aktivitenin gerçekleştiği gün (YYYY-MM-DD); haftalık sayaçlar bunu kullanır. */
  date: string;
  /** Geç giriş: aktivite günü kayıt gününden önce (07.09 ara yolu, en fazla 2 gün). */
  late: boolean;
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
  portfolio: { total: number; active: number; hunter: number; farmer: number };
  revenue: RevenueBlock;
  funnel: Funnel;
  pipeline: PipelineStats;
  actual: WeeklyTargetCounters;
  target: WeeklyTargetCounters;
  /** Haftalık toplam aktivite gerçekleşme yüzdesi; hedef yoksa null. */
  achievementPct: number | null;
  todayActivities: number;
  quotes: { weekCount: number; weekAmount: number; monthCount: number; monthAmount: number };
  /** En yakın hedef tarihli 5 fırsat (LIVE_BOARD_RULES.hotOwnerLimit). */
  hot: HotItem[];
  /** Kriterlere uyan toplam fırsat (5'ten fazlası "+N fırsat daha" notuyla belirtilir). */
  hotTotal: number;
  recentActivities: LiveActivity[];
  jira: { open: number; customerWaiting: number } | null;
  /**
   * Müşteri Listesi (H/F/L/K) — Çağdaş Bey'in kişi bazlı firma dağılımı (`crm_musteri_listesi`,
   * Raporlar › Müşteri Listesi). Kişi slaytındaki Hunter/Farmer donut'u BURADAN okur (Sinan, 09.09) —
   * künye `satici_etiketi` değil. Liste hiç doldurulmamışsa null (donut yerine not).
   */
  list: CustomerListSplit | null;
  /** v2.7 (Çağdaş Bey, 10.09): küçük donut'lar + Teklif kutusu hedefleri (Hedefler ekranı, migration 026). */
  goals: OwnerGoals;
};

/**
 * Kişi slaytı v2.7 hedef çiftleri. Kaynak: Hedefler ekranı (crm_target_values, yıl + çeyrek).
 *   * visitsQuarter / visitsYear : fiziki + online satış görüşmesi (aktiviteyi giren kişi)
 *   * budgetQuarter              : çeyrek ciro (crm_sales, satış tarihi çeyrekte) — çeyrek hedefi
 *                                  girilmemişse yıllık / 4 varsayılır (`budgetQuarterAssumed`)
 *   * integration                : faz ≥ 9 entegrasyon firması (integration_count)
 *   * hunterToFarmer / leadToHunter : Müşteri Listesi taşımaları (crm_musteri_listesi_hareket, yıl içi)
 *   * wonQuotes                  : yıl içi kazanılan teklif adedi (quotes_won_count)
 *   * openAll / draft            : açık teklif = gönderilmiş + taslak (Çağdaş Bey: "Ömer'in açık teklifi
 *                                  var ama 0 görünüyor" — taslaklar da açık sayılır); pipeline tutarı
 *                                  yine yalnız gönderilmiş tekliflerden.
 */
export type OwnerGoals = {
  quarter: { label: string; months: string; elapsedPct: number };
  visitsQuarter: GoalPair;
  visitsYear: GoalPair;
  visitsQuarterAssumed: boolean;
  budgetQuarter: GoalPair;
  budgetQuarterAssumed: boolean;
  integration: GoalPair;
  hunterToFarmer: GoalPair;
  leadToHunter: GoalPair;
  wonQuotes: GoalPair;
  lostQuotes: number;
  openAll: number;
  draft: number;
};

/** Kişinin Müşteri Listesi sayıları: H Hunter · F Farmer · L Lead · K Kasa Firması. */
export type CustomerListSplit = { hunter: number; farmer: number; lead: number; kasa: number; total: number };

/** Jira · Retail Support özeti (haftalık pivot + firma kırılımı). */
export type JiraCompanyRow = {
  company: string;
  /** Devam eden (ekipte). */
  ongoing: number;
  developmentWaiting: number;
  customerWaiting: number;
  created: number;
  closed: number;
};
export type JiraBlock = {
  /** devam + geliştirme bekleyen + müşteri bekleyen */
  open: number;
  ongoing: number;
  created: number;
  closed: number;
  customerWaiting: number;
  developmentWaiting: number;
  /** Açık ticket'ı ya da bu hafta hareketi olan firmalar (açığa göre sıralı). */
  byCompany: JiraCompanyRow[];
};

export type Distribution = Array<{
  label: string;
  value: number;
  tone?: Tone;
  /** Açıklama satırında küçük ek bilgi (ör. faz aralığı) / bar tooltip'i. */
  hint?: string;
  /** Barın ikinci parçası (ör. farmer sayısı); toplam yine `value`. */
  split?: number;
}>;

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
  /** Kazanılan teklifin satış kaydı iptal edildiyse true (ciroya sayılmaz). */
  saleCancelled?: boolean;
};

export type LiveBoardPayload = {
  generatedAt: string;
  /** API katmanı ekler: sunucu sürecinin başlama anı (pm2 reload → değişir → istemci "yeni sürüm" uyarısı). */
  server?: { startedAt: string };
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
    jira: JiraBlock | null;
  };
  portfolio: {
    total: number;
    /** Sorumlu başına firma; `hint` = "60 hunter · 16 farmer". */
    byOwner: Distribution;
    /** Hunter / Farmer dağılımı (künye etiketi; boş = Hunter). */
    hunterFarmer: Distribution;
    byPhaseGroup: Distribution;
    bySector: Distribution;
    kunye: Distribution;
  };
  quotes: {
    open: QuoteRow[];
    recentClosed: QuoteRow[];
    /** Kişi bazında teklif yaşam döngüsü (Çağdaş Bey, 07.09: kaç girdi, kaçı pasif, kaçı kayıp, kaçı kazandı). */
    byOwner: Array<{
      owner: string; open: number; openAmount: number; weighted: number;
      /** Açık ama geçerliliği bitmiş ya da 30+ gün dokunulmamış. */
      passive: number;
      monthCreated: number; monthAmount: number;
      won: number; wonAmount: number; lost: number;
      /** Satışa dönen teklif adedi/tutarı (crm_sales · aktif) ve dönüşüm oranı. */
      sale: number; saleAmount: number; saleDevices: number; saleCancelled: number;
      conversionPct: number | null;
    }>;
    lostReasons: Distribution;
    /** Kişi bazında teklif → satış dönüşüm oranı (%); sunumda ayrı blok. */
    conversionByOwner: Distribution;
    /** Takım geneli dönüşüm oranı (%) ve kapanan teklif adedi. */
    conversion: { pct: number | null; sale: number; lost: number; cancelled: number };
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
/** Bir ekranın sığmayan devamı ayrı slayt olur: `page` 0'dan başlar, `pages` toplam. */
export type LiveSlide =
  | { type: 'team'; key: TeamSlideKey; page: number; pages: number }
  | { type: 'owner'; index: number; page: number; pages: number };

export const TEAM_SLIDE_TITLES: Record<TeamSlideKey, { title: string; sub: string }> = {
  pulse: { title: 'Business Pulse', sub: 'ciro · hedef · forecast · aktivite' },
  portfolio: { title: 'Portföy', sub: 'account yapısı · faz · sektör · künye' },
  hot: { title: 'Hot Pipeline', sub: 'sonuçlanmaya yakın fırsatlar' },
  poc: { title: 'POC · Pilot · Rollout', sub: 'canlıya ve satışa yakın projeler' },
  quotes: { title: 'Teklifler & Forecast', sub: 'açık · satışa dönen · kaybedilen · dönüşüm' },
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
/**
 * Sabit görüntüleme sırası (Çağdaş Bey, 04.09 toplantısı): Account Yapısı, Kişi
 * Bazında tablo ve kişi slaytlarının dönüş sırası bu listeye göre. Listede
 * olmayan adlar sona, kendi aralarında alfabetik. "Kim hedefinde" sıralaması
 * hariç — o performansa göre kalır.
 */
export const OWNER_ORDER: readonly string[] = [
  'Cem Koç', 'Ömer Canatar', 'Furkan Kızılkurt', 'Erdi Toraman', 'Seda Kesikoğlu',
  'İş Ortakları', 'Havuz Account', 'Yemek Kartları',
];
/** Sektör dağılımında öne alınan sektörler; kalanlar adede göre. */
export const SECTOR_ORDER: readonly string[] = ['Hazır Giyim', 'Gıda Perakendesi', 'Ev & Yaşam / Yapı Market'];

/** Türkçe duyarlı ad anahtarı (NFC + tr küçük harf + tek boşluk). Müşteri Listesi (H/F/L/K) eşlemesi de bunu kullanır. */
export function normalizeName(value: string) {
  return value.normalize('NFC').trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ');
}
function orderIndex(order: readonly string[], name: string) {
  const key = normalizeName(name);
  const hit = order.findIndex((item) => normalizeName(item) === key);
  return hit === -1 ? order.length : hit;
}
/** OWNER_ORDER'a göre karşılaştırıcı; liste dışı adlar sona (alfabetik). */
export function ownerOrderCompare(a: string, b: string) {
  return orderIndex(OWNER_ORDER, a) - orderIndex(OWNER_ORDER, b) || a.localeCompare(b, 'tr');
}
/** Dağılımı sabit sıraya göre dizer: önce listedekiler, sonra kalanlar adede göre. */
export function orderDistribution<T extends { label: string; value: number }>(rows: T[], order: readonly string[]): T[] {
  return [...rows].sort((a, b) => {
    const ia = orderIndex(order, a.label);
    const ib = orderIndex(order, b.label);
    if (ia !== ib) return ia - ib;
    return b.value - a.value || a.label.localeCompare(b.label, 'tr');
  });
}

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

/* ------------------------------------------------------------------------ */
/* Yerleşim ölçüleri ve sayfalama                                            */
/* ------------------------------------------------------------------------ */

/**
 * Sabit kart/satır yükseklikleri (CSS px). CSS bu değerleri `--lb-*` değişkenleri
 * olarak okur; kapasite hesabı da aynı sayılarla yapılır → tek doğruluk kaynağı.
 * Taşma imkânsız: her liste `overflow:hidden`, her satır sabit yükseklik, sığmayan
 * satır bir sonraki sayfaya geçer ("Seda 2/2").
 */
export type LayoutMetrics = {
  compact: boolean;
  bandH: number;        // kişi slaydı ticari bant
  channelsH: number;    // (eski) kanal kırılımı + huni kartı — Pulse'ta kullanılmıyor, kişi slaytından 10.09'da kalktı
  donutRowH: number;    // kişi slaydı: 3 büyük donut kartının satır yüksekliği (10.09)
  hotH: number;         // Hot Pipeline kartı (kişi)
  actH: number;         // Son Hareketler satırı
  leaderH: number;      // Kim hedefinde satırı
  revenueH: number;     // Business Pulse ciro kartı
  rowH: number;         // tablo satırı (Hot / POC)
  quoteRowH: number;    // teklif satırı
  ownerQuoteRowH: number;
  alertH: number;       // uyarı satırı
  kpiRowH: number;      // 6'lı KPI şeridi (Teklifler)
  chipsH: number;       // uyarı sayaç şeridi
  cardChrome: number;   // kart iç boşluğu + başlık
  gap: number;          // kart aralığı
  listGap: number;      // satır aralığı
};

// Ölçülmüş değerler (Playwright, 1920×1080 ve 1600×1000): satır içerikleri bu
// yüksekliklere sığar. Değiştirirsen harness'ı koştur — kırpılan 0 olmalı.
export const BASE_METRICS: LayoutMetrics = {
  compact: false,
  bandH: 84, channelsH: 330, donutRowH: 344, hotH: 106, actH: 92, leaderH: 124, revenueH: 372,
  rowH: 82, quoteRowH: 72, ownerQuoteRowH: 60, alertH: 82, kpiRowH: 124, chipsH: 76,
  cardChrome: 68, gap: 14, listGap: 8,
};
export const COMPACT_METRICS: LayoutMetrics = {
  compact: true,
  bandH: 76, channelsH: 306, donutRowH: 288, hotH: 100, actH: 90, leaderH: 112, revenueH: 330,
  rowH: 74, quoteRowH: 66, ownerQuoteRowH: 60, alertH: 74, kpiRowH: 110, chipsH: 68,
  cardChrome: 62, gap: 12, listGap: 6,
};

/** Kompakt eşik: gövde (slayt alanı) yüksekliği bundan küçükse küçük ölçüler. */
export const COMPACT_BODY_HEIGHT = 780;


export function layoutMetrics(bodyHeight: number): LayoutMetrics {
  return bodyHeight > 0 && bodyHeight < COMPACT_BODY_HEIGHT ? COMPACT_METRICS : BASE_METRICS;
}

/** Bir listeye kaç satır sığar: (alan + aralık) / (satır + aralık), en az 1. */
export function rowsThatFit(availableHeight: number, rowHeight: number, gap: number) {
  return Math.max(1, Math.floor((availableHeight + gap) / (rowHeight + gap)));
}

export type Capacities = {
  hot: number;        // kişi slaydı Hot Pipeline kartı sayısı
  recent: number;     // kişi slaydı Son Hareketler
  leader: number;     // Business Pulse sıralama satırı
  tableRows: number;  // Hot / POC tablo satırı
  openQuotes: number; // Teklifler: açık teklif satırı
  closedQuotes: number;
  alertItems: number; // uyarı grubu başına satır
  alertGroups: number; // sayfa başına uyarı paneli (kolon)
  portfolioRows: number; // Portföy ekranındaki bar/açıklama satırı
  jiraRows: number;      // Jira ekranı firma tablosu satırı
  /** Business Pulse tek ekrana sığmıyor: ciro+sıralama / aktivite+dönüşüm olarak ikiye böl. */
  pulseSplit: boolean;
};

/** Gövde yüksekliğinden (CSS px, iç boşluklar düşülmüş) liste kapasiteleri. */
export function capacities(bodyHeight: number, bodyWidth = 1920): Capacities {
  const m = layoutMetrics(bodyHeight);
  const H = Math.max(360, bodyHeight || 900);
  const colH = H - m.bandH - m.gap;                               // kişi slaydı kolonları
  const hot = rowsThatFit(colH - m.cardChrome, m.hotH, m.listGap);
  // Kişi slaydı (10.09): bant + 3 donut satırı + alt satır (Teklif & Pipeline | Son Hareketler).
  const recent = rowsThatFit(colH - m.donutRowH - m.gap - m.cardChrome, m.actH, m.listGap);
  const leader = rowsThatFit(H - m.cardChrome, m.leaderH, 10);
  const tableRows = rowsThatFit(H - m.cardChrome - 28, m.rowH, 6);   // 28: tablo başlık satırı
  // Teklifler: KPI şeridinin altında iki kolon; sol kolonda açık teklifler ve
  // son kapananlar kartları üst üste (yüksekliği yarı yarıya paylaşırlar).
  const quoteColH = (H - m.kpiRowH - m.gap - m.gap) / 2;
  const openQuotes = rowsThatFit(quoteColH - m.cardChrome, m.quoteRowH, 6);
  const closedQuotes = rowsThatFit(quoteColH - m.cardChrome, m.quoteRowH, 6);
  const alertItems = rowsThatFit(H - m.chipsH - m.gap - m.cardChrome, m.alertH, m.listGap);
  const alertGroups = bodyWidth >= 1500 ? 3 : bodyWidth >= 1000 ? 2 : 1;
  // Portföy: 2×2 kart ızgarası; her kartın liste alanı yarım yükseklik.
  // Ölçülen: bar/açıklama satırı 24 px + 12 px aralık (kompakt 22 + 10); 26/24 güvenlik payı.
  const portfolioRows = rowsThatFit((H - m.gap) / 2 - m.cardChrome, m.compact ? 24 : 26, m.compact ? 10 : 12);
  // Pulse iki satır ister: ciro kartı + (aktivite | dönüşüm). İkisi birlikte
  // sığmıyorsa ekran ikiye bölünür (ölçülen eşik ~690 px).
  const pulseSplit = H < 690;
  // Jira: KPI şeridi altında firma tablosu (kompakt satır) — 28: tablo başlığı.
  const jiraRows = rowsThatFit(H - m.kpiRowH - m.gap - m.cardChrome - 28, m.ownerQuoteRowH, 6);
  return { hot, recent, leader, tableRows, openQuotes, closedQuotes: Math.max(1, closedQuotes), alertItems, alertGroups, portfolioRows, jiraRows, pulseSplit };
}

/**
 * Uyarı panelleri: her tür kendi kartında, satır kapasitesini aşarsa aynı tür
 * birden fazla panele bölünür ("Stale Opportunity 2/3"). Böylece hiçbir uyarı
 * gizlenmez; paneller sayfalara `alertGroups` kadar dağıtılır.
 */
export type AlertPanel = { kind: AlertItem['kind']; rows: AlertItem[]; total: number; part: number; parts: number };

export function alertPanels(
  alerts: AlertItem[],
  counts: Record<AlertItem['kind'], number>,
  itemsCap: number,
  order: AlertItem['kind'][],
): AlertPanel[] {
  const panels: AlertPanel[] = [];
  const cap = Math.max(1, itemsCap);
  for (const kind of order) {
    const rows = alerts.filter((row) => row.kind === kind);
    if (!rows.length) continue;
    const parts = pageCount(rows.length, cap);
    const size = perPage(rows.length, cap);
    for (let part = 0; part < parts; part += 1) {
      panels.push({ kind, rows: rows.slice(part * size, part * size + size), total: counts[kind] ?? rows.length, part, parts });
    }
  }
  return panels;
}

export function pageCount(total: number, cap: number) {
  return Math.max(1, Math.ceil(total / Math.max(1, cap)));
}

/**
 * Sayfa başına satır: sayfa sayısı sabitken satırları sayfalara dengeli dağıtır.
 * 20 satır / 8 kapasite = 3 sayfa → 7 + 7 + 6 (8 + 8 + 4 yerine); böylece son
 * sayfa yarı boş kalmaz. Kapasitenin üstüne asla çıkmaz → taşma yine imkânsız.
 */
export function perPage(total: number, cap: number) {
  const size = Math.max(1, cap);
  if (total <= size) return size;
  return Math.ceil(total / pageCount(total, size));
}

/** Sayfa dilimi: `page` 0'dan başlar. */
export function pageSlice<T>(rows: T[], page: number, cap: number): T[] {
  const size = perPage(rows.length, cap);
  const start = Math.max(0, page) * size;
  return rows.slice(start, start + size);
}

/** "8–14 / 20" tipi etiket için 1 tabanlı sınırlar. */
export function pageBounds(total: number, page: number, cap: number) {
  const size = perPage(total, cap);
  const start = Math.max(0, page) * size;
  return {
    from: total ? Math.min(total, start + 1) : 0,
    to: Math.min(total, start + size),
    size,
    paged: total > size,
  };
}

/** Her ekranın kaç sayfa süreceği (veri uzunlukları ÷ kapasite). */
export type PagePlan = { team: Partial<Record<TeamSlideKey, number>>; owners: number[] };

export const ALERT_ORDER: AlertItem['kind'][] = ['overdue', 'poc_delay', 'stale', 'target_gap', 'customer_waiting', 'contract_waiting', 'expired_quote', 'portfolio_load'];

/**
 * Veri uzunlukları + ölçülen kapasiteden sayfa sayıları. Bir ekranda birden fazla
 * liste varsa en uzun olanı sayfa sayısını belirler (diğerleri kendi diliminde boş
 * kalır — "bu sayfada gösterilecek kayıt yok" yerine kart gizlenir).
 */
export function buildPagePlan(payload: LiveBoardPayload, caps: Capacities): PagePlan {
  const team: PagePlan['team'] = {
    // Bölünmüş Pulse'ta son sayfa aktivite + dönüşüm ekranıdır.
    pulse: pageCount(payload.owners.length, caps.leader) + (caps.pulseSplit ? 1 : 0),
    portfolio: Math.max(
      pageCount(payload.portfolio.byOwner.length, caps.portfolioRows),
      pageCount(payload.portfolio.bySector.length, caps.portfolioRows),
      pageCount(payload.portfolio.byPhaseGroup.length, caps.portfolioRows),
    ),
    hot: pageCount(payload.team.hot.length, caps.tableRows),
    poc: pageCount(payload.team.poc.length, caps.tableRows),
    quotes: Math.max(
      pageCount(payload.quotes.open.length, caps.openQuotes),
      pageCount(payload.quotes.recentClosed.length, caps.closedQuotes),
    ),
    alerts: pageCount(alertPanels(payload.team.alerts, payload.team.alertCounts, caps.alertItems, ALERT_ORDER).length, caps.alertGroups),
    jira: pageCount(payload.team.jira?.byCompany.length ?? 0, caps.jiraRows),
  };
  // Kişi slaytları tek sayfa (Çağdaş Bey, 04.09: "o kadar sayfaya gerek yok"):
  // Hot Pipeline 5 kart, Son Hareketler sığdığı kadar + "+N daha" notu.
  const owners = payload.owners.map(() => 1);
  return { team, owners };
}

/**
 * Slayt planı: takım ekranları ile kişi slaytları dönüşümlü akar
 * (2 takım → 2 kişi → 2 takım → …). Kişi bittiğinde kalan takım ekranları,
 * takım bittiğinde kalan kişiler eklenir. Döngü istemcide sonsuz tekrar eder.
 * Bir ekranın sayfaları ardışık gelir (Seda 1/2, Seda 2/2). Jira ekranı yalnız
 * entegrasyon açıkken plana girer.
 */
export function slidePlan(
  ownerCount: number,
  options?: { jira?: boolean; pages?: PagePlan },
): LiveSlide[] {
  // SABİT SIRA (Sinan, 09.09): Pulse → Portföy → kişiler (sabit satıcı sırası) →
  // Teklifler → Uyarılar → Jira. Kişi slaytları artık takım ekranlarının arasına
  // serpilmiyor, blok hâlinde akıyor. 'hot' ve 'poc' rotasyondan çıkarıldı
  // (Hot Pipeline kişi slaytından da kalktı); bileşenleri duruyor, listeye
  // eklenince yeniden yayına girerler.
  const before: TeamSlideKey[] = ['pulse', 'portfolio'];
  const after: TeamSlideKey[] = ['quotes', 'alerts'];
  if (options?.jira) after.push('jira');
  const teamPages = (key: TeamSlideKey) => Math.max(1, options?.pages?.team[key] ?? 1);
  const ownerPages = (index: number) => Math.max(1, options?.pages?.owners[index] ?? 1);

  const plan: LiveSlide[] = [];
  const pushTeam = (keys: TeamSlideKey[]) => {
    for (const key of keys) {
      const pages = teamPages(key);
      for (let page = 0; page < pages; page += 1) plan.push({ type: 'team', key, page, pages });
    }
  };
  pushTeam(before);
  for (let index = 0; index < ownerCount; index += 1) {
    const pages = ownerPages(index);
    for (let page = 0; page < pages; page += 1) plan.push({ type: 'owner', index, page, pages });
  }
  pushTeam(after);
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

/**
 * Jira firma tablosunda sıralama önceliği (Sinan, 09.09): adı bilinen firmalar 0,
 * "Bilinmeyen Firma" / "—" / boş olanlar 1 → tablo hangi ölçütle sıralanırsa sıralansın
 * bu satırlar her zaman EN SONDA kalır. (Jira özetinden firma adı çıkarılamayan
 * ticket'lar `lib/jira-weekly-tickets.ts` içinde "Bilinmeyen Firma" olarak etiketlenir.)
 */
export function unknownCompanyRank(company: string | null | undefined) {
  const name = String(company ?? '').trim().toLocaleLowerCase('tr');
  return !name || name === '—' || name === '-' || name.startsWith('bilinmeyen') ? 1 : 0;
}

export function pctOf(actual: number, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.round((actual / target) * 100);
}

/**
 * Teklif → satış dönüşüm oranı: kapanan tekliflerin (satış + iptal edilmiş satış + kayıp)
 * kaçı satışa döndü. Kapanan teklif yoksa null — "%0" yanıltıcı olurdu.
 * (Çağdaş Bey / satış ekibi, 07.09: "% kaçı satışa çevirdi genel ve kişi bazlı".)
 */
export function conversionPct(sale: number, cancelled: number, lost: number): number | null {
  const closed = sale + cancelled + lost;
  if (closed <= 0) return null;
  return Math.round((sale / closed) * 100);
}

/** Dönüşüm oranının rengi: %50+ iyi · %25–49 uyarı · %25 altı kritik. */
export function conversionTone(pct: number | null): Tone {
  if (pct == null) return 'neutral';
  return pct >= 50 ? 'ok' : pct >= 25 ? 'warn' : 'danger';
}
