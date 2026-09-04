'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import '@/styles/live-board.css';
import { WEEKLY_TARGET_LABELS, achievementPct } from '@/lib/reports/weekly-targets-shared';
import {
  ALERT_ORDER,
  LIVE_BOARD_RULES,
  LIVE_BOARD_SPEEDS,
  LIVE_BOARD_TIMING,
  TEAM_SLIDE_TITLES,
  agoLabel,
  alertPanels,
  buildPagePlan,
  capacities,
  dueLabel,
  dueTone,
  fmtMoney,
  layoutMetrics,
  pageBounds,
  pageCount,
  pageSlice,
  slideDurationMs,
  slidePlan,
  staleTone,
  type AlertItem,
  type Capacities,
  type Distribution,
  type Funnel,
  type HotItem,
  type LiveActivity,
  type LiveBoardPayload,
  type LiveBoardSpeed,
  type LiveOwner,
  type LiveSlide,
  type PocItem,
  type RevenueBlock,
  type Tone,
} from '@/lib/reports/live-board-shared';

// PAX Retail Command Center — Canlı Ekran (TV modu).
//
// Davranış:
//   • Slaytlar dönüşümlü akar: 2 takım ekranı → 2 kişi → 2 takım → … (slidePlan).
//     Takım ekranları: Business Pulse, Portföy, Hot Pipeline, POC/Pilot/Rollout,
//     Teklifler & Forecast, Yönetim Uyarıları, (Jira — entegrasyon açıksa).
//   • Süre: takım 22 sn, kişi 18 sn (spec: 20–30 sn); hız ×1.5 / ×1 / ×0.6 (localStorage).
//   • Veri: /api/reports/live-board, 5 dakikada bir sessizce yenilenir. Yenileme
//     akan slaytı bozmaz; üst şeritte son başarılı güncelleme saati görünür.
//   • Kontroller fareyle görünür, tam ekranda 3 sn sonra gizlenir. Klavye: Boşluk
//     duraklat · ← → gezin · F tam ekran · R yenile.
//   • Renk dili (spec §15): yeşil = yolunda, turuncu = dikkat, kırmızı = aksiyon,
//     mavi = devam eden süreç. Renk asla tek başına anlam taşımaz; yanında metin var.
//
// TAŞMA YOK — ÖLÇÜME DAYALI SAYFALAMA:
//   Pano gövdesi ResizeObserver ile ölçülür → `capacities(yükseklik, genişlik)`
//   her liste için kaç satırın sığdığını verir (satır yükseklikleri LayoutMetrics'te
//   sabit; CSS aynı sayıları `--lb-*` değişkenlerinden okur) → sığmayan kayıtlar bir
//   sonraki SAYFAYA taşınır ve ayrı slayt olur ("Seda Kesikoğlu 2/2", "Hot Pipeline 1/3").
//   Böylece hiçbir kayıt gizlenmez, hiçbir şey kutudan taşmaz. Gövde küçükse
//   (< COMPACT_BODY_HEIGHT) kompakt ölçüler devreye girer; büyük pencerede punto büyür.

const SPEED_KEY = 'pax-live-board-speed';
const CONTROLS_HIDE_MS = 3000;
const TZ = 'Europe/Istanbul';

function fmt(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('tr-TR');
}
function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}
function fmtClock(date: Date) {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function fmtWhen(iso: string, todayKey: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const day = date.toLocaleDateString('en-CA', { timeZone: TZ });
  if (day === todayKey) return `Bugün ${time}`;
  return `${date.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: TZ })} ${time}`;
}
function pctTone(pct: number | null): Tone {
  if (pct == null) return 'neutral';
  if (pct >= 100) return 'ok';
  if (pct < 50) return 'warn';
  return 'info';
}
function readSpeed(): LiveBoardSpeed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved === 'slow' || saved === 'fast' || saved === 'normal') return saved;
  } catch {}
  return 'normal';
}
const SHORT_LABELS: Record<string, string> = { pulse: 'PULSE', portfolio: 'PORTFÖY', hot: 'HOT', poc: 'POC', quotes: 'TEKLİF', alerts: 'UYARI', jira: 'JIRA' };
const TONE_WORD: Record<Tone, string> = { ok: 'yolunda', warn: 'dikkat', danger: 'aksiyon', info: 'devam ediyor', neutral: '' };

/* --- Küçük parçalar ----------------------------------------------------- */

