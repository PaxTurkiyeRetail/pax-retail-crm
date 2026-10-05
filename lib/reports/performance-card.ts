/**
 * PERFORMANS KARNESİ — Dashboard'un açılış sekmesi (05.10.2026).
 * Müdürün hazırladığı "Retail Sales Performance Report" taslağının canlı veriye bağlanmış hali.
 * Yeni SQL yok: Canlı Ekran'ın kişi verisi (`LiveOwner`) kullanılır, sayılar Canlı Ekran ile birebir aynıdır.
 *
 * SKOR (100 puan) — her boyut 0..1 arası bir orana indirilir, ağırlıkla çarpılır:
 *   Ticari Sonuç       40 · ciro ve cihaz gerçekleşmesi (YTD), yılın geçen süresine göre (hız)
 *   İş Geliştirme      20 · Hunter→Farmer, Lead→Hunter, kazanılan teklif hedefleri (hedefi girilenler)
 *   Müşteri Yönetimi   15 · temas edilen müşteri hedefi + hareketsiz firma oranı
 *   Aktivite Disiplini 15 · yıllık görüşme hedefi (hıza göre) + bu haftanın aktivite hedefi
 *   CRM & Süreç        10 · süresi geçmiş teklif, gecikmiş aksiyon, kritik bekleyen kayıt oranı
 * Hedefi girilmemiş ölçüt hesaba katılmaz; boyutun hiç ölçütü yoksa boyut ağırlığı dağıtılmaz,
 * "veri yok" yazar ve toplam skor kalan ağırlıklara göre 100'e ölçeklenir (uydurma puan yok).
 */
import type { LiveOwner, LiveBoardPayload, Tone } from './live-board-shared';
import type { GoalPair } from './targets-shared';

export type PerfDimensionKey = 'commercial' | 'bizdev' | 'customer' | 'activity' | 'crm';
export type PerfDimension = { key: PerfDimensionKey; label: string; weight: number; score: number | null; hint: string };
export type PerfGrade = { label: string; tone: Tone };

