'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import '@/styles/live-board.css';
import { SALES_CHANNEL_GROUPS, WEEKLY_TARGET_LABELS, achievementPct, sumKinds, type WeeklyTargetCounters } from '@/lib/reports/weekly-targets-shared';
import type { GoalPair } from '@/lib/reports/targets-shared';
import {
  ALERT_ORDER,
  LIVE_BOARD_RULES,
  LIVE_BOARD_SPEEDS,
  LIVE_BOARD_TIMING,
  PHASE_GROUPS,
  TEAM_SLIDE_TITLES,
  agoLabel,
  alertPanels,
  buildPagePlan,
  capacities,
  dueLabel,
  conversionTone,
  dueTone,
  fmtMoney,
  layoutMetrics,
  msUntilIstanbulTime,
  paceTone,
  pageBounds,
  pctOf,
  pageCount,
  pageSlice,
  slideDurationMs,
  slidePlan,
  staleTone,
  type AlertItem,
  type Capacities,
  type CountAmount,
  type Distribution,
  type Funnel,
  type LiveActivity,
  type LiveBoardPayload,
  type LiveBoardSpeed,
  type LiveOwner,
  type OwnerDevices,
  type CustomerListSplit,
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
/** Aktivite günü: bugünse saatiyle, değilse gün adıyla; geç girişte kayıt saati gösterilmez. */
function fmtActivityDay(dayKey: string, iso: string, todayKey: string) {
  if (!dayKey) return fmtWhen(iso, todayKey);
  const recordedDay = new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  if (dayKey === recordedDay) return fmtWhen(iso, todayKey);
  const date = new Date(`${dayKey}T12:00:00Z`);
  if (dayKey === todayKey) return 'Bugün';
  return date.toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
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
              <span>{row.label}{row.hint ? <small>{row.hint}</small> : null}</span>
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
          <span className="lb-hbar-label" title={row.hint ? `${row.label} · ${row.hint}` : row.label}>{row.label}</span>
          {row.split != null ? (
            // İki parçalı bar: ana kısım (hunter) + açık ton (farmer); toplam = value.
            <div className="lb-bar lb-bar-split" title={row.hint ?? undefined}>
              <span className={`tone-${row.tone ?? 'info'}`} style={{ width: `${Math.max(row.value - row.split > 0 ? 2 : 0, Math.round(((row.value - row.split) / max) * 100))}%` }} />
              <span className="tone-split" style={{ width: `${Math.max(row.split > 0 ? 2 : 0, Math.round((row.split / max) * 100))}%` }} />
            </div>
          ) : (
            <div className="lb-bar"><span className={`tone-${row.tone ?? 'info'}`} style={{ width: `${Math.max(2, Math.round((row.value / max) * 100))}%` }} /></div>
          )}
          <strong>{fmt(row.value)}</strong>
          <em>{base ? `%${Math.round((row.value / base) * 100)}` : ''}</em>
        </div>
      ))}
    </div>
  );
}

/**
 * Kanal grupları: Görüşme (fiziki + online) / Temas (telefon + e-posta) / Toplam.
 * Her satırda gerçekleşen / hedef; küçük yazıda kanal kırılımı. Teknik kanallar yok.
 */