/** Tek değerli halka (meter): hedefe göre gerçekleşme. */
function Ring({ pct, tone, big, sub, size = 150, stroke = 12 }: { pct: number | null; tone: Tone; big: string; sub: string; size?: number; stroke?: number }) {
  const radius = 50 - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const filled = pct == null ? 0 : Math.min(100, Math.max(0, pct)) / 100 * circumference;
  return (
    <div className={`lb-ring tone-${tone}`} style={{ width: size, height: size }} role="img" aria-label={pct == null ? big : `%${pct} · ${sub}`}>
      <svg viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={radius} strokeWidth={stroke} />
        <circle className="value" cx="50" cy="50" r={radius} strokeWidth={stroke} strokeDasharray={`${filled} ${circumference}`} />
      </svg>
      <div className="lb-ring-center">
        <strong>{big}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

/** Parça-bütün halkası (≤ 6 dilim) + açıklama listesi. Dilimler arası 2px yüzey boşluğu. */
function Donut({ rows, shown, center, centerLabel, colors, size = 168 }: { rows: Distribution; shown?: Distribution; center: string; centerLabel: string; colors: string[]; size?: number }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && rows.filter((r) => r.value > 0).length > 1 ? 2.2 : 0;
  let offset = 0;
  const segments = rows.map((row, index) => {
    const share = total ? row.value / total : 0;
    const length = Math.max(0, share * circumference - gap);
    const seg = { row, index, length, offset, color: colors[index % colors.length] };
    offset += share * circumference;
    return seg;
  });
  return (
    <div className="lb-donut-wrap">
      <div className="lb-donut" style={{ width: size, height: size }} role="img" aria-label={`${centerLabel} ${center}`}>
        <svg viewBox="0 0 100 100">
          <circle className="track" cx="50" cy="50" r={radius} />
          {segments.filter((s) => s.length > 0).map((s) => (
            <circle key={s.row.label} cx="50" cy="50" r={radius} stroke={s.color} strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} />
          ))}
        </svg>
        <div className="lb-ring-center"><strong>{center}</strong><span>{centerLabel}</span></div>
      </div>
      <div className="lb-legend">
        {(shown ?? rows).map((row) => {
          const index = rows.findIndex((item) => item.label === row.label);
          return (
            <div className="lb-legend-row" key={row.label}>
              <i style={{ background: colors[Math.max(0, index) % colors.length] }} />
              <span>{row.label}</span>
              <strong>{fmt(row.value)}</strong>
              <em>{total ? `%${Math.round((row.value / total) * 100)}` : ''}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Yatay çubuklar — tek seri, tek renk; değer ve pay sağda. */
function HBars({ rows, total, maxRows = 8 }: { rows: Distribution; total?: number; maxRows?: number }) {
  const shown = rows.slice(0, maxRows);
  const max = Math.max(1, ...shown.map((row) => row.value));
  const base = total ?? rows.reduce((sum, row) => sum + row.value, 0);
  if (!shown.length) return <div className="lb-muted">Veri yok.</div>;
  return (
    <div className="lb-hbars">
      {shown.map((row) => (
        <div className="lb-hbar" key={row.label}>
          <span className="lb-hbar-label" title={row.label}>{row.label}</span>
          <div className="lb-bar"><span className={`tone-${row.tone ?? 'info'}`} style={{ width: `${Math.max(2, Math.round((row.value / max) * 100))}%` }} /></div>
          <strong>{fmt(row.value)}</strong>
          <em>{base ? `%${Math.round((row.value / base) * 100)}` : ''}</em>
        </div>
      ))}
    </div>
  );
}

function Bar({ actual, target }: { actual: number; target: number }) {
  const pct = achievementPct(actual, target);
  const width = pct == null ? (actual > 0 ? 100 : 0) : Math.min(100, pct);
  return <div className="lb-bar"><span className={`tone-${pct == null ? 'neutral' : pctTone(pct)}`} style={{ width: `${width}%` }} /></div>;
}

function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`lb-pill tone-${tone}`} title={title}>{children}</span>;
}
function DuePill({ days, date }: { days: number | null; date: string | null }) {
  const tone = dueTone(days);
  const icon = tone === 'danger' ? '🔴' : tone === 'warn' ? '🟠' : tone === 'ok' ? '🟢' : '';
  return <Pill tone={tone} title={date ? fmtDate(date) : undefined}>{icon ? `${icon} ` : ''}{dueLabel(days)}</Pill>;
}
function PhaseChip({ no, name }: { no: number | null; name?: string | null }) {
  if (no == null) return <Pill tone="neutral">Fazsız</Pill>;
  const short = name ? name.split(/\s[+\/&]\s|\s\/\s/)[0].trim() : '';
  return <Pill tone="info" title={name ?? undefined}>Faz {no}{short ? ` · ${short.length > 16 ? `${short.slice(0, 16)}…` : short}` : ''}</Pill>;
}
function Kpi({ label, value, sub, tone = 'neutral', small }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; small?: boolean }) {
  return (
    <div className={`lb-kpi tone-${tone} ${small ? 'small' : ''}`}>
      <div className="lb-kpi-label">{label}</div>
      <div className="lb-kpi-value">{value}</div>
      {sub ? <div className="lb-kpi-sub">{sub}</div> : null}
    </div>
  );
}

/** Ticari bant: tek satırda kişinin/takımın para durumu. */
function MoneyBand({ r, pipeline, weekQuotes }: { r: RevenueBlock; pipeline: { poc: number }; weekQuotes: number }) {
  const items: Array<{ k: string; v: string; n: string; tone?: Tone }> = [
    { k: 'YTD Ciro', v: fmtMoney(r.actualYtd), n: r.target != null ? `hedef ${fmtMoney(r.target)} · %${r.attainmentPct ?? 0}` : 'yıllık hedef girilmedi', tone: r.pace ?? 'neutral' },
    { k: 'Forecast · yıl sonu', v: fmtMoney(r.forecast), n: r.forecastPct != null ? `hedefin %${r.forecastPct}'i` : 'gerçekleşen + ağırlıklı pipeline' },
    { k: 'Gap', v: r.forecastGap == null ? '—' : fmtMoney(r.forecastGap, { sign: true }), n: r.forecastGap == null ? 'hedef yok' : r.forecastGap >= 0 ? 'hedefin üstünde' : 'hedefin altında', tone: r.forecastGap == null ? 'neutral' : r.forecastGap >= 0 ? 'ok' : 'danger' },
    { k: 'Pipeline', v: fmtMoney(r.pipeline), n: `${fmt(r.openQuotes)} açık teklif · ağırlıklı ${fmtMoney(r.weightedPipeline)}` },
    { k: 'Aktif POC', v: fmt(pipeline.poc), n: 'konsinye · pilot · test' },
    { k: 'Teklif', v: fmt(weekQuotes), n: 'bu hafta oluşturulan' },
    { k: 'Sipariş · YTD', v: fmt(r.wonYtd.count), n: `${fmtMoney(r.wonYtd.amount)} kazanılan`, tone: r.wonYtd.count ? 'ok' : 'neutral' },
  ];
  return (
    <div className="lb-band" aria-label="Ticari özet">
      {items.map((item) => (
        <div className={`lb-band-item tone-${item.tone ?? 'neutral'}`} key={item.k}>
          <span>{item.k}</span>
          <strong>{item.v}</strong>
          <small>{item.n}</small>
        </div>
      ))}
    </div>
  );
}

/** Dönüşüm satırı: Aktivite → Firma → Faz ilerledi → Teklif → Sipariş. */
function FunnelRow({ f }: { f: Funnel }) {
  const steps = [
    { n: f.activities, l: 'Aktivite', t: 'Bu hafta girilen aktivite' },
    { n: f.customers, l: 'Firma', t: 'Temas edilen tekil firma' },
    { n: f.advanced, l: 'Faz ↑', t: 'Fazı ilerleyen müşteri' },
    { n: f.quotes, l: 'Teklif', t: 'Bu hafta oluşturulan teklif' },
    { n: f.orders, l: 'Sipariş', t: 'Kazanılan teklif ya da Sipariş fazına geçen müşteri' },
  ];
  return (
    <div className="lb-funnel" aria-label="Haftalık dönüşüm">
      {steps.map((step, index) => (
        <div className="lb-funnel-step" key={step.l}>
          <div className={`lb-funnel-box ${step.n === 0 && index > 0 ? 'zero' : ''}`} title={step.t}>
            <strong>{fmt(step.n)}</strong>
            <span>{step.l}</span>
          </div>
          {index < steps.length - 1 ? <i aria-hidden="true">→</i> : null}
        </div>
      ))}
    </div>
  );
}

/** Zaman ilerlemesi karşılaştırması (spec §6.2): yılın geçen süresi vs ciro gerçekleşmesi. */
function PaceCompare({ r }: { r: RevenueBlock }) {
  return (
    <div className="lb-pace">
      <div className="lb-pace-row">
        <span>Yılın geçen süresi</span>
        <div className="lb-bar"><span className="tone-neutral" style={{ width: `${r.yearElapsedPct}%` }} /></div>
        <strong>%{r.yearElapsedPct}</strong>
      </div>
      <div className="lb-pace-row">
        <span>Ciro gerçekleşmesi</span>
        <div className="lb-bar"><span className={`tone-${r.pace ?? 'neutral'}`} style={{ width: `${Math.min(100, r.attainmentPct ?? 0)}%` }} /></div>
        <strong>{r.attainmentPct == null ? '—' : `%${r.attainmentPct}`}</strong>
      </div>
      <div className={`lb-pace-note tone-${r.pace ?? 'neutral'}`}>
        {r.pace == null
          ? 'Yıllık ciro hedefi girilmedi (Kullanıcı Yönetimi → Hedefleri Düzenle).'
          : r.pace === 'ok'
            ? `Zamanın ${(r.attainmentPct ?? 0) - r.yearElapsedPct} puan önünde — hedef temposu tutuyor.`
            : `Zamanın ${r.yearElapsedPct - (r.attainmentPct ?? 0)} puan gerisinde${r.pace === 'danger' ? ' — aksiyon gerekli' : ' — dikkat'}.`}
      </div>
    </div>
  );
}

function HotCard({ item, showOwner }: { item: HotItem; showOwner?: boolean }) {
  return (
    <div className={`lb-hot tone-${item.tone}`}>
      <div className="lb-hot-head">
        <div className="lb-hot-title">
          <strong>{item.musteri}</strong>
          {showOwner && item.owner ? <em>{item.owner}</em> : null}
        </div>
        <DuePill days={item.daysToTarget} date={item.targetDate} />
      </div>
      <div className="lb-hot-meta">
        <PhaseChip no={item.phaseNo} name={item.phaseName} />
        {item.models ? <span className="lb-hot-models">{item.models}</span> : item.quantity ? <span className="lb-hot-models">{fmt(item.quantity)} adet</span> : null}
      </div>
      <div className="lb-hot-money">
        {item.quoteAmount ? <span>Teklif <strong>{fmtMoney(item.quoteAmount)}</strong></span> : null}
        {item.potentialValue ? <span>Potansiyel <strong>≈{fmtMoney(item.potentialValue)}</strong></span> : null}
        {item.weightedValue ? <span>Ağırlıklı <strong>{fmtMoney(item.weightedValue)}</strong></span> : null}
        {!item.quoteAmount && !item.potentialValue ? <span className="lb-muted">Değer girilmedi</span> : null}
      </div>
      <div className="lb-hot-foot">
        <span className={`lb-ago tone-${staleTone(item.daysSinceActivity)}`}>Son hareket: {agoLabel(item.daysSinceActivity)}{item.lastActivityLabel ? ` · ${item.lastActivityLabel}` : ''}</span>
        {item.nextAction
          ? <span className="lb-next" title={`${item.nextAction}${item.actionOwner ? ` · ${item.actionOwner}` : ''}`}><b>Next:</b> {item.nextAction}{item.actionOwner && item.actionOwner !== item.owner ? ` · ${item.actionOwner}` : ''}{item.targetDate ? ` · ${fmtDate(item.targetDate)}` : ''}</span>
          : <span className="lb-next lb-muted">Next action girilmedi</span>}
      </div>
    </div>
  );
}

function ActivityList({ rows, todayKey, empty }: { rows: LiveActivity[]; todayKey: string; empty?: string }) {
  if (!rows.length) return <div className="lb-muted">{empty ?? 'Bu hafta henüz hareket yok.'}</div>;
  return (
    <div className="lb-list">
      {rows.map((row) => (
        <div className="lb-item" key={row.id}>
          <div className="lb-item-main">
            <div className="lb-item-title">
              {row.musteri}
              {row.phaseChange === 'up'
                ? <Pill tone="ok">Faz {row.phaseFrom} → {row.phaseTo} ↑</Pill>
                : row.phaseChange === 'down'
                  ? <Pill tone="warn">Faz {row.phaseFrom} → {row.phaseTo} ↓</Pill>
                  : row.phaseTo != null
                    ? <Pill tone="neutral">Faz {row.phaseTo} · değişmedi</Pill>
                    : null}
            </div>
            {row.note ? <div className="lb-item-sub">{row.note}</div> : null}
          </div>
          <div className="lb-item-side">
            <Pill tone={row.kind.startsWith('technical') ? 'info' : row.kind === 'other' ? 'neutral' : 'info'}>{row.label}</Pill>
            <small>{fmtWhen(row.at, todayKey)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Takım slaytları ------------------------------------------------------ */

function PulseSlide({ data, caps, page, compact }: { data: LiveBoardPayload; caps: Capacities; page: number; compact?: boolean }) {
  const { team, owners, range } = data;
  const leaderPages = Math.max(1, Math.ceil(owners.length / Math.max(1, caps.leader)));
  // Bölünmüş Pulse: ilk sayfa(lar) ciro + sıralama, son sayfa aktivite + dönüşüm.
  const showActivity = !caps.pulseSplit || page >= leaderPages;
  const showRevenue = !caps.pulseSplit || page < leaderPages;
  const shownOwners = pageSlice(owners, Math.min(page, leaderPages - 1), caps.leader);
  const r = team.revenue;
  const attainmentBig = r.attainmentPct == null ? fmtMoney(r.actualYtd) : `%${r.attainmentPct}`;
  return (
    <div className={`lb-slide lb-pulse ${caps.pulseSplit ? (showActivity ? 'part-activity' : 'part-revenue') : ''}`} key="pulse">
      {showRevenue ? (
      <div className="lb-card lb-revenue">
        <div className="lb-card-head"><h3>Ciro · {r.year}</h3><span>gerçekleşen = kazanılan teklifler · forecast = gerçekleşen + geçerli açık tekliflerin ağırlıklı değeri</span></div>
        <div className="lb-revenue-body">
          <Ring pct={r.attainmentPct} tone={r.pace ?? 'neutral'} big={attainmentBig} sub={r.target != null ? `${fmtMoney(r.actualYtd)} / ${fmtMoney(r.target)}` : 'hedef yok'} size={compact ? 150 : 178} stroke={compact ? 10 : 11} />
          <div className="lb-kpis four">
            <Kpi label="Yıllık Hedef" value={fmtMoney(r.target)} sub={r.deviceTarget ? `${fmt(r.deviceTarget)} cihaz` : 'Kullanıcı Yönetimi → Hedefler'} small />
            <Kpi label="Kalan Hedef" value={fmtMoney(r.remaining)} sub={r.deviceTarget ? `${fmt(r.deviceActualYtd)} / ${fmt(r.deviceTarget)} cihaz` : `${fmt(r.deviceActualYtd)} cihaz kazanıldı`} small />
            <Kpi label="Yıl Sonu Forecast" value={fmtMoney(r.forecast)} sub={r.forecastPct != null ? `hedefin %${r.forecastPct}'i` : 'weighted model'} tone={r.forecastPct == null ? 'neutral' : r.forecastPct >= 100 ? 'ok' : 'warn'} small />
            <Kpi label="Forecast Gap" value={r.forecastGap == null ? '—' : fmtMoney(r.forecastGap, { sign: true })} sub={r.forecastGap == null ? 'hedef yok' : r.forecastGap >= 0 ? 'hedefin üstünde' : 'hedefin altında'} tone={r.forecastGap == null ? 'neutral' : r.forecastGap >= 0 ? 'ok' : 'danger'} small />
            <Kpi label="Açık Pipeline" value={fmtMoney(r.pipeline)} sub={`${fmt(r.openQuotes)} teklif · ağırlıklı ${fmtMoney(r.weightedPipeline)}`} small />
            <Kpi label="Bu Ay Kazanılan" value={fmtMoney(r.wonMonth.amount)} sub={`${fmt(r.wonMonth.count)} sipariş · YTD ${fmt(r.wonYtd.count)}`} tone={r.wonMonth.count ? 'ok' : 'neutral'} small />
            <Kpi label="Kaybedilen · YTD" value={fmt(r.lostYtd.count)} sub={fmtMoney(r.lostYtd.amount)} small />
            <Kpi label="Süresi Dolan Teklif" value={fmt(r.expiredOpenQuotes)} sub="açık ama geçerliliği bitmiş" tone={r.expiredOpenQuotes ? 'warn' : 'neutral'} small />
          </div>
          <PaceCompare r={r} />
        </div>
      </div>
      ) : null}

      {showRevenue ? (
      <div className="lb-card lb-leader">
        <div className="lb-card-head"><h3>Kim hedefinde, kim geride?</h3><span>{team.ownerCount} kişi · {range.label}</span></div>
        {shownOwners.length ? (
          <div className="lb-board">
            {shownOwners.map((row) => {
              const rev = row.revenue;
              const hasRevenue = rev.target != null;
              const pct = hasRevenue ? rev.attainmentPct : row.achievementPct;
              const tone: Tone = hasRevenue ? (rev.pace ?? 'neutral') : pctTone(pct);
              return (
                <div className="lb-row rich" key={row.owner}>
                  <div className={`lb-rank r${row.rank}`}>{row.rank}</div>
                  <div className="lb-row-main">
                    <div className="lb-row-name">
                      <span>{row.owner}</span>
                      <em>{fmt(row.portfolio.total)} firma</em>
                    </div>
                    <div className="lb-bar"><span className={`tone-${tone}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
                    <div className="lb-row-facts">
                      {hasRevenue ? <span>Ciro <b>{fmtMoney(rev.actualYtd)} / {fmtMoney(rev.target)}</b></span> : null}
                      <span>Aktivite <b>{fmt(row.actual.totalActivities)}{row.target.totalActivities ? ` / ${fmt(row.target.totalActivities)}` : ''}</b></span>
                      <span>Forecast <b className={rev.forecastPct != null && rev.forecastPct < 100 ? 'tone-warn' : ''}>{rev.forecastPct != null ? `%${rev.forecastPct}` : fmtMoney(rev.forecast)}</b></span>
                      <span>Pipeline <b>{fmtMoney(rev.weightedPipeline)}</b></span>
                      <span>
                        Stale <b className={row.pipeline.staleCritical ? 'tone-danger' : ''}>{fmt(row.pipeline.stale)}</b>
                        {' · '}Gecikmiş <b className={row.pipeline.overdueActions ? 'tone-danger' : ''}>{fmt(row.pipeline.overdueActions)}</b>
                      </span>
                    </div>
                  </div>
                  <div className={`lb-row-num tone-${tone}`}>{pct == null ? '—' : `%${pct}`}<small>{hasRevenue ? 'ciro' : 'aktivite'}</small></div>
                </div>
              );
            })}
          </div>
        ) : <div className="lb-muted">Rotasyonda satıcı yok (account_manager rolü).</div>}
      </div>
      ) : null}

      {showActivity ? (
      <div className="lb-card">
        <div className="lb-card-head"><h3>Aktivite · Hafta</h3><span>{range.label}</span></div>
        <div className="lb-activity-wrap">
          <Ring pct={team.achievementPct} tone={pctTone(team.achievementPct)} big={team.achievementPct == null ? fmt(team.actual.totalActivities) : `%${team.achievementPct}`} sub={team.target.totalActivities ? `${fmt(team.actual.totalActivities)} / ${fmt(team.target.totalActivities)}` : 'hedef yok'} size={compact ? 124 : 148} />
          <div className="lb-channels compact">
            {WEEKLY_TARGET_LABELS.map(({ key, label }) => (
              <div className="lb-channel" key={key}>
                <div className="lb-channel-label">{label}</div>
                <Bar actual={team.actual[key]} target={team.target[key]} />
                <div className="lb-channel-num">{fmt(team.actual[key])}<small> / {team.target[key] ? fmt(team.target[key]) : '—'}</small></div>
              </div>
            ))}
            <div className="lb-channel total">
              <div className="lb-channel-label">Tekil firma</div>
              <div className="lb-channel-note">bugün <b>{fmt(team.todayActivities)}</b> aktivite</div>
              <div className="lb-channel-num">{fmt(team.actual.uniqueCustomers)}</div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {showActivity ? (
      <div className="lb-card">
        <div className="lb-card-head"><h3>Dönüşüm & Pipeline</h3><span>bu hafta · aktif süreç</span></div>
        <FunnelRow f={team.funnel} />
        <div className="lb-kpis four tight">
          <Kpi label="Aktif Fırsat" value={fmt(team.pipeline.activeCustomers)} sub="firma · Faz 4–14" small />
          <Kpi label="Potansiyel" value={fmt(team.pipeline.potentialDevices)} sub={team.pipeline.potentialValue ? `adet · ≈${fmtMoney(team.pipeline.potentialValue)} liste` : 'adet · forecast girilmedi'} small />
          <Kpi label="POC · Rollout" value={`${fmt(team.pipeline.poc)} · ${fmt(team.pipeline.rollout)}`} sub="aktif süreç" tone="info" small />
          <Kpi label="Stale · Gecikmiş" value={`${fmt(team.pipeline.stale)} · ${fmt(team.pipeline.overdueActions)}`} sub={`${LIVE_BOARD_RULES.staleWarnDays}+ gün hareketsiz · tarihi geçen`} tone={team.pipeline.overdueActions || team.pipeline.staleCritical ? 'danger' : team.pipeline.stale ? 'warn' : 'ok'} small />
          {team.jira ? <Kpi label="Jira · Açık Ticket" value={fmt(team.jira.open)} sub={`${fmt(team.jira.customerWaiting)} müşteri bekleyen · ${fmt(team.jira.created)} yeni · ${fmt(team.jira.closed)} kapanan`} tone={team.jira.open ? 'warn' : 'ok'} small /> : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}

// Sıralı (ordinal) mavi rampası — düşük faz → yüksek faz. Yüzeye en yakın adım
// 2:1'i aşar (açık: ≥ adım 250, koyu: ≥ adım 600); ileri fazlar daha belirgin.
const ORDINAL_LIGHT = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const ORDINAL_DARK = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'];

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function PortfolioSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const dark = useIsDark();
  const { portfolio } = data;
  const cap = caps.portfolioRows;
  // Faz halkası: ≤ 6 dilim — Fazsız gri, sıralı gruplar tek renk rampası (ordinal).
  const phaseRows = useMemo(() => {
    const merged: Distribution = [];
    for (const row of portfolio.byPhaseGroup) {
      if (['Sözleşme', 'Sipariş & Teslimat', 'Eğitim & Devir', 'Rollout / Referans'].includes(row.label)) {
        const tail = merged.find((r) => r.label === 'Sözleşme ve sonrası');
        if (tail) tail.value += row.value; else merged.push({ label: 'Sözleşme ve sonrası', value: row.value });
      } else merged.push({ ...row });
    }
    return merged;
  }, [portfolio.byPhaseGroup]);
  const ramp = dark ? ORDINAL_DARK : ORDINAL_LIGHT;
  let step = 0;
  const phaseColors = phaseRows.map((row) => (row.label === 'Fazsız' ? (dark ? '#475569' : '#cbd5e1') : ramp[Math.min(ramp.length - 1, step++)]));
  const kunyeColors = portfolio.kunye.map((row) => (row.tone === 'ok' ? 'var(--lb-ok)' : row.tone === 'warn' ? 'var(--lb-warn)' : dark ? '#475569' : '#cbd5e1'));
  const withPhase = phaseRows.filter((r) => r.label !== 'Fazsız').reduce((s, r) => s + r.value, 0);
  const kunyeDone = portfolio.kunye.find((r) => r.label === 'Tamam')?.value ?? 0;
  // Her kart kendi sayfa sayısına göre döner → kısa liste bitince kart boş kalmaz.
  const ownerPage = page % pageCount(portfolio.byOwner.length, cap);
  const sectorPage = page % pageCount(portfolio.bySector.length, cap);
  const ownerBounds = pageBounds(portfolio.byOwner.length, ownerPage, cap);
  const sectorBounds = pageBounds(portfolio.bySector.length, sectorPage, cap);
  return (
    <div className="lb-slide lb-portfolio" key="portfolio">
      <div className="lb-card">
        <div className="lb-card-head"><h3>Account Yapısı</h3><span>{fmt(portfolio.total)} firma · sorumlu başına{ownerBounds.paged ? ` · ${ownerBounds.from}–${ownerBounds.to} / ${portfolio.byOwner.length}` : ''}</span></div>
        <HBars rows={pageSlice(portfolio.byOwner, ownerPage, cap)} total={portfolio.total} maxRows={cap} />
      </div>
      <div className="lb-card">
        <div className="lb-card-head"><h3>Faz Dağılımı</h3><span>portföyün satış sürecindeki yeri</span></div>
        <Donut rows={phaseRows} shown={pageSlice(phaseRows, page % pageCount(phaseRows.length, cap), cap)} colors={phaseColors} center={`%${portfolio.total ? Math.round((withPhase / portfolio.total) * 100) : 0}`} centerLabel="fazı girilmiş" size={250} />
      </div>
      <div className="lb-card">
        <div className="lb-card-head"><h3>Sektör Dağılımı</h3><span>iş ortakları hariç{sectorBounds.paged ? ` · ${sectorBounds.from}–${sectorBounds.to} / ${portfolio.bySector.length}` : ''}</span></div>
        <HBars rows={pageSlice(portfolio.bySector, sectorPage, cap)} maxRows={cap} />
      </div>
      <div className="lb-card">
        <div className="lb-card-head"><h3>Künye Durumu</h3><span>veri kalitesi</span></div>
        <Donut rows={portfolio.kunye} colors={kunyeColors} center={`%${portfolio.total ? Math.round((kunyeDone / portfolio.total) * 100) : 0}`} centerLabel="künye tamam" size={250} />
      </div>
    </div>
  );
}

function HotSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const all = data.team.hot;
  const rows = pageSlice(all, page, caps.tableRows);
  const bounds = pageBounds(all.length, page, caps.tableRows);
  return (
    <div className="lb-slide lb-single" key="hot">
      <div className="lb-card lb-table-card">
        <div className="lb-card-head"><h3>Sonuçlanmaya yakın {all.length} fırsat{bounds.paged ? ` · ${bounds.from}–${bounds.to}` : ''}</h3><span>teklif → sözleşme fazı · açık engel · değeri olan kayıtlar · sıra: vade + değer</span></div>
        {rows.length ? (
          <div className="lb-table lb-hot-table">
            <div className="lb-tr lb-th"><span>Müşteri</span><span>Faz</span><span>Model / Adet</span><span>Değer</span><span>Son hareket</span><span>Next action</span><span>Hedef</span></div>
            {rows.map((item) => (
              <div className={`lb-tr tone-${item.tone}`} key={item.customerId}>
                <span className="lb-td-title"><strong>{item.musteri}</strong><em>{item.owner ?? '—'}</em></span>
                <span><PhaseChip no={item.phaseNo} name={item.phaseName} /></span>
                <span className="lb-td-models">{item.models || (item.quantity ? `${fmt(item.quantity)} adet` : '—')}</span>
                <span className="lb-td-money">
                  {item.quoteAmount
                    ? <b>Teklif {fmtMoney(item.quoteAmount)}</b>
                    : item.potentialValue ? <b>≈{fmtMoney(item.potentialValue)} liste</b> : <b className="lb-muted">değer yok</b>}
                  {item.weightedValue ? <small>ağırlıklı {fmtMoney(item.weightedValue)}</small> : item.quoteAmount && item.potentialValue ? <small>≈{fmtMoney(item.potentialValue)} liste</small> : null}
                </span>
                <span className={`lb-td-ago tone-${staleTone(item.daysSinceActivity)}`}>{agoLabel(item.daysSinceActivity)}{item.lastActivityLabel ? <small>{item.lastActivityLabel}</small> : null}</span>
                <span className="lb-td-next">{item.nextAction ?? <i className="lb-muted">girilmedi</i>}{item.actionOwner ? <small>{item.actionOwner}</small> : null}</span>
                <span className="lb-td-due"><DuePill days={item.daysToTarget} date={item.targetDate} /><small>{item.targetDate ? fmtDate(item.targetDate) : ''}</small></span>
              </div>
            ))}
          </div>
        ) : <div className="lb-muted">Kriterlere uyan fırsat yok.</div>}
      </div>
    </div>
  );
}

function PocSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const all = data.team.poc;
  const rows = pageSlice(all, page, caps.tableRows);
  const counts = { danger: all.filter((r) => r.tone === 'danger').length, warn: all.filter((r) => r.tone === 'warn').length };
  const pocBounds = pageBounds(all.length, page, caps.tableRows);
  return (
    <div className="lb-slide lb-single" key="poc">
      <div className="lb-card lb-table-card">
        <div className="lb-card-head">
          <h3>Konsinye · POC · Uçtan Uca Test · Rollout</h3>
          <span>{fmt(data.team.pipeline.poc)} POC · {fmt(data.team.pipeline.rollout)} rollout · {counts.danger} gecikmiş · {counts.warn} dikkat{pocBounds.paged ? ` · ${pocBounds.from}–${pocBounds.to} / ${all.length}` : ''}</span>
        </div>
        {rows.length ? (
          <div className="lb-table lb-poc-table">
            <div className="lb-tr lb-th"><span>Firma</span><span>Faz</span><span>Cihaz / Adet</span><span>Başlangıç</span><span>Son aktivite</span><span>Next action</span><span>Hedef · bekleme</span></div>
            {rows.map((item: PocItem) => (
              <div className={`lb-tr tone-${item.tone}`} key={item.customerId}>
                <span className="lb-td-title"><strong>{item.musteri}</strong><em>{item.owner ?? '—'}</em></span>
                <span><PhaseChip no={item.phaseNo} name={item.phaseName} /></span>
                <span className="lb-td-models">{item.models || (item.quantity ? `${fmt(item.quantity)} adet` : '—')}</span>
                <span>{fmtDate(item.startDate)}</span>
                <span className={`lb-td-ago tone-${staleTone(item.daysSinceActivity)}`}>{agoLabel(item.daysSinceActivity)}</span>
                <span className="lb-td-next">{item.nextAction ?? <i className="lb-muted">girilmedi</i>}{item.actionOwner ? <small>{item.actionOwner}</small> : null}</span>
                <span className="lb-td-due"><DuePill days={item.daysToTarget} date={item.targetDate} /><small>{item.targetDate ? fmtDate(item.targetDate) : 'hedef tarih yok'}{item.daysSinceActivity != null ? ` · ${item.daysSinceActivity} gün bekliyor` : ''}</small></span>
              </div>
            ))}
          </div>
        ) : <div className="lb-muted">Aktif POC / rollout süreci yok.</div>}
      </div>
    </div>
  );
}

function QuotesSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const dark = useIsDark();
  const { quotes, forecast, team } = data;
  const openRows = pageSlice(quotes.open, page, caps.openQuotes);
  const openBounds = pageBounds(quotes.open.length, page, caps.openQuotes);
  // Kapanan teklif listesi kısa: açık teklifler sayfalanırken bu kart boş
  // kalmasın diye sayfa numarası kendi sayfa sayısına göre döner (mod).
  const closedPages = pageCount(quotes.recentClosed.length, caps.closedQuotes);
  const closedPage = closedPages > 0 ? page % closedPages : 0;
  const closedRows = pageSlice(quotes.recentClosed, closedPage, caps.closedQuotes);
  const closedBounds = pageBounds(quotes.recentClosed.length, closedPage, caps.closedQuotes);
  const r = team.revenue;
  const maxMonth = Math.max(1, ...forecast.byMonth.map((m) => m.quantity));
  return (
    <div className="lb-slide lb-quotes" key="quotes">
      <div className="lb-kpis six">
        <Kpi label="Açık Teklif" value={fmt(r.openQuotes)} sub={`${fmtMoney(r.pipeline)} · ağırlıklı ${fmtMoney(r.weightedPipeline)}`} tone="info" />
        <Kpi label="Kazanılan · YTD" value={fmt(r.wonYtd.count)} sub={fmtMoney(r.wonYtd.amount)} tone="ok" />
        <Kpi label="Kaybedilen · YTD" value={fmt(r.lostYtd.count)} sub={fmtMoney(r.lostYtd.amount)} tone={r.lostYtd.count ? 'danger' : 'neutral'} />
        <Kpi label="Bu Hafta Teklif" value={fmt(team.quotes.weekCount)} sub={`${fmtMoney(team.quotes.weekAmount)} · ay ${fmt(team.quotes.monthCount)} / ${fmtMoney(team.quotes.monthAmount)}`} />
        <Kpi label="Süresi Dolan" value={fmt(r.expiredOpenQuotes)} sub="açık ama geçerliliği bitmiş" tone={r.expiredOpenQuotes ? 'warn' : 'neutral'} />
        <Kpi label={`Forecast ${forecast.year} · adet`} value={fmt(forecast.totalQuantity)} sub={`ağırlıklı ${fmt(forecast.weightedQuantity)} · CRM forecast modülü`} />
      </div>
      <div className="lb-card">
        <div className="lb-card-head">
          <h3>Açık Teklifler</h3>
          <span>tutara göre · {openBounds.paged ? `${openBounds.from}–${openBounds.to} / ${quotes.open.length}` : `${quotes.open.length} teklif`}</span>
        </div>
        {openRows.length ? (
          <div className="lb-table lb-quote-table">
            {openRows.map((q) => (
              <div className={`lb-tr ${q.expired ? 'tone-warn' : 'tone-info'}`} key={q.quoteNo}>
                <span className="lb-td-title"><strong>{q.musteri}</strong><em>{q.owner ?? '—'} · {q.quoteNo}</em></span>
                <span className="lb-td-money"><b>{fmtMoney(q.amount)}</b><small>{fmt(q.devices)} cihaz</small></span>
                <span><Pill tone={q.probability >= 60 ? 'ok' : q.probability >= 30 ? 'warn' : 'neutral'}>%{q.probability}</Pill></span>
                <span className="lb-td-due"><small>{q.expired ? `süresi doldu · ${fmtDate(q.date)}` : `geçerli · ${fmtDate(q.date)}`}</small></span>
              </div>
            ))}
          </div>
        ) : <div className="lb-muted">{quotes.open.length ? 'Bu sayfada teklif yok.' : 'Açık teklif yok.'}</div>}
      </div>
      <div className="lb-card lb-closed">
      <div className="lb-card-head">
        <h3>Son Kapananlar{closedBounds.paged ? ` ${closedPage + 1}/${closedPages}` : ''}</h3>
        <span>{quotes.lostReasons.length ? `kayıp nedenleri: ${quotes.lostReasons.map((x) => `${x.label} ${x.value}`).join(' · ')}` : 'kayıp yok'}</span>
      </div>
      {closedRows.length ? (
        <div className="lb-table lb-quote-table">
          {closedRows.map((q) => (
            <div className={`lb-tr ${q.status === 'won' ? 'tone-ok' : 'tone-danger'}`} key={q.quoteNo}>
              <span className="lb-td-title"><strong>{q.musteri}</strong><em>{q.owner ?? '—'} · {q.quoteNo}</em></span>
              <span className="lb-td-money"><b>{fmtMoney(q.amount)}</b><small>{fmt(q.devices)} cihaz</small></span>
              <span><Pill tone={q.status === 'won' ? 'ok' : 'danger'}>{q.status === 'won' ? 'Kazanıldı' : q.reason ?? 'Kaybedildi'}</Pill></span>
              <span className="lb-td-due"><small>{fmtDate(q.date)}</small></span>
            </div>
          ))}
        </div>
      ) : <div className="lb-muted">Bu yıl kapanan teklif yok.</div>}
      </div>
      <div className="lb-stack">
        <div className="lb-card">
          <div className="lb-card-head"><h3>Kişi Bazında</h3><span>açık · ağırlıklı · kazanılan · kaybedilen</span></div>
          {quotes.byOwner.length ? (
            <div className="lb-table lb-owner-quotes">
              <div className="lb-tr lb-th"><span>Satıcı</span><span>Açık</span><span>Ağırlıklı</span><span>Kazanılan</span><span>Kayıp</span></div>
              {quotes.byOwner.slice(0, 6).map((row) => (
                <div className="lb-tr" key={row.owner}>
                  <span className="lb-td-title"><strong>{row.owner}</strong></span>
                  <span>{fmt(row.open)}<small>{fmtMoney(row.openAmount)}</small></span>
                  <span>{fmtMoney(row.weighted)}</span>
                  <span className="tone-ok">{fmt(row.won)}<small>{fmtMoney(row.wonAmount)}</small></span>
                  <span className={row.lost ? 'tone-danger' : ''}>{fmt(row.lost)}</span>
                </div>
              ))}
            </div>
          ) : <div className="lb-muted">Teklif yok.</div>}
        </div>
        <div className="lb-card">
          <div className="lb-card-head"><h3>Forecast {forecast.year} · aylık adet</h3><span>açık = toplam · dolu = olasılık ağırlıklı</span></div>
          {forecast.byMonth.length ? (
            <div className="lb-months">
              {forecast.byMonth.map((m) => (
                <div className="lb-month" key={m.month} title={`${m.label}: ${fmt(m.quantity)} adet · ağırlıklı ${fmt(m.weighted)}`}>
                  <div className="lb-month-bar">
                    <span className="total" style={{ height: `${Math.round((m.quantity / maxMonth) * 100)}%`, background: dark ? '#184f95' : '#cde2fb' }} />
                    <span className="weighted" style={{ height: `${Math.round((m.weighted / maxMonth) * 100)}%`, background: dark ? '#6da7ec' : '#2a78d6' }} />
                  </div>
                  <strong>{fmt(m.quantity)}</strong>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          ) : <div className="lb-muted">Bu yıl için forecast girilmedi.</div>}
        </div>
      </div>
    </div>
  );
}

const ALERT_META: Record<AlertItem['kind'], { title: string; hint: string }> = {
  overdue: { title: 'Overdue Action', hint: 'tarihi geçmiş next action / takip' },
  stale: { title: 'Stale Opportunity', hint: `${LIVE_BOARD_RULES.staleWarnDays}–${LIVE_BOARD_RULES.staleDangerDays - 1} gün turuncu · ${LIVE_BOARD_RULES.staleDangerDays}+ gün kırmızı` },
  poc_delay: { title: 'POC Delay', hint: 'hedef tarihi geçen POC / test' },
  target_gap: { title: 'Target Gap', hint: 'forecast yıllık hedefin altında' },
  customer_waiting: { title: 'Customer Waiting', hint: 'top müşteride' },
  contract_waiting: { title: 'Contract Waiting', hint: 'sözleşme fazında bekleyen' },
  expired_quote: { title: 'Süresi Dolan Teklif', hint: 'kapatılmamış açık teklif' },
};

function AlertsSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const { alerts, alertCounts } = data.team;
  const panels = alertPanels(alerts, alertCounts, caps.alertItems, ALERT_ORDER);
  const shown = pageSlice(panels, page, caps.alertGroups);
  return (
    <div className="lb-slide lb-alerts" key="alerts">
      <div className="lb-alert-chips">
        {ALERT_ORDER.map((kind) => (
          <div className={`lb-alert-chip ${alertCounts[kind] ? (kind === 'overdue' || kind === 'poc_delay' ? 'tone-danger' : 'tone-warn') : 'tone-ok'}`} key={kind}>
            <strong>{fmt(alertCounts[kind])}</strong><span>{ALERT_META[kind].title}</span>
          </div>
        ))}
      </div>
      {shown.length ? (
        <div className="lb-alert-groups">
          {shown.map((panel) => (
            <div className="lb-card" key={`${panel.kind}-${panel.part}`}>
              <div className="lb-card-head">
                <h3>{ALERT_META[panel.kind].title} · {fmt(panel.total)}{panel.parts > 1 ? ` · ${panel.part + 1}/${panel.parts}` : ''}</h3>
                <span>{ALERT_META[panel.kind].hint}</span>
              </div>
              <div className="lb-list">
                {panel.rows.map((a, index) => (
                  <div className={`lb-item tone-${a.tone}`} key={`${a.kind}-${a.title}-${index}`}>
                    <div className="lb-item-main">
                      <div className="lb-item-title">{a.title}{a.owner && a.owner !== a.title ? <em> · {a.owner}</em> : null}</div>
                      <div className="lb-item-sub">{a.detail}</div>
                    </div>
                    {a.days != null ? <div className="lb-item-side"><Pill tone={a.tone}>{a.kind === 'overdue' || a.kind === 'poc_delay' ? `${a.days} gün gecikti` : a.kind === 'customer_waiting' ? `${a.days} gün önce` : `${a.days} gün hareketsiz`}</Pill></div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="lb-empty"><div><strong>Aksiyon gerektiren başlık yok</strong>Stale fırsat, gecikmiş aksiyon, POC gecikmesi ya da hedef açığı bulunmuyor.</div></div>
      )}
    </div>
  );
}

function JiraSlide({ data }: { data: LiveBoardPayload }) {
  const j = data.team.jira;
  if (!j) return <div className="lb-slide lb-single"><div className="lb-empty"><div><strong>Jira verisi yok</strong>Entegrasyon kapalı ya da yanıt vermedi.</div></div></div>;
  return (
    <div className="lb-slide lb-single" key="jira">
      <div className="lb-kpis five">
        <Kpi label="Toplam Açık" value={fmt(j.open)} tone={j.open ? 'warn' : 'ok'} sub="devam + geliştirme + müşteri bekleyen" />
        <Kpi label="Bu Hafta Açılan" value={fmt(j.created)} sub={data.range.label} />
        <Kpi label="Bu Hafta Kapanan" value={fmt(j.closed)} tone="ok" />
        <Kpi label="Müşteri Bekleyen" value={fmt(j.customerWaiting)} tone={j.customerWaiting ? 'warn' : 'ok'} />
        <Kpi label="Geliştirme Bekleyen" value={fmt(j.developmentWaiting)} tone={j.developmentWaiting ? 'warn' : 'ok'} />
      </div>
    </div>
  );
}

/* --- Kişi slaytı (Sales Performance) --------------------------------------- */

function OwnerSlide({ owner, todayKey, caps, page, compact }: { owner: LiveOwner; todayKey: string; caps: Capacities; page: number; compact: boolean }) {
  const r = owner.revenue;
  // Her liste kendi sayfa sayısına göre döner: kısa liste bitince kart boş
  // kalmaz, baştan gösterilir (uzun liste sayfalanmaya devam eder).
  const hotPages = pageCount(owner.hot.length, caps.hot);
  const recentPages = pageCount(owner.recentActivities.length, caps.recent);
  const hotPage = page % hotPages;
  const recentPage = page % recentPages;
  const hotRows = pageSlice(owner.hot, hotPage, caps.hot);
  const recentRows = pageSlice(owner.recentActivities, recentPage, caps.recent);
  const hotBounds = pageBounds(owner.hot.length, hotPage, caps.hot);
  const recentBounds = pageBounds(owner.recentActivities.length, recentPage, caps.recent);
  const hasRevenueTarget = r.target != null;
  const ringPct = hasRevenueTarget ? r.attainmentPct : owner.achievementPct;
  const ringTone: Tone = hasRevenueTarget ? (r.pace ?? 'neutral') : pctTone(owner.achievementPct);
  return (
    <div className="lb-slide lb-owner" key={owner.owner}>
      <MoneyBand r={r} pipeline={owner.pipeline} weekQuotes={owner.quotes.weekCount} />
      <div className="lb-profile">
        <div className="lb-avatar">
          {owner.initials}
          <span className={`lb-rank-badge r${owner.rank}`} aria-label={`Sıra ${owner.rank}`}>#{owner.rank}</span>
        </div>
        <div className="lb-name">{owner.owner}<small>{fmt(owner.portfolio.total)} firma · {fmt(owner.portfolio.active)} aktif (90 gün)</small></div>
        <div className="lb-ring-block">
          <span className="lb-ring-title">{hasRevenueTarget ? `Ciro · ${r.year}` : 'Aktivite · hafta'}</span>
          <Ring
            pct={ringPct}
            tone={ringTone}
            big={ringPct == null ? (hasRevenueTarget ? fmtMoney(r.actualYtd) : fmt(owner.actual.totalActivities)) : `%${ringPct}`}
            sub={hasRevenueTarget ? `${fmtMoney(r.actualYtd)} / ${fmtMoney(r.target)}` : owner.target.totalActivities ? `${fmt(owner.actual.totalActivities)} / ${fmt(owner.target.totalActivities)}` : 'hedef yok'}
            size={compact ? 126 : 156}
          />
          {!hasRevenueTarget
            ? <span className="lb-ring-note">Yıllık ciro hedefi girilmedi</span>
            : <span className={`lb-ring-note tone-${r.pace ?? 'neutral'}`}>{r.pace === 'ok' ? `zamanın ${(r.attainmentPct ?? 0) - r.yearElapsedPct} puan önünde` : `zamanın ${r.yearElapsedPct - (r.attainmentPct ?? 0)} puan gerisinde · ${TONE_WORD[r.pace ?? 'neutral']}`}</span>}
        </div>
        <div className="lb-mini two">
          <div className={`tone-${r.forecastPct == null ? 'neutral' : r.forecastPct >= 100 ? 'ok' : 'warn'}`}><strong>{fmtMoney(r.forecast)}</strong><span>Forecast{r.forecastPct != null ? ` · %${r.forecastPct}` : ''}</span></div>
          <div className={`tone-${r.forecastGap == null ? 'neutral' : r.forecastGap >= 0 ? 'ok' : 'danger'}`}><strong>{r.forecastGap == null ? '—' : fmtMoney(r.forecastGap, { sign: true })}</strong><span>Gap</span></div>
        </div>
        <div className="lb-mini">
          <div><strong>{fmt(owner.actual.totalActivities)}<small> / {owner.target.totalActivities ? fmt(owner.target.totalActivities) : '—'}</small></strong><span>Aktivite</span></div>
          <div><strong>{fmt(owner.actual.salesPhysical)}<small> / {owner.target.salesPhysical ? fmt(owner.target.salesPhysical) : '—'}</small></strong><span>Fiziki</span></div>
          <div><strong>{fmt(owner.actual.uniqueCustomers)}</strong><span>Tekil Firma</span></div>
          <div className="tone-info"><strong>{fmt(owner.pipeline.poc)}</strong><span>Aktif POC</span></div>
          <div><strong>{fmt(owner.quotes.weekCount)}</strong><span>Teklif · hafta</span></div>
          <div className={owner.revenue.wonYtd.count ? 'tone-ok' : ''}><strong>{fmt(owner.revenue.wonYtd.count)}</strong><span>Sipariş · YTD</span></div>
        </div>
        <div className="lb-mini-title">Pipeline & Uyarı</div>
        <div className="lb-mini">
          <div><strong>{fmt(owner.pipeline.activeCustomers)}</strong><span>Aktif Fırsat</span></div>
          <div className={owner.pipeline.staleCritical ? 'tone-danger' : owner.pipeline.stale ? 'tone-warn' : ''}><strong>{fmt(owner.pipeline.stale)}</strong><span>Stale</span></div>
          <div className={owner.pipeline.overdueActions ? 'tone-danger' : ''}><strong>{fmt(owner.pipeline.overdueActions)}</strong><span>Gecikmiş</span></div>
          {owner.jira ? <div className={owner.jira.open ? 'tone-warn' : ''}><strong>{fmt(owner.jira.open)}</strong><span>Jira Ticket</span></div> : null}
        </div>
      </div>

      <div className="lb-center">
        <div className="lb-card">
          <div className="lb-card-head"><h3>Kanal Kırılımı</h3><span>gerçekleşen / hedef · {owner.todayActivities ? `bugün ${owner.todayActivities}` : 'bugün 0'}</span></div>
          <div className="lb-channels">
            {WEEKLY_TARGET_LABELS.map(({ key, label }) => (
              <div className="lb-channel" key={key}>
                <div className="lb-channel-label">{label}</div>
                <Bar actual={owner.actual[key]} target={owner.target[key]} />
                <div className="lb-channel-num">{fmt(owner.actual[key])}<small> / {owner.target[key] ? fmt(owner.target[key]) : '—'}</small></div>
              </div>
            ))}
          </div>
          <FunnelRow f={owner.funnel} />
        </div>
        <div className="lb-card lb-grow">
          <div className="lb-card-head">
            <h3>Son Hareketler</h3>
            <span>bu hafta · faz etkisiyle{recentBounds.paged ? ` · ${recentBounds.from}–${recentBounds.to} / ${owner.recentActivities.length}` : ''}</span>
          </div>
          <ActivityList rows={recentRows} todayKey={todayKey} />
        </div>
      </div>

      <div className="lb-card lb-hot-col">
        <div className="lb-card-head">
          <h3>Hot Pipeline</h3>
          <span>{owner.hot.length ? (hotBounds.paged ? `${hotBounds.from}–${hotBounds.to} / ${owner.hot.length}` : `${owner.hot.length} fırsat`) : ''}</span>
        </div>
        {hotRows.length
          ? hotRows.map((item) => <HotCard item={item} key={item.customerId} />)
          : <div className="lb-muted">Sonuçlanmaya yakın fırsat yok — teklif / forecast / engel kaydı girilince burada görünür.</div>}
      </div>
    </div>
  );
}

/* --- Pano ---------------------------------------------------------------- */

export default function LiveBoard({ active }: { active: boolean }) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<LiveBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<LiveBoardSpeed>('normal');
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hideTimer = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Gövdenin gerçek iç ölçüsü (padding düşülmüş). Kapasite hesabı buradan çıkar.
  const [box, setBox] = useState({ h: 0, w: 0 });

  // Ölçüm: pencere/tam ekran/zoom değişince yeniden. Ölçüm bitene kadar (h=0)
  // kapasiteler varsayılan 1920×1080 değerleriyle hesaplanır.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const style = getComputedStyle(node);
      const padY = parseFloat(style.paddingTop || '0') + parseFloat(style.paddingBottom || '0');
      const padX = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
      const h = Math.round(node.clientHeight - padY);
      const w = Math.round(node.clientWidth - padX);
      setBox((prev) => (Math.abs(prev.h - h) < 4 && Math.abs(prev.w - w) < 4 ? prev : { h, w }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const metrics = useMemo(() => layoutMetrics(box.h), [box.h]);
  const caps = useMemo(() => capacities(box.h, box.w || 1920), [box.h, box.w]);
  const pagePlan = useMemo(() => (data ? buildPagePlan(data, caps) : undefined), [data, caps]);

  const ownerCount = data?.owners.length ?? 0;
  const jiraOn = data?.status.jira === 'ok';
  const plan = useMemo<LiveSlide[]>(() => slidePlan(ownerCount, { jira: jiraOn, pages: pagePlan }), [ownerCount, jiraOn, pagePlan]);
  const current = plan[Math.min(index, plan.length - 1)] ?? { type: 'team' as const, key: 'pulse' as const, page: 0, pages: 1 };
  const durationMs = slideDurationMs(current, speed);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/live-board', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Canlı ekran verisi alınamadı.');
      setData(json as LiveBoardPayload);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Canlı ekran verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setSpeed(readSpeed()); }, []);
  const changeSpeed = (value: LiveBoardSpeed) => {
    setSpeed(value);
    try { localStorage.setItem(SPEED_KEY, value); } catch {}
    setCycle((value) => value + 1);
  };

  useEffect(() => {
    if (!active) return;
    void load();
    const timer = window.setInterval(() => void load(), LIVE_BOARD_TIMING.refreshMs);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, load]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const goTo = useCallback((next: number) => {
    const total = Math.max(1, plan.length);
    setIndex(((next % total) + total) % total);
    setCycle((value) => value + 1);
  }, [plan.length]);
  const step = useCallback((delta: number) => {
    setIndex((value) => {
      const total = Math.max(1, plan.length);
      return ((value + delta) % total + total) % total;
    });
    setCycle((value) => value + 1);
  }, [plan.length]);

  // Zamanlayıcı yalnız slayt/hız/duraklatma değişince yeniden kurulur; 5 dakikalık
  // veri yenilemesi akan slaytı ve ilerleme çubuğunu bozmaz.
  const hasData = Boolean(data);
  useEffect(() => {
    if (!active || paused || !hasData) return;
    const timer = window.setTimeout(() => step(1), durationMs);
    return () => window.clearTimeout(timer);
  }, [active, paused, hasData, index, cycle, durationMs, step]);

  useEffect(() => {
    if (index >= plan.length) setIndex(0);
  }, [plan.length, index]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === boardRef.current));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const node = boardRef.current;
    if (!node) return;
    if (document.fullscreenElement) { void document.exitFullscreen?.(); return; }
    void node.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;
    const request = async () => {
      try {
        const api = (navigator as any).wakeLock;
        if (!api?.request) return;
        wakeLock.current = await api.request('screen');
      } catch {}
    };
    void request();
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { wakeLock.current?.release?.(); } catch {}
      wakeLock.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value); }
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'f' || event.key === 'F') toggleFullscreen();
      else if (event.key === 'r' || event.key === 'R') void load();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, toggleFullscreen, load]);

  const poke = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);
  const controlsHidden = fullscreen && !controlsVisible && !paused;

  const pageSuffix = current.pages > 1 ? ` ${current.page + 1}/${current.pages}` : '';
  const title = current.type === 'team'
    ? { main: TEAM_SLIDE_TITLES[current.key].title + pageSuffix, sub: TEAM_SLIDE_TITLES[current.key].sub }
    : {
        main: (data?.owners[current.index]?.owner ?? '') + pageSuffix,
        sub: `Sales Performance · sıra #${data?.owners[current.index]?.rank ?? ''} · ${data?.range.label ?? ''}`,
      };

  // Şerit için ekran listesi (sayfalar tek girdide toplanır).
  const screenNav = useMemo(() => {
    const seen = new Map<string, { key: string; label: string; short: string; team: boolean; pages: number; firstIndex: number; active: boolean }>();
    plan.forEach((slide, slideIndex) => {
      const key = slide.type === 'team' ? `t:${slide.key}` : `o:${slide.index}`;
      const existing = seen.get(key);
      const isCurrent = slide.type === current.type
        && (slide.type === 'team' ? slide.key === (current as any).key : slide.index === (current as any).index);
      if (existing) {
        existing.active = existing.active || isCurrent;
        return;
      }
      const base = slide.type === 'team'
        ? { label: TEAM_SLIDE_TITLES[slide.key].title, short: SHORT_LABELS[slide.key] ?? slide.key }
        : { label: data?.owners[slide.index]?.owner ?? '', short: data?.owners[slide.index]?.initials ?? '' };
      seen.set(key, { key, ...base, team: slide.type === 'team', pages: slide.pages, firstIndex: slideIndex, active: isCurrent });
    });
    return Array.from(seen.values());
  }, [plan, current, data]);

  const renderSlide = () => {
    if (!data) return null;
    const page = current.page;
    if (current.type === 'owner') {
      const owner = data.owners[current.index];
      return owner
        ? <OwnerSlide owner={owner} todayKey={data.range.today} caps={caps} page={page} compact={metrics.compact} />
        : <PulseSlide data={data} caps={caps} page={0} compact={metrics.compact} />;
    }
    switch (current.key) {
      case 'pulse': return <PulseSlide data={data} caps={caps} page={page} compact={metrics.compact} />;
      case 'portfolio': return <PortfolioSlide data={data} caps={caps} page={page} />;
      case 'hot': return <HotSlide data={data} caps={caps} page={page} />;
      case 'poc': return <PocSlide data={data} caps={caps} page={page} />;
      case 'quotes': return <QuotesSlide data={data} caps={caps} page={page} />;
      case 'alerts': return <AlertsSlide data={data} caps={caps} page={page} />;
      case 'jira': return <JiraSlide data={data} />;
      default: return <PulseSlide data={data} caps={caps} page={0} compact={metrics.compact} />;
    }
  };

  return (
    <section
      ref={boardRef}
      className="lb"
      data-compact={metrics.compact ? '1' : '0'}
      style={{
        // Kapasite hesabıyla CSS aynı sayıları kullanır: satır yükseklikleri buradan.
        '--lb-hot-h': `${metrics.hotH}px`,
        '--lb-act-h': `${metrics.actH}px`,
        '--lb-leader-h': `${metrics.leaderH}px`,
        '--lb-row-h': `${metrics.rowH}px`,
        '--lb-quote-row-h': `${metrics.quoteRowH}px`,
        '--lb-owner-quote-row-h': `${metrics.ownerQuoteRowH}px`,
        '--lb-alert-h': `${metrics.alertH}px`,
        '--lb-band-h': `${metrics.bandH}px`,
        '--lb-channels-h': `${metrics.channelsH}px`,
        '--lb-chips-h': `${metrics.chipsH}px`,
        '--lb-kpi-row-h': `${metrics.kpiRowH}px`,
        '--lb-gap': `${metrics.gap}px`,
        '--lb-list-gap': `${metrics.listGap}px`,
      } as CSSProperties}
      onMouseMove={poke}
      onClick={poke}
      aria-label="PAX Retail Command Center canlı ekran"
      aria-live="polite"
    >
      <div className="lb-top">
        <div className="lb-brand">
          <span className="lb-eyebrow">PAX Retail Command Center</span>
          <span className="lb-range">{data ? `Hafta: ${data.range.label}` : 'Yükleniyor…'}</span>
          <span className="lb-status">
            <i className={`lb-dot-status ${error ? 'bad' : 'good'}`} />CRM {updatedAt ? fmtClock(updatedAt) : '—'}
            {data ? <><i className={`lb-dot-status ${data.status.jira === 'ok' ? 'good' : data.status.jira === 'error' ? 'bad' : 'off'}`} />Jira {data.status.jira === 'ok' ? 'bağlı' : data.status.jira === 'error' ? 'hata' : 'kapalı'}</> : null}
          </span>
        </div>
        <div className="lb-title">{title.main}<small>{title.sub}</small></div>
        <div className="lb-meta">
          <div className={`lb-controls ${controlsHidden ? 'hidden' : ''}`}>
            <button type="button" className="lb-ctl" onClick={() => step(-1)} aria-label="Önceki slayt" title="Önceki (←)">‹</button>
            <button type="button" className={`lb-ctl ${paused ? 'on' : ''}`} onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Devam et' : 'Duraklat'} title="Duraklat / devam (Boşluk)">
              {paused ? '▶ Devam' : '❚❚'}
            </button>
            <button type="button" className="lb-ctl" onClick={() => step(1)} aria-label="Sonraki slayt" title="Sonraki (→)">›</button>
            <select className="lb-speed" value={speed} onChange={(event) => changeSpeed(event.target.value as LiveBoardSpeed)} aria-label="Slayt hızı" title="Slayt hızı">
              {(Object.keys(LIVE_BOARD_SPEEDS) as LiveBoardSpeed[]).map((key) => (
                <option key={key} value={key}>{LIVE_BOARD_SPEEDS[key].label}</option>
              ))}
            </select>
            <button type="button" className="lb-ctl" onClick={() => void load()} aria-label="Veriyi yenile" title="Yenile (R)">↻</button>
            <button type="button" className={`lb-ctl ${fullscreen ? 'on' : ''}`} onClick={toggleFullscreen} aria-label="Tam ekran" title="Tam ekran (F)">
              {fullscreen ? 'Çık' : '⛶ TV modu'}
            </button>
          </div>
          <div className="lb-clock">
            {fmtClock(now)}
            <small>{updatedAt ? `Güncellendi ${fmtClock(updatedAt)}` : ''}</small>
          </div>
        </div>
      </div>

      <div className={`lb-progress ${paused ? 'paused' : ''}`} aria-hidden="true">
        <i key={`${index}-${cycle}-${speed}`} style={{ animationDuration: `${durationMs}ms` }} />
      </div>

      <div className="lb-body" ref={bodyRef}>
        {loading && !data ? (
          <div className="lb-empty"><div><strong>Command Center hazırlanıyor…</strong>Ciro, hedefler, pipeline ve haftanın aktiviteleri yükleniyor.</div></div>
        ) : error && !data ? (
          <div className="lb-empty"><div><strong>Veri alınamadı</strong>{error}</div></div>
        ) : renderSlide()}
      </div>

      {data ? (
        <div className={`lb-strip ${controlsHidden ? 'lb-controls hidden' : ''}`}>
          {/* Ekran başına tek nokta: sayfalar (Seda 1/2, 2/2) tek girdide toplanır,
              tıklayınca o ekranın ilk sayfasına gider. Sayfalı ekranlarda oranı ⅟ ile
              gösterilir; böylece 30+ slaytta şerit taşmaz. */}
          {screenNav.map((screen) => (
            <button
              type="button"
              key={screen.key}
              className={`lb-dot ${screen.team ? 'team' : ''} ${screen.active ? 'active' : ''}`}
              onClick={() => goTo(screen.firstIndex)}
              title={`${screen.label}${screen.pages > 1 ? ` · ${screen.pages} sayfa` : ''}`}
              aria-label={screen.label}
            >
              {screen.short}{screen.pages > 1 ? <i>{screen.active ? `${current.page + 1}/${screen.pages}` : screen.pages}</i> : null}
            </button>
          ))}
          <span className="lb-strip-note">
            <b>{index + 1}/{plan.length}</b>
            <span className="lb-kbd">Boşluk</span> duraklat · <span className="lb-kbd">←</span><span className="lb-kbd">→</span> gezin · <span className="lb-kbd">F</span> TV modu
            {error ? ` · yenileme başarısız` : ''}
          </span>
        </div>
      ) : null}
    </section>
  );
}