export const PERF_WEIGHTS: Array<{ key: PerfDimensionKey; label: string; weight: number }> = [
  { key: 'commercial', label: 'Ticari Sonuç', weight: 40 },
  { key: 'bizdev', label: 'İş Geliştirme', weight: 20 },
  { key: 'customer', label: 'Müşteri Yönetimi', weight: 15 },
  { key: 'activity', label: 'Aktivite Disiplini', weight: 15 },
  { key: 'crm', label: 'CRM & Süreç', weight: 10 },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const avg = (values: Array<number | null>) => {
  const list = values.filter((v): v is number => v != null && Number.isFinite(v));
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
};
/** Hedefe göre oran (0..1); hedef yoksa null. */
export function goalRatio(pair: GoalPair | null | undefined): number | null {
  if (!pair || pair.target == null || pair.target <= 0) return null;
  return clamp01(pair.actual / pair.target);
}
/** YTD hedefinde hıza göre oran: yılın %75'i geçtiyse %75 gerçekleşme tam puandır. */
export function paceRatio(pair: GoalPair | null | undefined, elapsedPct: number): number | null {
  const raw = goalRatio(pair);
  if (raw == null) return null;
  const elapsed = Math.max(0.05, Math.min(1, elapsedPct / 100));
  return clamp01(raw / elapsed);
}

export function perfDimensions(owner: LiveOwner): PerfDimension[] {
  const r = owner.revenue;
  const g = owner.goals;
  const elapsed = r.yearElapsedPct;
  const revenue = paceRatio({ actual: r.actualYtd, target: r.target, pct: null }, elapsed);
  const devices = paceRatio({ actual: r.deviceActualYtd, target: r.deviceTarget, pct: null }, elapsed);
  const commercial = avg([revenue, devices]);

  const bizdev = avg([goalRatio(g.hunterToFarmer), goalRatio(g.leadToHunter), paceRatio(g.wonQuotes, elapsed)]);

  const portfolio = owner.portfolio.total;
  const inactiveShare = portfolio > 0 ? clamp01(1 - owner.inactive.count / portfolio) : null;
  const customer = avg([paceRatio(owner.coverage.covered, elapsed), inactiveShare]);

  const weekly = owner.target.totalActivities ? clamp01((owner.achievementPct ?? 0) / 100) : null;
  const activity = avg([paceRatio(g.visitsYear, elapsed), weekly]);

  const issues = r.expiredOpenQuotes + owner.pipeline.overdueActions + owner.pipeline.staleCritical;
  const base = g.openAll + owner.pipeline.activeCustomers;
  const crm = base > 0 ? clamp01(1 - issues / base) : issues > 0 ? 0 : null;

  const scores: Record<PerfDimensionKey, number | null> = { commercial, bizdev, customer, activity, crm };
  const hints: Record<PerfDimensionKey, string> = {
    commercial: 'ciro + cihaz hedefi (yılın hızına göre)',
    bizdev: 'H→F · L→H çevirme, kazanılan teklif',
    customer: 'temas edilen müşteri, hareketsiz firma',
    activity: 'yıllık görüşme + haftalık aktivite',
    crm: 'süresi geçen teklif, geciken aksiyon',
  };
  return PERF_WEIGHTS.map((w) => ({
    ...w,
    score: scores[w.key] == null ? null : Math.round(scores[w.key]! * w.weight),
    hint: hints[w.key],
  }));
}

/** Toplam skor: ölçülebilen boyutların ağırlığına göre 100'e ölçeklenir; hiçbiri yoksa null. */
export function perfTotal(dims: PerfDimension[]): number | null {
  const measured = dims.filter((d) => d.score != null);
  const weight = measured.reduce((s, d) => s + d.weight, 0);
  if (!weight) return null;
  return Math.round((measured.reduce((s, d) => s + (d.score ?? 0), 0) / weight) * 100);
}

export function perfGrade(total: number | null): PerfGrade {
  if (total == null) return { label: 'Veri yetersiz', tone: 'neutral' };
  if (total >= 85) return { label: 'Beklentinin Üstünde', tone: 'ok' };
  if (total >= 70) return { label: 'Beklentiyi Karşılıyor', tone: 'info' };
  if (total >= 55) return { label: 'Gelişim Gerekli', tone: 'warn' };
  return { label: 'Risk', tone: 'danger' };
}

/** Yönetici değerlendirmesi: kurallarla üretilen kısa maddeler (İK görüşmesi özeti). */
export function perfReview(owner: LiveOwner) {
  const r = owner.revenue;
  const g = owner.goals;
  const strong: string[] = [];
  const improve: string[] = [];
  const focus: string[] = [];
  const pct = (v: number | null) => (v == null ? null : Math.round(v * 100));
  const elapsed = r.yearElapsedPct;

  const rev = goalRatio({ actual: r.actualYtd, target: r.target, pct: null });
  const dev = goalRatio({ actual: r.deviceActualYtd, target: r.deviceTarget, pct: null });
  const visits = goalRatio(g.visitsYear);
  const covered = goalRatio(owner.coverage.covered);
  const onPace = (v: number | null) => v != null && v * 100 >= elapsed;

  if (onPace(dev)) strong.push(`Cihaz hedefinde %${pct(dev)} gerçekleşme (yılın %${elapsed}'i geçti).`);
  else if (dev != null) improve.push(`Cihaz hedefi gerçekleşmesi %${pct(dev)}, yılın hızının (%${elapsed}) altında.`);
  if (onPace(rev)) strong.push(`Ciro hedefinde %${pct(rev)} gerçekleşme.`);
  else if (rev != null) improve.push(`YTD ciro hedef gerçekleşmesi düşük (%${pct(rev)}).`);
  if (onPace(visits)) strong.push(`Görüşme temposu hedefte (%${pct(visits)}).`);
  else if (visits != null) improve.push(`Yıllık görüşme %${pct(visits)}; tempo artmalı.`);
  if (onPace(covered)) strong.push('Yüksek müşteri temas hacmi.');
  if (g.openAll > 0 && r.pipeline > 0) strong.push('Açık teklif havuzu ve aktif pipeline devam ediyor.');
  const h2f = goalRatio(g.hunterToFarmer);
  const l2h = goalRatio(g.leadToHunter);
  if ((h2f != null && h2f < 0.5) || (l2h != null && l2h < 0.5)) improve.push('Hunter → Farmer ve Lead → Hunter dönüşümleri hızlandırılmalı.');
  if (owner.inactive.count > 0) improve.push(`Hareketsiz müşteri sayısı (${owner.inactive.count}) azaltılmalı.`);
  if (r.expiredOpenQuotes > 0) improve.push(`${r.expiredOpenQuotes} teklifin geçerlilik süresi dolmuş, kapatılmalı.`);

  if (g.openAll > 0) focus.push(`${g.openAll} açık teklifin kapanış planını sıkı takip etmek.`);
  if (owner.inactive.count > 0) focus.push('Hareketsiz portföyde öncelikli müşteri aksiyonlarını tamamlamak.');
  if (owner.pipeline.overdueActions > 0) focus.push(`Tarihi geçmiş ${owner.pipeline.overdueActions} aksiyonu kapatmak.`);
  focus.push(`${g.quarter.label} görüşme ve ciro temposunu yükseltmek.`);

  return { strong: strong.slice(0, 4), improve: improve.slice(0, 4), focus: focus.slice(0, 4) };
}

/** Ekip Özeti: kişileri toplayıp sahte bir "ekip kişisi" üretir; skor, kişi skorlarının ortalamasıdır. */
export function teamAsOwner(payload: LiveBoardPayload): LiveOwner | null {
  const owners = payload.owners;
  if (!owners.length) return null;
  const sum = (pick: (o: LiveOwner) => number) => owners.reduce((s, o) => s + (pick(o) || 0), 0);
  const sumNull = (pick: (o: LiveOwner) => number | null) => {
    const vals = owners.map(pick).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const pair = (pick: (o: LiveOwner) => GoalPair): GoalPair => {
    const actual = sum((o) => pick(o).actual);
    const target = sumNull((o) => pick(o).target);
    return { actual, target, pct: target ? Math.round((actual / target) * 100) : null };
  };
  const first = owners[0];
  const team = payload.team;
  return {
    ...first,
    owner: 'Ekip Özeti',
    initials: 'EK',
    portfolio: {
      total: sum((o) => o.portfolio.total), active: sum((o) => o.portfolio.active), hunter: sum((o) => o.portfolio.hunter),
      farmer: sum((o) => o.portfolio.farmer), lead: sum((o) => o.portfolio.lead), kasa: sum((o) => o.portfolio.kasa),
    },
    revenue: team.revenue,
    pipeline: team.pipeline,
    actual: team.actual,
    target: team.target,
    achievementPct: team.achievementPct,
    goals: {
      ...first.goals,
      visitsYear: pair((o) => o.goals.visitsYear),
      visitsQuarter: pair((o) => o.goals.visitsQuarter),
      budgetQuarter: pair((o) => o.goals.budgetQuarter),
      hunterToFarmer: pair((o) => o.goals.hunterToFarmer),
      leadToHunter: pair((o) => o.goals.leadToHunter),
      wonQuotes: pair((o) => o.goals.wonQuotes),
      openAll: sum((o) => o.goals.openAll),
      draft: sum((o) => o.goals.draft),
      lostQuotes: sum((o) => o.goals.lostQuotes),
    },
    coverage: {
      covered: pair((o) => o.coverage.covered),
      contactsPer: { actual: 0, target: null, pct: null },
      activitiesYear: sum((o) => o.coverage.activitiesYear),
    },
    inactive: { count: sum((o) => o.inactive.count), days: first.inactive.days, unmatched: sum((o) => o.inactive.unmatched) },
    quoteBox: {
      open: { count: sum((o) => o.quoteBox.open.count), amount: sum((o) => o.quoteBox.open.amount) },
      won: { count: sum((o) => o.quoteBox.won.count), amount: sum((o) => o.quoteBox.won.amount) },
      lost: { count: sum((o) => o.quoteBox.lost.count), amount: sum((o) => o.quoteBox.lost.amount) },
    },
    devices: { ...first.devices, total: sum((o) => o.devices.total), sold: sum((o) => o.devices.sold), rental: sum((o) => o.devices.rental) },
    invoices: sum((o) => o.invoices),
  };
}