function ChannelGroups({ actual, target, compactRows }: { actual: WeeklyTargetCounters; target: WeeklyTargetCounters; compactRows?: boolean }) {
  const labelOf = (kind: keyof WeeklyTargetCounters) => WEEKLY_TARGET_LABELS.find((row) => row.key === kind)?.label.replace(/^Satış\s+/, '') ?? kind;
  return (
    <>
      {SALES_CHANNEL_GROUPS.map((group) => {
        const done = sumKinds(actual, group.kinds);
        const goal = sumKinds(target, group.kinds);
        const parts = group.kinds.map((kind) => `${fmt(actual[kind])} ${labelOf(kind).toLocaleLowerCase('tr')}`).join(' · ');
        return (
          <div className="lb-channel" key={group.key}>
            <div className="lb-channel-label" title={`${group.label} · ${group.sub}`}>{group.label}{compactRows ? null : <small>{parts}</small>}</div>
            <Bar actual={done} target={goal} />
            <div className="lb-channel-num">{fmt(done)}<small> / {goal ? fmt(goal) : '—'}</small></div>
          </div>
        );
      })}
      <div className="lb-channel sum">
        <div className="lb-channel-label" title="Toplam aktivite">Toplam</div>
        <Bar actual={actual.totalActivities} target={target.totalActivities} />
        <div className="lb-channel-num">{fmt(actual.totalActivities)}<small> / {target.totalActivities ? fmt(target.totalActivities) : '—'}</small></div>
      </div>
    </>
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

/**
 * TİCARİ SONUÇ bandı (kişi slaydı) — Sinan'ın 11.09 KPI listesindeki ilk blok:
 * yıllık ciro hedefi · YTD ciro · forecast · gap · kesilen fatura · dönüşüm.
 * Pipeline hücresi KALKTI (Çağdaş Bey, 11.09: "Pipeline diye bir şey yok").
 * Cihaz ve entegrasyon kendi kartlarına taşındı — aynı sayı iki yerde tekrar etmez.
 */
function CommercialBand({ r, invoices }: { r: RevenueBlock; invoices: number }) {
  const items: Array<{ k: string; v: string; tone?: Tone }> = [
    { k: `Yıllık Ciro Hedefi · ${r.year}`, v: fmtMoney(r.target) },
    { k: 'YTD Ciro', v: fmtMoney(r.actualYtd), tone: r.pace ?? 'neutral' },
    { k: 'Forecast · yıl sonu', v: fmtMoney(r.forecast) },
    { k: 'Gap', v: r.forecastGap == null ? '—' : fmtMoney(r.forecastGap, { sign: true }), tone: r.forecastGap == null ? 'neutral' : r.forecastGap >= 0 ? 'ok' : 'danger' },
    { k: 'Kesilen Fatura', v: fmt(invoices), tone: invoices ? 'ok' : 'neutral' },
    { k: 'Dönüşüm', v: r.conversionPct == null ? '—' : `%${r.conversionPct}`, tone: conversionTone(r.conversionPct) },
  ];
  return (
    <div className="lb-band no-hints" aria-label="Ticari sonuç" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div className={`lb-band-item tone-${item.tone ?? 'neutral'}`} key={item.k}>
          <span>{item.k}</span>
          <strong>{item.v}</strong>
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

/* --- Takım slaytları ------------------------------------------------------ */

function PulseSlide({ data, caps, page, compact }: { data: LiveBoardPayload; caps: Capacities; page: number; compact?: boolean }) {
  const { team, range } = data;
  // "Kim hedefinde, kim geride?" performans sırasına göre (payload dönüş sırası sabit OWNER_ORDER'dır).
  const owners = useMemo(() => [...data.owners].sort((a, b) => a.rank - b.rank), [data.owners]);
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
        <div className="lb-card-head"><h3>Ciro · {r.year}</h3><span>gerçekleşen = satışa dönen teklifler (satış kayıtları) · forecast = gerçekleşen + geçerli açık tekliflerin ağırlıklı değeri</span></div>
        <div className="lb-revenue-body">
          <Ring pct={r.attainmentPct} tone={r.pace ?? 'neutral'} big={attainmentBig} sub={r.target != null ? `${fmtMoney(r.actualYtd)} / ${fmtMoney(r.target)}` : 'hedef yok'} size={compact ? 150 : 178} stroke={compact ? 10 : 11} />
          <div className="lb-kpis three">
            <Kpi label="Yıllık Hedef" value={fmtMoney(r.target)} small />
            <Kpi label="Kalan Hedef" value={fmtMoney(r.remaining)} small />
            <Kpi label="Yıl Sonu Forecast" value={fmtMoney(r.forecast)} tone={r.forecastPct == null ? 'neutral' : r.forecastPct >= 100 ? 'ok' : 'warn'} small />
            <Kpi label="Forecast Gap" value={r.forecastGap == null ? '—' : fmtMoney(r.forecastGap, { sign: true })} tone={r.forecastGap == null ? 'neutral' : r.forecastGap >= 0 ? 'ok' : 'danger'} small />
            <Kpi label="Açık Pipeline" value={fmtMoney(r.pipeline)} small />
            <Kpi label="Bu Ay Satış" value={fmtMoney(r.saleMonth.amount)} tone={r.saleMonth.count ? 'ok' : 'neutral'} small />
            <Kpi label="Cihaz · YTD" value={fmt(r.deviceActualYtd)} tone={r.deviceTarget ? ((pctOf(r.deviceActualYtd, r.deviceTarget) ?? 0) >= r.yearElapsedPct ? 'ok' : 'warn') : 'neutral'} small />
            <Kpi label="Entegrasyon · YTD" value={fmt(r.integrationDone)} tone={r.integrationTarget ? ((pctOf(r.integrationDone, r.integrationTarget) ?? 0) >= r.yearElapsedPct ? 'ok' : 'warn') : 'neutral'} small />
            <Kpi label="Teklif → Satış" value={r.conversionPct == null ? '—' : `%${r.conversionPct}`} tone={conversionTone(r.conversionPct)} small />
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
                      <span title="Kapanan tekliflerin kaçı satışa döndü">Dönüşüm <b className={`tone-${conversionTone(rev.conversionPct)}`}>{rev.conversionPct == null ? '—' : `%${rev.conversionPct}`}</b></span>
                      <span title="Hareketsiz fırsat · Geciken aksiyon">
                        Hareketsiz <b className={row.pipeline.staleCritical ? 'tone-danger' : ''}>{fmt(row.pipeline.stale)}</b>
                        {' · '}Geciken <b className={row.pipeline.overdueActions ? 'tone-danger' : ''}>{fmt(row.pipeline.overdueActions)}</b>
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
            <ChannelGroups actual={team.actual} target={team.target} compactRows />
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
        <div className="lb-card-head">
          <h3>Dönüşüm & Pipeline</h3>
          <span>
            bu hafta · aktif süreç
            {team.jira ? <> · <Pill tone={team.jira.open ? 'warn' : 'ok'} title={`${fmt(team.jira.customerWaiting)} müşteri bekleyen · ${fmt(team.jira.created)} yeni · ${fmt(team.jira.closed)} kapanan`}>Jira {fmt(team.jira.open)} açık</Pill></> : null}
          </span>
        </div>
        <FunnelRow f={team.funnel} />
        <div className="lb-kpis four tight">
          <Kpi label="Aktif Fırsat" value={fmt(team.pipeline.activeCustomers)} small />
          <Kpi label="Potansiyel" value={fmt(team.pipeline.potentialDevices)} small />
          <Kpi label="POC · Rollout" value={`${fmt(team.pipeline.poc)} · ${fmt(team.pipeline.rollout)}`} tone="info" small />
          <Kpi label="Hareketsiz · Geciken" value={`${fmt(team.pipeline.stale)} · ${fmt(team.pipeline.overdueActions)}`} tone={team.pipeline.overdueActions || team.pipeline.staleCritical ? 'danger' : team.pipeline.stale ? 'warn' : 'ok'} small />
        </div>
      </div>
      ) : null}
    </div>
  );
}

// Sıralı (ordinal) mavi rampası — düşük faz → yüksek faz. Yüzeye en yakın adım
// 2:1'i aşar (açık: ≥ adım 250, koyu: ≥ adım 600); ileri fazlar daha belirgin.
// Sıralı (ordinal) mavi rampa: faz grupları soldan sağa ilerledikçe koyulaşır (8 adım).
const ORDINAL_LIGHT = ['#a9cbf4', '#86b6ef', '#639fe9', '#4288e1', '#2a72d4', '#1e5db5', '#164a94', '#0f3873'];
const ORDINAL_DARK = ['#163f78', '#1c519b', '#2664ba', '#3579d3', '#4d90e6', '#6da7ec', '#8fbdf1', '#b3d2f6'];

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
  // Faz halkası: her faz grubu ayrı dilim (Çağdaş Bey, 04.09: "Sözleşme ve sonrası"
  // anlaşılmıyordu) — Fazsız gri, sıralı gruplar tek renk rampası (ordinal).
  // Açıklama satırları sayfalanır, hiçbir grup gizlenmez.
  const phaseRows = useMemo<Distribution>(() => portfolio.byPhaseGroup.map((row) => {
    const group = PHASE_GROUPS.find((g) => g.label === row.label);
    const hint = group?.from != null ? (group.from === group.to ? `faz ${group.from}` : `faz ${group.from}–${group.to}`) : 'faz girilmemiş';
    return { ...row, hint };
  }), [portfolio.byPhaseGroup]);
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
  const hunterTotal = portfolio.hunterFarmer?.find((r) => r.label === 'Hunter')?.value ?? 0;
  const farmerTotal = portfolio.hunterFarmer?.find((r) => r.label === 'Farmer')?.value ?? 0;
  const sectorBounds = pageBounds(portfolio.bySector.length, sectorPage, cap);
  return (
    <div className="lb-slide lb-portfolio" key="portfolio">
      <div className="lb-card">
        <div className="lb-card-head">
          <h3>Account Yapısı</h3>
          <span>
            {fmt(portfolio.total)} firma · <b title="Künye satıcı etiketi (boş = Hunter)">{fmt(hunterTotal)} hunter · {fmt(farmerTotal)} farmer</b>
            {ownerBounds.paged ? ` · ${ownerBounds.from}–${ownerBounds.to} / ${portfolio.byOwner.length}` : ''}
          </span>
        </div>
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
  const conv = quotes.conversion;
  const maxMonth = Math.max(1, ...forecast.byMonth.map((m) => m.quantity));
  return (
    <div className="lb-slide lb-quotes" key="quotes">
      <div className="lb-kpis six">
        <Kpi label="Açık Teklif" value={fmt(r.openQuotes)} sub={`${fmtMoney(r.pipeline)} · ${fmt(r.expiredOpenQuotes)} süresi dolmuş`} tone={r.expiredOpenQuotes ? 'warn' : 'info'} />
        <Kpi label="Satışa Dönen · YTD" value={fmt(r.saleYtd.count)} sub={`${fmtMoney(r.saleYtd.amount)} · ${fmt(r.saleYtd.devices)} cihaz`} tone="ok" />
        <Kpi label="Teklif → Satış" value={conv.pct == null ? '—' : `%${conv.pct}`} tone={conversionTone(conv.pct)} />
        <Kpi label="Kaybedilen · YTD" value={fmt(r.lostYtd.count)} sub={fmtMoney(r.lostYtd.amount)} tone={r.lostYtd.count ? 'danger' : 'neutral'} />
        <Kpi label="Bu Hafta Teklif" value={fmt(team.quotes.weekCount)} sub={`${fmtMoney(team.quotes.weekAmount)} · ay ${fmt(team.quotes.monthCount)} / ${fmtMoney(team.quotes.monthAmount)}`} />
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
            <div className={`lb-tr ${q.status === 'won' ? (q.saleCancelled ? 'tone-neutral' : 'tone-ok') : 'tone-danger'}`} key={q.quoteNo}>
              <span className="lb-td-title"><strong>{q.musteri}</strong><em>{q.owner ?? '—'} · {q.quoteNo}</em></span>
              <span className="lb-td-money"><b>{fmtMoney(q.amount)}</b><small>{fmt(q.devices)} cihaz</small></span>
              <span><Pill tone={q.status === 'won' ? (q.saleCancelled ? 'neutral' : 'ok') : 'danger'}>{q.status === 'won' ? (q.saleCancelled ? 'Satış iptal' : 'Satışa döndü') : q.reason ?? 'Kaybedildi'}</Pill></span>
              <span className="lb-td-due"><small>{fmtDate(q.date)}</small></span>
            </div>
          ))}
        </div>
      ) : <div className="lb-muted">Bu yıl kapanan teklif yok.</div>}
      </div>
      <div className="lb-stack">
        <div className="lb-card">
          <div className="lb-card-head"><h3>Kişi Bazında Teklif → Satış</h3><span>pasif = {LIVE_BOARD_RULES.quotePassiveDays}+ gün dokunulmamış · dönüşüm = satış / kapanan teklif</span></div>
          {quotes.byOwner.length ? (
            <div className="lb-table lb-owner-quotes lb-owner-quotes-7">
              <div className="lb-tr lb-th"><span>Satıcı</span><span>Açık</span><span>Pasif</span><span>Bu Ay</span><span>Satış</span><span>Kayıp</span><span>Dönüşüm</span></div>
              {quotes.byOwner.slice(0, 6).map((row) => (
                <div className="lb-tr" key={row.owner}>
                  <span className="lb-td-title"><strong>{row.owner}</strong></span>
                  <span title={`${fmtMoney(row.openAmount)} açık · ağırlıklı ${fmtMoney(row.weighted)}`}>{fmt(row.open)}<small>{fmtMoney(row.openAmount)}</small></span>
                  <span className={row.passive ? 'tone-warn' : ''} title="geçerliliği bitmiş ya da 30+ gün dokunulmamış açık teklif">{fmt(row.passive)}</span>
                  <span>{fmt(row.monthCreated)}<small>{fmtMoney(row.monthAmount)}</small></span>
                  <span className="tone-ok" title={`${fmtMoney(row.saleAmount)} satış cirosu · ${fmt(row.saleDevices)} cihaz`}>{fmt(row.sale)}<small>{fmtMoney(row.saleAmount)} · {fmt(row.saleDevices)} ad</small></span>
                  <span className={row.lost ? 'tone-danger' : ''}>{fmt(row.lost)}{row.saleCancelled ? <small>{fmt(row.saleCancelled)} iptal</small> : null}</span>
                  <span className={`tone-${conversionTone(row.conversionPct)}`}>{row.conversionPct == null ? '—' : `%${row.conversionPct}`}<small>{row.conversionPct == null ? 'kapanan yok' : `${fmt(row.sale)}/${fmt(row.sale + row.lost + row.saleCancelled)}`}</small></span>
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
  // Türkçe başlık (toplantıda "Stale ne?" sorusu geldi — 07.09); İngilizce spec adı ipucunda.
  overdue: { title: 'Geciken Aksiyon', hint: 'overdue action · tarihi geçmiş next action / takip' },
  stale: { title: 'Hareketsiz Fırsat', hint: `stale · ${LIVE_BOARD_RULES.staleWarnDays}–${LIVE_BOARD_RULES.staleDangerDays - 1} gün turuncu · ${LIVE_BOARD_RULES.staleDangerDays}+ gün kırmızı` },
  poc_delay: { title: 'POC Gecikmesi', hint: 'hedef tarihi geçen POC / test' },
  target_gap: { title: 'Hedef Açığı', hint: 'forecast yıllık hedefin altında' },
  customer_waiting: { title: 'Müşteri Bekleniyor', hint: 'top müşteride' },
  contract_waiting: { title: 'Sözleşme Bekliyor', hint: 'sözleşme fazında bekleyen' },
  expired_quote: { title: 'Süresi Dolan Teklif', hint: 'kapatılmamış açık teklif' },
  portfolio_load: { title: 'Portföy Yükü', hint: `${LIVE_BOARD_RULES.portfolioLoadLimit}+ firma tek sorumluda · havuza devir` },
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
        <div className="lb-empty"><div><strong>Aksiyon gerektiren başlık yok</strong>Hareketsiz fırsat, geciken aksiyon, POC gecikmesi ya da hedef açığı bulunmuyor.</div></div>
      )}
    </div>
  );
}

function JiraSlide({ data, caps, page }: { data: LiveBoardPayload; caps: Capacities; page: number }) {
  const j = data.team.jira;
  if (!j) return <div className="lb-slide lb-single"><div className="lb-empty"><div><strong>Jira verisi yok</strong>Entegrasyon kapalı ya da yanıt vermedi.</div></div></div>;
  const rows = pageSlice(j.byCompany, page, caps.jiraRows);
  const bounds = pageBounds(j.byCompany.length, page, caps.jiraRows);
  const openDist: Distribution = [
    { label: 'Devam eden', value: j.ongoing, tone: 'info' },
    { label: 'Geliştirme bekleyen', value: j.developmentWaiting, tone: 'warn' },
    { label: 'Müşteri bekleyen', value: j.customerWaiting, tone: 'warn' },
  ];
  const openColors = ['var(--lb-info)', 'var(--lb-danger)', 'var(--lb-warn)'];
  const weekMax = Math.max(1, j.created, j.closed);
  const net = j.created - j.closed;
  return (
    <div className="lb-slide lb-jira" key="jira">
      <div className="lb-kpis five">
        <Kpi label="Toplam Açık" value={fmt(j.open)} tone={j.open ? 'warn' : 'ok'} sub="devam + geliştirme + müşteri bekleyen" />
        <Kpi label="Bu Hafta Açılan" value={fmt(j.created)} sub={data.range.label} />
        <Kpi label="Bu Hafta Kapanan" value={fmt(j.closed)} tone="ok" sub={net > 0 ? `net +${fmt(net)} açık` : net < 0 ? `net ${fmt(net)} · eriyor` : 'açılan = kapanan'} />
        <Kpi label="Müşteri Bekleyen" value={fmt(j.customerWaiting)} tone={j.customerWaiting ? 'warn' : 'ok'} sub="müşteriden yanıt / erişim bekleniyor" />
        <Kpi label="Geliştirme Bekleyen" value={fmt(j.developmentWaiting)} tone={j.developmentWaiting ? 'danger' : 'ok'} sub="ürün / yazılım ekibinde" />
      </div>
      <div className="lb-card lb-table-card">
        <div className="lb-card-head">
          <h3>Firma Bazında</h3>
          <span>açığa göre sıralı{bounds.paged ? ` · ${bounds.from}–${bounds.to} / ${j.byCompany.length}` : ` · ${j.byCompany.length} firma`}</span>
        </div>
        {rows.length ? (
          <div className="lb-table lb-owner-quotes lb-jira-table">
            <div className="lb-tr lb-th"><span>Firma</span><span>Açık</span><span>Devam</span><span>Geliştirme</span><span>Müşteri</span><span>Açılan</span><span>Kapanan</span></div>
            {rows.map((row) => {
              const open = row.ongoing + row.developmentWaiting + row.customerWaiting;
              return (
                <div className={`lb-tr ${open ? 'tone-warn' : 'tone-ok'}`} key={row.company}>
                  <span className="lb-td-title"><strong>{row.company}</strong></span>
                  <span className={open ? 'tone-warn' : ''}>{fmt(open)}</span>
                  <span>{fmt(row.ongoing)}</span>
                  <span className={row.developmentWaiting ? 'tone-danger' : ''}>{fmt(row.developmentWaiting)}</span>
                  <span className={row.customerWaiting ? 'tone-warn' : ''}>{fmt(row.customerWaiting)}</span>
                  <span>{fmt(row.created)}</span>
                  <span className={row.closed ? 'tone-ok' : ''}>{fmt(row.closed)}</span>
                </div>
              );
            })}
          </div>
        ) : <div className="lb-muted">Bu hafta hareketi ya da açık ticket&apos;ı olan firma yok.</div>}
      </div>
      <div className="lb-stack">
        <div className="lb-card">
          <div className="lb-card-head"><h3>Açık Ticket Dağılımı</h3><span>{fmt(j.open)} açık</span></div>
          {j.open ? (
            <Donut rows={openDist} colors={openColors} center={fmt(j.open)} centerLabel="açık ticket" size={200} />
          ) : <div className="lb-muted">Açık ticket yok.</div>}
        </div>
        <div className="lb-card">
          <div className="lb-card-head"><h3>Bu Hafta</h3><span>{data.range.label}</span></div>
          <div className="lb-jira-week">
            <div className="lb-channel">
              <div className="lb-channel-label">Açılan</div>
              <div className="lb-bar"><span className="tone-warn" style={{ width: `${Math.round((j.created / weekMax) * 100)}%` }} /></div>
              <div className="lb-channel-num">{fmt(j.created)}</div>
            </div>
            <div className="lb-channel">
              <div className="lb-channel-label">Kapanan</div>
              <div className="lb-bar"><span className="tone-ok" style={{ width: `${Math.round((j.closed / weekMax) * 100)}%` }} /></div>
              <div className="lb-channel-num">{fmt(j.closed)}</div>
            </div>
            <div className={`lb-jira-net tone-${net > 0 ? 'warn' : net < 0 ? 'ok' : 'neutral'}`}>
              {net > 0 ? `Açık stok bu hafta ${fmt(net)} arttı` : net < 0 ? `Açık stok bu hafta ${fmt(-net)} azaldı` : 'Açılan ve kapanan eşit'}
              <small>kaynak: Jira · Retail Support · 10 dk önbellek</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Müşteri Takip Statüsü donut'u (H/F/L/K) — kişi slaytı --------------------- */
/**
 * Kişinin Müşteri Listesi (Operasyon › Müşteri Listesi, `crm_musteri_listesi`) dağılımı.
 * v2.8 (Sinan, 10.09): kart adı **Müşteri Takip Statüsü**; donut yalnız Hunter/Farmer değil
 * **dört dilim** — Hunter · Farmer · Lead · Kasa Firması, oranlarıyla. Merkez = toplam firma.
 * Renkler kart altındaki not satırıyla birebir aynı (lejant yerine renkli not; sağdaki iki
 * küçük halkaya yer kalsın diye).
 */
const STATUS_SEGMENTS = [
  { key: 'hunter', label: 'Hunter', color: 'var(--lb-info)' },
  { key: 'farmer', label: 'Farmer', color: 'var(--lb-ok)' },
  { key: 'lead', label: 'Lead', color: 'var(--lb-warn)' },
  { key: 'kasa', label: 'Kasa', color: 'var(--lb-violet)' },
] as const;

function StatusDonut({ list, size }: { list: CustomerListSplit; size: number }) {
  const total = list.hunter + list.farmer + list.lead + list.kasa;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const shown = STATUS_SEGMENTS.map((segment) => ({ ...segment, value: list[segment.key] })).filter((segment) => segment.value > 0);
  const gap = shown.length > 1 ? 2.2 : 0;
  let offset = 0;
  const arcs = shown.map((segment) => {
    const share = total ? segment.value / total : 0;
    const length = Math.max(0, share * circumference - gap);
    const arc = { ...segment, length, dashOffset: -offset };
    offset += share * circumference;
    return arc;
  });
  return (
    <div className="lb-donut lb-status-donut" style={{ width: size, height: size }} role="img"
      aria-label={STATUS_SEGMENTS.map((segment) => `${segment.label} ${list[segment.key]}`).join(' · ')}>
      <svg viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={radius} />
        {arcs.map((arc) => (
          <circle key={arc.key} cx="50" cy="50" r={radius} stroke={arc.color}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`} strokeDashoffset={arc.dashOffset} />
        ))}
      </svg>
      <div className="lb-ring-center"><strong>{fmt(total)}</strong><span>firma</span></div>
    </div>
  );
}

/** Donut altındaki renkli not: "Hunter 9 %38 · Farmer 4 %17 · Lead 8 %33 · Kasa 3 %12". */
function StatusNote({ list }: { list: CustomerListSplit }) {
  const total = list.hunter + list.farmer + list.lead + list.kasa;
  return (
    <>
      {STATUS_SEGMENTS.map((segment, index) => (
        <span key={segment.key}>
          {index ? ' · ' : ''}
          <b style={{ color: segment.color }}>{segment.label} {fmt(list[segment.key])}</b>
          {total ? <em className="lb-status-pct"> %{Math.round((list[segment.key] / total) * 100)}</em> : null}
        </span>
      ))}
    </>
  );
}

/* --- Kişi slaytı (Sales Performance) --------------------------------------- */

/**
 * Büyük donut kartı: başlık + büyük halka (sol) + iki küçük halka (sağ, alt alta) + tek satır değer.
 * v2.7 (Çağdaş Bey 10.09 toplantısı): "her donut'un yanına iki küçük simit daha — bir büyük, bir küçük".
 */
function DonutCard({ title, children, aside, note, tone }: { title: string; children: ReactNode; aside?: ReactNode; note: ReactNode; tone?: Tone }) {
  return (
    <div className="lb-card lb-donut-card">
      <div className="lb-card-head"><h3>{title}</h3></div>
      <div className={`lb-donut-card-body ${aside ? 'with-aside' : ''}`}>
        <div className="lb-donut-main">{children}</div>
        {aside ? <div className="lb-donut-aside">{aside}</div> : null}
      </div>
      <div className={`lb-donut-card-note tone-${tone ?? 'neutral'}`}>{note}</div>
    </div>
  );
}

/**
 * Küçük hedef halkası: hedef varsa % ve "gerçekleşen / hedef", yoksa yalnız gerçekleşen.
 * `pending` — gerçekleşen sayaç henüz bağlanmadı (entegrasyon, 11.09): yüzde yerine hedef yazılır.
 */
function MiniRing({ pair, label, tone, size, money = false, pending = false }: { pair: GoalPair; label: string; tone: Tone; size: number; money?: boolean; pending?: boolean }) {
  const has = pair.target != null;
  const val = (value: number) => (money ? fmtMoney(value) : fmt(value));
  if (pending) {
    return (
      <div className={`lb-mini tone-${tone}`} title="Gerçekleşen veri bekleniyor">
        <Ring pct={null} tone={tone} big={has ? val(pair.target ?? 0) : '—'} sub={has ? 'hedef' : 'hedef yok'} size={size} stroke={10} />
        <span className="lb-mini-label">{label}</span>
      </div>
    );
  }
  return (
    <div className={`lb-mini tone-${tone}`} title={has ? `${val(pair.actual)} / ${val(pair.target ?? 0)}` : undefined}>
      <Ring pct={has ? pair.pct : null} tone={tone} big={has ? `%${pair.pct ?? 0}` : val(pair.actual)} sub={has ? `${val(pair.actual)} / ${val(pair.target ?? 0)}` : 'hedef yok'} size={size} stroke={10} />
      <span className="lb-mini-label">{label}</span>
    </div>
  );
}

/** Hedefe göre ton: hız (zamanın önünde/gerisinde) verilmişse o, yoksa düz yüzde eşiği. */
function goalTone(pair: GoalPair, elapsedPct?: number): Tone {
  if (pair.target == null) return 'neutral';
  if (elapsedPct != null) return paceTone(pair.pct, elapsedPct) ?? 'neutral';
  return pctTone(pair.pct);
}

/* --- v2.9 yardımcı kutuları (11.09 toplantısı) ----------------------------- */

/** Teklif hücresi: adet BÜYÜK, tutarı hemen yanında (Çağdaş Bey: "yanına yaz açık tekliflerin tutarı"). */
function QuoteCell({ label, value, tone }: { label: string; value: CountAmount; tone: Tone }) {
  return (
    <div className={`lb-figure tone-${tone}`}>
      <div className="lb-figure-value">
        <strong>{fmt(value.count)}</strong>
        <em>{value.count ? fmtMoney(value.amount) : '—'}</em>
      </div>
      <span>{label}</span>
    </div>
  );
}

/** Sade sayı hücresi: değer + etiket (+ isteğe bağlı alt not). */
function Figure({ label, value, note, tone = 'neutral', href, title }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone; href?: string; title?: string }) {
  const body = (
    <>
      <div className="lb-figure-value"><strong>{value}</strong></div>
      <span>{label}</span>
      {note ? <small>{note}</small> : null}
    </>
  );
  // Hareketsiz sayacı tıklanabilir: liste YENİ SEKMEDE açılır (Çağdaş Bey, 11.09: "New Tab açsın").
  if (href) {
    return (
      <a className={`lb-figure tone-${tone} is-link`} href={href} target="_blank" rel="noreferrer" title={title}>
        {body}
        <i className="lb-figure-go" aria-hidden="true">↗</i>
      </a>
    );
  }
  return <div className={`lb-figure tone-${tone}`} title={title}>{body}</div>;
}

/**
 * MODEL BAZLI CİHAZ KIRILIMI (Çağdaş Bey, 11.09: "model bazlı cihaz kurulumu… kişi bazında,
 * canlı ekranda"). Her satır bir model; bar iki renkli: satılan (mavi) + kiralanan (mor).
 * Sığmayan modeller son satırda "+N model · M cihaz" olarak toplanır — sayı kaybolmaz.
 */
function ModelBars({ devices, limit }: { devices: OwnerDevices; limit: number }) {
  const rows = devices.byModel;
  if (!rows.length) {
    return <div className="lb-muted">{devices.unlinked ? `${fmt(devices.unlinked)} cihaz · kalem girilmemiş satışlardan` : 'Bu yıl satış kalemi yok.'}</div>;
  }
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const restTotal = rest.reduce((sum, row) => sum + row.total, 0);
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="lb-models">
      {shown.map((row) => (
        <div className="lb-model" key={row.code} title={`${row.code} · satılan ${row.sold} · kiralanan ${row.rental}`}>
          <span className="lb-model-code">{row.code}</span>
          <div className="lb-model-bar">
            <i className="sold" style={{ width: `${(row.sold / max) * 100}%` }} />
            <i className="rental" style={{ width: `${(row.rental / max) * 100}%` }} />
          </div>
          <strong>{fmt(row.total)}</strong>
        </div>
      ))}
      {rest.length ? <div className="lb-model lb-model-rest"><span className="lb-model-code">+{rest.length} model</span><div className="lb-model-bar" /><strong>{fmt(restTotal)}</strong></div> : null}
    </div>
  );
}

/**
 * SON HAREKETLER — küçük kutu (Çağdaş Bey, 11.09): "Bu kadar yere ayırmasına gerek yok…
 * şurada altta böyle ufacık yazabiliriz… tek kutu içerisinde 1, 2, 3, 4, 5 gibi."
 * Numaralı, tek satırlık kayıtlar; faz değişimi yalnız ok işaretiyle.
 */
function MiniActivityList({ rows, todayKey }: { rows: LiveActivity[]; todayKey: string }) {
  if (!rows.length) return <div className="lb-muted">Bu hafta hareket yok.</div>;
  return (
    <ol className="lb-mini-list">
      {rows.map((row, index) => (
        <li key={row.id}>
          <b>{index + 1}</b>
          <span className="lb-mini-firm">{row.musteri}</span>
          <span className="lb-mini-kind" title={row.label}>{row.label}</span>
          {row.phaseChange === 'up' ? <i className="tone-ok" title={`Faz ${row.phaseFrom} → ${row.phaseTo}`}>↑{row.phaseTo}</i> : null}
          <small>{fmtActivityDay(row.date, row.at, todayKey)}</small>
        </li>
      ))}
    </ol>
  );
}

/* --- Kişi slaytı v2.9 ------------------------------------------------------ */

/**
 * KİŞİ SLAYDI — Çağdaş Bey'in 11.09.2026 toplantısı + Sinan'ın KPI listesi.
 * Dört blok, aynı sayı iki kartta tekrar etmez:
 *   1) TİCARİ SONUÇ    (üst bant) : yıllık hedef · YTD ciro · forecast · gap · fatura · dönüşüm
 *   2) donut satırı              : Aktivite Hedefi · Yıllık Bütçe · Entegrasyon · Müşteri Takip Statüsü
 *   3) SATIŞ ÇIKTISI   (alt orta) : açık/kazanılan/kaybedilen teklif (adet + TUTAR) · cihaz · model kırılımı
 *   4) PORTFÖY SAĞLIĞI (alt sağ)  : hareketsiz (15 gün, tıklanınca yeni sekme) · kapsanan firma · temas · portföy
 * Sol altta küçük Son Hareketler kutusu.
 *
 * KALKANLAR: "Pipeline" (Çağdaş Bey: "Pipeline diye bir şey yok") ve "Aktif Fırsat"
 * ("aktif fırsatı görmek istemiyorum, bana teklif sayısı önemli").
 */
function OwnerSlide({ owner, todayKey, caps, donutRowH }: { owner: LiveOwner; todayKey: string; caps: Capacities; donutRowH: number }) {
  const r = owner.revenue;
  const g = owner.goals;
  // Dört donut kartı yan yana: halka çapı satır yüksekliğinden türer, küçük halkalar yanında kalır.
  const ring = Math.max(112, donutRowH - 132);
  const mini = Math.round(ring * 0.44);
  const recentRows = owner.recentActivities.slice(0, Math.min(5, caps.recent));
  const hasRevenueTarget = r.target != null;
  const weeklyTarget = owner.target.totalActivities || 0;
  const weeklyPct = owner.achievementPct;
  const weeklyTone: Tone = weeklyTarget ? pctTone(weeklyPct) : 'neutral';
  const q = g.quarter.label;
  const deviceGoal: GoalPair = { actual: r.deviceActualYtd, target: r.deviceTarget, pct: pctOf(r.deviceActualYtd, r.deviceTarget) };
  const inactiveTone: Tone = owner.inactive.count === 0 ? 'ok' : owner.inactive.count >= 5 ? 'danger' : 'warn';
  const inactiveHref = `/crm/hareketsiz?satici=${encodeURIComponent(owner.owner)}&gun=${owner.inactive.days}`;
  return (
    <div className="lb-slide lb-owner" key={owner.owner}>
      <CommercialBand r={r} invoices={owner.invoices} />

      <DonutCard
        title="Aktivite Hedefi"
        tone={weeklyTone}
        note={weeklyTarget
          ? <>Hafta {fmt(owner.actual.totalActivities)} / {fmt(weeklyTarget)} · bugün {fmt(owner.todayActivities)} · yıl {fmt(owner.coverage.activitiesYear)} aktivite</>
          : <>Hafta {fmt(owner.actual.totalActivities)} aktivite · bugün {fmt(owner.todayActivities)} · yıl {fmt(owner.coverage.activitiesYear)}</>}
        aside={<>
          <MiniRing pair={g.visitsQuarter} label={`${q} ziyaret`} tone={goalTone(g.visitsQuarter, g.quarter.elapsedPct)} size={mini} />
          <MiniRing pair={g.visitsYear} label="Yıl ziyaret" tone={goalTone(g.visitsYear, r.yearElapsedPct)} size={mini} />
        </>}
      >
        <Ring pct={weeklyTarget ? weeklyPct : null} tone={weeklyTone} big={weeklyTarget ? `%${weeklyPct ?? 0}` : fmt(owner.actual.totalActivities)} sub={weeklyTarget ? 'hafta' : 'bu hafta'} size={ring} stroke={11} />
      </DonutCard>

      <DonutCard
        title={`Yıllık Bütçe Hedefi · ${r.year}`}
        tone={hasRevenueTarget ? (r.pace ?? 'neutral') : 'neutral'}
        note={hasRevenueTarget
          ? <>{fmtMoney(r.actualYtd)} / {fmtMoney(r.target)} · {q} {fmtMoney(g.budgetQuarter.actual)}{g.budgetQuarter.target != null ? ` / ${fmtMoney(g.budgetQuarter.target)}` : ''}</>
          : <>{fmtMoney(r.actualYtd)} YTD · {q} {fmtMoney(g.budgetQuarter.actual)}</>}
        aside={<>
          <MiniRing pair={g.budgetQuarter} label={`${q} bütçe`} tone={goalTone(g.budgetQuarter, g.quarter.elapsedPct)} size={mini} money />
          <MiniRing pair={deviceGoal} label="Cihaz" tone={goalTone(deviceGoal, r.yearElapsedPct)} size={mini} />
        </>}
      >
        <Ring pct={hasRevenueTarget ? r.attainmentPct : null} tone={hasRevenueTarget ? (r.pace ?? 'neutral') : 'neutral'} big={hasRevenueTarget ? `%${r.attainmentPct ?? 0}` : fmtMoney(r.actualYtd)} sub={hasRevenueTarget ? 'yıl' : 'YTD ciro'} size={ring} stroke={11} />
      </DonutCard>

      {/* Entegrasyon: hedef + çeyrek girilir (11.09); GERÇEKLEŞEN sayaç Furkan'ın fatura verisi
          bağlanınca açılacak — o güne kadar yanlış sayı gösterilmez (Sinan'ın kararı). */}
      <DonutCard
        title="Entegrasyon Hedefi"
        tone="neutral"
        note={g.integrationPending
          ? <>Gerçekleşen veri bekleniyor · hedef {g.integration.target == null ? '—' : fmt(g.integration.target)} · {q} {g.integrationQuarter.target == null ? '—' : fmt(g.integrationQuarter.target)}{g.integrationQuarterAssumed ? ' (yıl/4)' : ''}</>
          : <>{fmt(g.integration.actual)}{g.integration.target != null ? ` / ${fmt(g.integration.target)}` : ''} entegrasyon</>}
        aside={<MiniRing pair={g.integrationQuarter} label={`${q} entegrasyon`} tone={g.integrationPending ? 'neutral' : goalTone(g.integrationQuarter, g.quarter.elapsedPct)} size={mini} pending={g.integrationPending} />}
      >
        <Ring pct={g.integrationPending ? null : g.integration.pct} tone={g.integrationPending ? 'neutral' : goalTone(g.integration, r.yearElapsedPct)}
          big={g.integrationPending ? (g.integration.target == null ? '—' : fmt(g.integration.target)) : `%${g.integration.pct ?? 0}`}
          sub={g.integrationPending ? 'yıl hedefi' : 'yıl'} size={ring} stroke={11} />
      </DonutCard>

      <DonutCard
        title="Müşteri Takip Statüsü"
        note={owner.list ? <StatusNote list={owner.list} /> : 'Müşteri Listesi henüz doldurulmadı'}
        aside={<>
          <MiniRing pair={g.hunterToFarmer} label="H → F çevirme" tone={goalTone(g.hunterToFarmer)} size={mini} />
          <MiniRing pair={g.leadToHunter} label="L → H çevirme" tone={goalTone(g.leadToHunter)} size={mini} />
        </>}
      >
        {owner.list ? <StatusDonut list={owner.list} size={ring} /> : <Ring pct={null} tone="neutral" big="—" sub="liste yok" size={ring} stroke={11} />}
      </DonutCard>

      <div className="lb-card lb-owner-recent">
        <div className="lb-card-head"><h3>Son Hareketler</h3><span>bu hafta</span></div>
        <MiniActivityList rows={recentRows} todayKey={todayKey} />
      </div>

      <div className="lb-card lb-owner-output">
        <div className="lb-card-head"><h3>Satış Çıktısı</h3><span>teklif · cihaz · model</span></div>
        <div className="lb-figure-row three">
          <QuoteCell label="Açık Teklif" value={owner.quoteBox.open} tone={r.expiredOpenQuotes ? 'warn' : 'info'} />
          <QuoteCell label="Kazanılan" value={owner.quoteBox.won} tone={owner.quoteBox.won.count ? 'ok' : 'neutral'} />
          <QuoteCell label="Kaybedilen" value={owner.quoteBox.lost} tone={owner.quoteBox.lost.count ? 'danger' : 'neutral'} />
        </div>
        <div className="lb-figure-row four">
          <Figure label="Toplam Cihaz" value={fmt(owner.devices.total)} />
          <Figure label="Satılan" value={fmt(owner.devices.sold)} tone={owner.devices.sold ? 'info' : 'neutral'} />
          <Figure label="Kiralanan" value={fmt(owner.devices.rental)} tone={owner.devices.rental ? 'info' : 'neutral'} />
          <Figure label="Aktif POC" value={fmt(owner.pipeline.poc)} />
        </div>
        <ModelBars devices={owner.devices} limit={caps.ownerModels} />
      </div>

      <div className="lb-card lb-owner-health">
        <div className="lb-card-head"><h3>Portföy Sağlığı</h3><span>kapsama · hareketsizlik</span></div>
        <div className="lb-figure-row two">
          <Figure
            label="Hareketsiz Firma"
            value={fmt(owner.inactive.count)}
            note={`${owner.inactive.days} gündür üzerinde işlem olmayan firma`}
            tone={inactiveTone}
            href={inactiveHref}
            title="Listeyi yeni sekmede aç"
          />
          <Figure
            label="Kapsanan Firma"
            value={owner.coverage.covered.target != null ? `${fmt(owner.coverage.covered.actual)} / ${fmt(owner.coverage.covered.target)}` : fmt(owner.coverage.covered.actual)}
            note="yıl içinde en az 1 aktivite"
            tone={goalTone(owner.coverage.covered, r.yearElapsedPct)}
          />
        </div>
        <div className="lb-figure-row two">
          <Figure
            label="Ortalama Temas / Firma"
            value={owner.coverage.contactsPer.target != null
              ? `${owner.coverage.contactsPer.actual.toLocaleString('tr-TR')} / ${fmt(owner.coverage.contactsPer.target)}`
              : owner.coverage.contactsPer.actual.toLocaleString('tr-TR')}
            note={`${fmt(owner.coverage.activitiesYear)} aktivite · yıl`}
            tone={goalTone(owner.coverage.contactsPer)}
          />
          <Figure
            label="Portföy"
            value={fmt(owner.portfolio.total)}
            note={owner.inactive.unmatched ? `${fmt(owner.inactive.unmatched)} liste satırı künyeyle eşleşmedi` : `${fmt(owner.portfolio.active)} firmada son 90 günde hareket`}
            tone={owner.portfolio.total >= LIVE_BOARD_RULES.portfolioLoadLimit ? 'warn' : 'neutral'}
          />
        </div>
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
  // Sunucu sürecinin başlama anı: değişince deploy olmuş demektir → "yeni sürüm" uyarısı (TV modunda
  // sayfayı kendimiz yenileyemeyiz; tam ekran düşer).
  const serverStartedAt = useRef<string | null>(null);
  const [newVersion, setNewVersion] = useState(false);
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
      const payload = json as LiveBoardPayload;
      setData(payload);
      setError(null);
      setUpdatedAt(new Date());
      const started = payload.server?.startedAt ?? null;
      if (started) {
        if (serverStartedAt.current && serverStartedAt.current !== started) setNewVersion(true);
        serverStartedAt.current = started;
      }
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

  /**
   * Sıfırla (↻ / R): veriyi yeniden çeker, döngüyü ilk slayta alır, ekran kilidini yeniler.
   * Sinan (10.09): "reset tuşu verileri tekrar çekebilsin".
   */
  const hardRefresh = useCallback(() => {
    setIndex(0);
    setCycle((value) => value + 1);
    void load();
    try {
      const api = (navigator as any).wakeLock;
      if (api?.request && !wakeLock.current) void api.request('screen').then((lock: unknown) => { wakeLock.current = lock; }).catch(() => {});
    } catch {}
  }, [load]);

  // Her sabah 08:00 (İstanbul) otomatik yenileme — Sinan (10.09): "ekran uzun süre açık kalacak".
  // Tam ekranda sayfa yenilenmez (TV modu düşer): veri + döngü sıfırlanır. Tam ekran değilse sayfa
  // yeniden yüklenir; böylece gece deploy edilen sürüm de alınır.
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const arm = () => {
      const ms = msUntilIstanbulTime(new Date(), LIVE_BOARD_TIMING.dailyRefreshHour, LIVE_BOARD_TIMING.dailyRefreshMinute);
      timer = window.setTimeout(() => {
        if (document.fullscreenElement) { hardRefresh(); arm(); }
        else window.location.reload();
      }, ms);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [active, hardRefresh]);

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
      else if (event.key === 'r' || event.key === 'R') hardRefresh();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, toggleFullscreen, hardRefresh]);

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
        ? <OwnerSlide owner={owner} todayKey={data.range.today} caps={caps} donutRowH={metrics.donutRowH} />
        : <PulseSlide data={data} caps={caps} page={0} compact={metrics.compact} />;
    }
    switch (current.key) {
      case 'pulse': return <PulseSlide data={data} caps={caps} page={page} compact={metrics.compact} />;
      case 'portfolio': return <PortfolioSlide data={data} caps={caps} page={page} />;
      case 'hot': return <HotSlide data={data} caps={caps} page={page} />;
      case 'poc': return <PocSlide data={data} caps={caps} page={page} />;
      case 'quotes': return <QuotesSlide data={data} caps={caps} page={page} />;
      case 'alerts': return <AlertsSlide data={data} caps={caps} page={page} />;
      case 'jira': return <JiraSlide data={data} caps={caps} page={page} />;
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
        '--lb-donut-row-h': `${metrics.donutRowH}px`,
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
      {/* Tam ekranda üst şerit yüzen katmandır (Çağdaş Bey 10.09: "üst kısmı da kullanalım, mouse gelince
          açılsın; ama kişinin adı görünsün"): fare durunca yukarı kayar, ince başlık çubuğu (lb-fs-title) kalır. */}
      <div className={`lb-top ${fullscreen ? 'lb-top-fs' : ''} ${controlsHidden ? 'hidden' : ''}`}>
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
            <button type="button" className="lb-ctl" onClick={hardRefresh} aria-label="Veriyi yenile ve baştan başlat" title="Yenile · baştan başlat (R)">↻</button>
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

      {fullscreen ? (
        <div className="lb-fs-title" aria-hidden="true">
          <span className="lb-fs-eyebrow">PAX Retail Command Center</span>
          <div className="lb-title">{title.main}<small>{title.sub}</small></div>
          <span className="lb-fs-clock">{fmtClock(now)}</span>
        </div>
      ) : null}

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
        <div className={`lb-strip ${fullscreen ? 'lb-strip-fs' : ''} ${controlsHidden ? 'hidden' : ''}`}>
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
            {newVersion ? <b className="lb-new-version"> · yeni sürüm var — sayfayı yenileyin (F5, sonra F)</b> : ''}
          </span>
        </div>
      ) : null}
    </section>
  );
}
