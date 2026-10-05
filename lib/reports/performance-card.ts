/**
 * PERFORMANS KARNESİ — Retail Sales Performance Report V1 (05.10.2026).
 * Saf kurallar + tipler (istemci, sunucu ve vitest ortak). Veri: lib/reports/performance-report.ts.
 *
 * SKOR (100) — her boyut 0..1 orana indirilir, ağırlıkla çarpılır:
 *   Ticari Sonuç       40 · dönem cirosu + satılan cihaz (hedefe, dönemin geçen süresine göre)
 *   İş Geliştirme      20 · Hunter→Farmer, Lead→Hunter, kazanılan teklif
 *   Müşteri Yönetimi   15 · ort. görüşme/firma (hedef 5) + hareketsiz firma oranı
 *   Aktivite Disiplini 15 · görüşme (fiziki + online) hedefi
 *   CRM & Süreç        10 · 30+ gün dokunulmamış teklif, geçmiş kapanış/aksiyon, 30+ gün POC
 * Hedefi olmayan ölçüt hesaba katılmaz; ölçüsü olmayan boyut N/A yazar, toplam kalan ağırlıklarla
 * 100'e ölçeklenir (uydurma puan yok).
 */
import type { Tone } from './live-board-shared';

export type PerfPeriodKind = 'month' | 'quarter' | 'ytd';
export const PERF_PERIODS: Array<{ key: PerfPeriodKind; label: string }> = [
  { key: 'month', label: 'Aylık' },
  { key: 'quarter', label: '3 Aylık' },
  { key: 'ytd', label: 'YTD' },
];
export function isPerfPeriod(value: unknown): value is PerfPeriodKind {
  return value === 'month' || value === 'quarter' || value === 'ytd';
}

export type PerfDimensionKey = 'commercial' | 'bizdev' | 'customer' | 'activity' | 'crm';
export type PerfDimension = { key: PerfDimensionKey; label: string; weight: number; score: number | null; hint: string };
export type PerfGrade = { label: string; tone: Tone };

export const PERF_WEIGHTS: Array<{ key: PerfDimensionKey; label: string; weight: number; hint: string }> = [
  { key: 'commercial', label: 'Ticari Sonuç', weight: 40, hint: 'ciro + satılan cihaz' },
  { key: 'bizdev', label: 'İş Geliştirme', weight: 20, hint: 'H→F · L→H · kazanılan teklif' },
  { key: 'customer', label: 'Müşteri Yönetimi', weight: 15, hint: 'görüşme/firma · hareketsiz oranı' },
  { key: 'activity', label: 'Aktivite Disiplini', weight: 15, hint: 'fiziki + online görüşme' },
  { key: 'crm', label: 'CRM & Süreç', weight: 10, hint: 'bekleyen teklif · geçmiş tarih · POC' },
];

/** Skor bantları — TEK yer (iş emri: merkezi config). */
export const PERF_BANDS: Array<{ min: number; label: string; tone: Tone }> = [
  { min: 90, label: 'Üstün Performans', tone: 'ok' },
  { min: 80, label: 'Güçlü Performans', tone: 'ok' },
  { min: 70, label: 'Beklentiyi Karşılıyor', tone: 'info' },
  { min: 60, label: 'Gelişim Gerekiyor', tone: 'warn' },
  { min: 0, label: 'Kritik Gelişim Alanı', tone: 'danger' },
];

/** Hareketsizlik eşiği (gün): Lead/Hunter 15, Farmer/Kasa 30. */
export const INACTIVE_DAYS_BY_CATEGORY: Record<'L' | 'H' | 'F' | 'K', number> = { L: 15, H: 15, F: 30, K: 30 };
/** Ort. görüşme / firma hedefi (Hedefler ekranında ortak hedef yoksa). */
export const DEFAULT_MEETINGS_PER_FIRM = 5;
export const STALE_QUOTE_DAYS = 30;
export const LONG_POC_DAYS = 30;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const avg = (values: Array<number | null>) => {
  const list = values.filter((v): v is number => v != null && Number.isFinite(v));
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
};

export type Measure = { actual: number; target: number | null };

/** Gerçekleşme yüzdesi; hedef yoksa null (N/A — 0 değil). */
export function attainmentPct(m: Measure | null | undefined): number | null {
  if (!m || m.target == null || m.target <= 0) return null;
  return Math.round((m.actual / m.target) * 100);
}

/** Renk kuralı: ≥100 yeşil · 80–99 turuncu · <80 kırmızı · hedef yok nötr. */
export function attainmentTone(pct: number | null): Tone {
  if (pct == null) return 'neutral';
  if (pct >= 100) return 'ok';
  if (pct >= 80) return 'warn';
  return 'danger';
}

/** Dönemin geçen süresine göre oran (0..1): dönemin %50'si geçtiyse %50 gerçekleşme tam puan. */
export function paceRatio(m: Measure | null | undefined, elapsedPct: number): number | null {
  if (!m || m.target == null || m.target <= 0) return null;
  const elapsed = Math.max(0.05, Math.min(1, elapsedPct / 100));
  return clamp01(m.actual / m.target / elapsed);
}

export function perfGrade(total: number | null): PerfGrade {
  if (total == null) return { label: 'N/A · veri yetersiz', tone: 'neutral' };
  const band = PERF_BANDS.find((b) => total >= b.min) ?? PERF_BANDS[PERF_BANDS.length - 1];
  return { label: band.label, tone: band.tone };
}

/** Toplam skor: ölçülebilen boyutların ağırlığına göre 100'e ölçeklenir; hiçbiri yoksa null. */
export function perfTotal(dims: PerfDimension[]): number | null {
  const measured = dims.filter((d) => d.score != null);
  const weight = measured.reduce((s, d) => s + d.weight, 0);
  if (!weight) return null;
  return Math.round((measured.reduce((s, d) => s + (d.score ?? 0), 0) / weight) * 100);
}

/* --- Dönem ------------------------------------------------------------------ */

export type PerfRange = {
  kind: PerfPeriodKind;
  from: string;
  to: string;
  /** Dönemin takvim sonu (ay/çeyrek/yıl sonu) — geçen süre oranı için. */
  end: string;
  label: string;
  /** Yönetici değerlendirmesinin anahtarı: m-2026-10 · q4-2026 · ytd-2026. */
  periodKey: string;
  elapsedPct: number;
  /** Dönemin kapsadığı ay sayısı (yıllık hedefi dönemlere bölmek için). */
  months: number;
};

const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dayNum = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;
const fmtDay = (key: string) => `${key.slice(8, 10)} ${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

export function perfRange(kind: PerfPeriodKind, todayKey: string): PerfRange {
  const y = Number(todayKey.slice(0, 4));
  const m = Number(todayKey.slice(5, 7));
  let from: string;
  let end: string;
  let label: string;
  let periodKey: string;
  let months: number;
  if (kind === 'month') {
    from = `${y}-${pad(m)}-01`;
    end = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
    label = `Aylık Performans · ${MONTHS_LONG[m - 1]} ${y}`;
    periodKey = `m-${y}-${pad(m)}`;
    months = 1;
  } else if (kind === 'quarter') {
    const q = Math.ceil(m / 3);
    const qm = (q - 1) * 3 + 1;
    from = `${y}-${pad(qm)}-01`;
    end = `${y}-${pad(qm + 2)}-${pad(lastDay(y, qm + 2))}`;
    label = `3 Aylık Performans · Q${q} ${y} (${MONTHS_SHORT[qm - 1]}–${MONTHS_SHORT[qm + 1]})`;
    periodKey = `q${q}-${y}`;
    months = 3;
  } else {
    from = `${y}-01-01`;
    end = `${y}-12-31`;
    label = `YTD Performans · 01 Ocak – ${fmtDay(todayKey)}`;
    periodKey = `ytd-${y}`;
    months = 12;
  }
  const elapsedPct = Math.round(((dayNum(todayKey) - dayNum(from) + 1) / (dayNum(end) - dayNum(from) + 1)) * 100);
  return { kind, from, to: todayKey, end, label, periodKey, elapsedPct, months };
}

/** Son 6 ay (bu ay dahil) — 'YYYY-MM' anahtarları, eskiden yeniye. */
export function trendMonths(todayKey: string, count = 6): string[] {
  const y = Number(todayKey.slice(0, 4));
  const m = Number(todayKey.slice(5, 7));
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}

/* --- Rapor verisi ------------------------------------------------------------ */

export type PerfTrendPoint = { month: string; label: string; actual: number; target: number | null };
export type PerfReview = { strong: string; improve: string; focus: string; updatedBy: string | null; updatedAt: string | null };

export type PerfOwnerReport = {
  owner: string;
  /** Değerlendirme anahtarı (normalize ad; ekip için '__team__'). */
  key: string;
  revenue: Measure;
  devices: Measure;
  meetings: Measure;
  /** Dönemde fiziki/online görüşme yapılan tekil müşteri. */
  contacted: number;
  meetingsPerFirm: Measure | null;
  invoices: { count: number; amount: number };
  won: { quotes: number; amount: number; customers: number; target: number | null };
  hunterToFarmer: Measure;
  leadToHunter: Measure;
  pipeline: { forecast: number; weighted: number; openCount: number; openAmount: number };
  service: { activeDevices: number; target: number | null; monthlyRevenue: number };
  rentalDevices: number;
  portfolio: { total: number; lead: number; hunter: number; farmer: number; kasa: number; listed: boolean };
  activePoc: number;
  risks: { inactive: number; staleQuotes: number; longPoc: number; overdueActions: number; overdueClose: number };
  trend: PerfTrendPoint[];
  review: PerfReview | null;
};

export type PerfPayload = {
  generatedAt: string;
  range: PerfRange;
  owners: PerfOwnerReport[];
  team: PerfOwnerReport;
  notes: string[];
  canEditReview: boolean;
};

export function perfDimensions(r: PerfOwnerReport, elapsedPct: number): PerfDimension[] {
  const commercial = avg([paceRatio(r.revenue, elapsedPct), paceRatio(r.devices, elapsedPct)]);
  const bizdev = avg([
    paceRatio(r.hunterToFarmer, elapsedPct),
    paceRatio(r.leadToHunter, elapsedPct),
    paceRatio({ actual: r.won.quotes, target: r.won.target }, elapsedPct),
  ]);
  const perFirm = r.meetingsPerFirm && r.meetingsPerFirm.target ? clamp01(r.meetingsPerFirm.actual / r.meetingsPerFirm.target) : null;
  const inactiveShare = r.portfolio.total > 0 ? clamp01(1 - r.risks.inactive / r.portfolio.total) : null;
  const customer = avg([perFirm, inactiveShare]);
  const activity = paceRatio(r.meetings, elapsedPct);
  const issues = r.risks.staleQuotes + r.risks.overdueClose + r.risks.overdueActions + r.risks.longPoc;
  const base = r.pipeline.openCount + r.activePoc + r.portfolio.total;
  const crm = base > 0 ? clamp01(1 - issues / base) : null;
  const scores: Record<PerfDimensionKey, number | null> = { commercial, bizdev, customer, activity, crm };
  return PERF_WEIGHTS.map((w) => ({
    key: w.key, label: w.label, weight: w.weight, hint: w.hint,
    score: scores[w.key] == null ? null : Math.round(scores[w.key]! * w.weight),
  }));
}
