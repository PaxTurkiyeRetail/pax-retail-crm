'use client';

// DASHBOARD (05.10.2026) — karne yapısında, dönmeyen tek sayfa. Açan hesap KENDİ durumunu görür:
// skor, ciro/cihaz/görüşme, "satış mı az, iletişim mi az" teşhisi ve yapılacaklar, son hareketleri.
// Yönetici ek olarak satıcı sıralamasını görür, karta basınca o kişinin durumuna geçer.
// Veri: /api/reports/dashboard?period=… — kurallar karneyle aynı (lib/reports/performance-card.ts).

import { useCallback, useEffect, useState } from 'react';
import { drilldownHref } from '@/lib/reports/drilldown-shared';
import { fmtMoney, normalizeName, type Tone } from '@/lib/reports/live-board-shared';
import {
  PERF_PERIODS, attainmentPct, attainmentTone, perfDimensions, perfGrade, perfTotal,
  type Measure, type PerfOwnerReport, type PerfPayload, type PerfPeriodKind,
} from '@/lib/reports/performance-card';
import { PERF_EVENT_TYPES, type PerfEvent } from '@/lib/reports/performance-activity-shared';
import { Box, Hero, Row, Trend } from '@/components/reports/PerformanceCard';
import '@/styles/performance-card.css';

type Payload = { report: PerfPayload; me: string | null; privileged: boolean; recent: PerfEvent[] };
type Advice = { tone: Tone; title: string; text: string; href?: string };

const NA = 'N/A';
const fmt = (v: number) => v.toLocaleString('tr-TR');
const typeLabel = (t: string) => PERF_EVENT_TYPES.find((x) => x.key === t)?.label ?? t;

/** Hedefe göre hız: gerçekleşme / dönemin geçen yüzdesi (100 = tam yolunda). */
function pace(m: Measure | null | undefined, elapsed: number): number | null {
  const pct = attainmentPct(m ?? { actual: 0, target: null });
  return pct == null ? null : Math.round((pct / Math.max(5, elapsed)) * 100);
}

/** Teşhis: satış mı az, iletişim mi az, ne yapmalı — rakamlarla. */
function diagnose(r: PerfOwnerReport, elapsed: number, link: (k: Parameters<typeof drilldownHref>[0]['kind'], extra?: Record<string, unknown>) => string): Advice[] {
  const out: Advice[] = [];
  const sale = pace(r.revenue, elapsed);
  const dev = pace(r.devices, elapsed);
  const talk = pace(r.meetings, elapsed);
  const saleLow = (sale != null && sale < 80) || (dev != null && dev < 80);
  const talkLow = talk != null && talk < 80;
  const left = (m: Measure, render: (v: number) => string) => (m.target != null && m.target > m.actual ? render(m.target - m.actual) : null);

  if (saleLow && talkLow) {
    out.push({ tone: 'danger', title: 'Hem iletişim hem satış az', text: `Görüşme hızın %${talk}, satış hızın %${sale ?? dev}. Önce görüşme sayısını artır: hedefe ${left(r.meetings, fmt) ?? '0'} görüşme kaldı.`, href: link('kapsama') });
  } else if (talkLow) {
    out.push({ tone: 'warn', title: 'İletişim az', text: `Görüşme hızın %${talk} (beklenen %100). Hedefe ${left(r.meetings, fmt) ?? '0'} görüşme kaldı. Satış şimdilik iyi ama görüşme düşerse ileride düşer.`, href: link('kapsama') });
  } else if (saleLow) {
    out.push({ tone: 'danger', title: 'Satış az', text: `Görüşmelerin yolunda (%${talk ?? NA}) ama satışa dönmüyor: ciro hızı %${sale ?? NA}, cihaz hızı %${dev ?? NA}. ${r.pipeline.openCount} açık teklifi (${fmtMoney(r.pipeline.openAmount)}) kapatmaya odaklan.${left(r.revenue, fmtMoney) ? ` Hedefe ${left(r.revenue, fmtMoney)} kaldı.` : ''}`, href: link('teklif', { state: 'acik' }) });
  } else if (sale == null && talk == null) {
    out.push({ tone: 'info', title: 'Hedef girilmemiş', text: 'Bu dönem için ciro / görüşme hedefin yok; yöneticinden hedef girmesini iste.' });
  } else {
    out.push({ tone: 'ok', title: 'Yolundasın', text: `Ciro hızı %${sale ?? NA}, görüşme hızı %${talk ?? NA}. Aynı tempoyla devam.` });
  }

  if (r.risks.staleQuotes) out.push({ tone: 'warn', title: `${r.risks.staleQuotes} teklif 30+ gündür bekliyor`, text: 'Müşteriyi ara, ya kazan ya kapat; bekleyen teklif skoru düşürür.', href: link('teklif', { state: 'acik' }) });
  if (r.risks.overdueClose) out.push({ tone: 'warn', title: `${r.risks.overdueClose} teklifin kapanış tarihi geçti`, text: 'Tarihi güncelle ya da sonucu gir.', href: link('teklif', { state: 'acik' }) });
  if (r.risks.overdueActions) out.push({ tone: 'warn', title: `${r.risks.overdueActions} aksiyonun tarihi geçti`, text: 'Planlanan aksiyonları tamamla veya yeniden planla.', href: '/crm/activities' });
  if (r.risks.inactive) out.push({ tone: 'warn', title: `${r.risks.inactive} firma ile 15+ gündür temas yok`, text: 'Bu firmaları bu hafta ara / ziyaret et.', href: `/crm/hareketsiz?satici=${encodeURIComponent(r.owner)}&gun=15` });
  if (r.risks.longPoc) out.push({ tone: 'info', title: `${r.risks.longPoc} POC 30+ gündür açık`, text: 'POC sonucunu al: satışa çevir veya cihazı geri iste.', href: link('poc') });
  return out;
}

export default function DashboardOverview() {
  const [period, setPeriod] = useState<PerfPeriodKind>('month');
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');

  const load = useCallback(async (p: PerfPeriodKind) => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/reports/dashboard?period=${p}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
      setData(json as Payload);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);
  useEffect(() => { void load(period); }, [load, period]);

  if (status === 'error') return <div className="pc-wrap"><div className="pc-card">Veri alınamadı: {error} <button type="button" className="pc-btn" onClick={() => void load(period)}>Tekrar dene</button></div></div>;
  if (!data) return <div className="pc-wrap"><div className="pc-card">Yükleniyor…</div></div>;

  const { report, privileged } = data;
  const elapsed = report.range.elapsedPct;
  const periodButtons = PERF_PERIODS.map((x) => (
    <button type="button" key={x.key} className={period === x.key ? 'active' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>
  ));
  const ranked = report.owners
    .map((o) => ({ o, t: perfTotal(perfDimensions(o, elapsed)) }))
    .sort((a, b) => (b.t ?? -1) - (a.t ?? -1));
  const name = selected || data.me || ranked[0]?.o.owner || '';
  const r = report.owners.find((o) => o.owner === name);

  if (!r) {
    return (
      <div className="pc-wrap">
        <div className="pc-top"><div><div className="pc-eyebrow">Dashboard</div><h1>Durumun</h1></div><div className="pc-filters">{periodButtons}</div></div>
        <div className="pc-card">Bu hesap bir satıcı kaydıyla eşleşmedi; bu dönem için gösterilecek veri yok.</div>
      </div>
    );
  }

  const dims = perfDimensions(r, elapsed);
  const total = perfTotal(dims);
  const grade = perfGrade(total);
  const year = Number(report.range.from.slice(0, 4));
  const link = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Record<string, unknown> = {}) =>
    drilldownHref({ kind, owner: r.owner, year, ...extra } as Parameters<typeof drilldownHref>[0]);
  const advice = diagnose(r, elapsed, link);
  const rank = ranked.findIndex((x) => x.o.owner === r.owner) + 1;
  const isMe = r.owner === data.me;
  // Sunucu satıcıya zaten süzer; yöneticide tüm ekip gelir → seçili kişiye süz.
  const recent = (privileged ? data.recent.filter((e) => normalizeName(e.owner) === normalizeName(r.owner)) : data.recent).slice(0, 12);

  return (
    <div className={`pc-wrap${status === 'loading' ? ' is-loading' : ''}`}>
      <div className="pc-top">
        <div>
          <div className="pc-eyebrow">Dashboard{isMe ? ' · Durumun' : ''}</div>
          <h1>{r.owner}</h1>
          <div className="pc-sub">{report.range.label} · dönemin %{elapsed}&apos;i geçti{privileged && rank ? ` · ekipte ${rank}. / ${ranked.length}` : ''}</div>
        </div>
        <div className="pc-filters">
          {periodButtons}
          {privileged ? (
            <select value={r.owner} onChange={(e) => setSelected(e.target.value)} aria-label="Satıcı">
              {ranked.map(({ o }) => <option key={o.owner} value={o.owner}>{o.owner}{o.owner === data.me ? ' (ben)' : ''}</option>)}
            </select>
          ) : null}
        </div>
      </div>

      <div className="pc-grid g4">
        <Box href={privileged ? '/performans-karnesi' : undefined} className="pc-card pc-score">
          <div className={`pc-ring tone-${grade.tone}`} style={{ ['--pc-pct' as string]: `${total ?? 0}%` }}><b>{total == null ? NA : `%${total}`}</b></div>
          <div>
            <div className="pc-label">Genel Performans</div>
            <span className={`pc-grade tone-${grade.tone}`}>{grade.label}</span>
            <div className="pc-mini">Karnenin ağırlıklı skoru (5 boyut)</div>
          </div>
        </Box>
        <Hero label="Ciro" m={r.revenue} render={fmtMoney} href={link('fatura')} />
        <Hero label="Satılan Cihaz" m={r.devices} render={fmt} href={link('cihaz', { mode: 'sale' })} />
        <Hero label="Görüşme" m={r.meetings} render={fmt} href={link('kapsama')} />
      </div>

      <div className="pc-section">
        <div className="pc-title"><h2>Ne durumdasın, ne yapmalısın?</h2><span>hedefe göre hız · beklenen %100 · maddeye basınca ilgili liste açılır</span></div>
        <div className="pc-advice">
          {advice.map((a) => (
            <Box key={a.title} href={a.href} className={`pc-card pc-adv tone-b-${a.tone}`}>
              <b className={`tone-${a.tone}`}>{a.title}</b>
              <span>{a.text}</span>
            </Box>
          ))}
        </div>
      </div>

      <div className="pc-section">
        <div className="pc-title"><h2>Performans Boyutları</h2><span>karnedeki 5 boyut</span></div>
        <div className="pc-dims">
          {dims.map((d) => {
            const pct = d.score == null ? null : Math.round((d.score / d.weight) * 100);
            const tone = attainmentTone(pct);
            return (
              <div className="pc-dim" key={d.key}>
                <div className="pc-dimtop">
                  <div><div className="pc-dimname">{d.label}</div><div className="pc-mini">%{d.weight} ağırlık</div></div>
                  <div className={`pc-dimscore tone-${tone}`}>{pct == null ? NA : `%${pct}`}</div>
                </div>
                <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${pct ?? 0}%` }} /></div>
                <div className="pc-mini">{d.hint}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Pipeline ve Portföy</h2><span>anlık</span></div>
          <div className="pc-rows">
            <Row k="Açık teklif" v={`${fmt(r.pipeline.openCount)} · ${fmtMoney(r.pipeline.openAmount)}`} href={link('teklif', { state: 'acik' })} />
            <Row k="Forecast" v={fmtMoney(r.pipeline.forecast)} href="/crm/forecast" />
            <Row k="Kazanılan teklif" v={`${fmt(r.won.quotes)} · ${fmtMoney(r.won.amount)}`} href={link('teklif', { state: 'kazanilan' })} />
            <Row k="Portföy (L / H / F / K)" v={r.portfolio.listed ? `${fmt(r.portfolio.total)} (${r.portfolio.lead} / ${r.portfolio.hunter} / ${r.portfolio.farmer} / ${r.portfolio.kasa})` : NA} href={link('portfoy')} />
            <Row k="Temas edilen müşteri" v={fmt(r.contacted)} href={link('kapsama')} />
            <Row k="Hareketsiz firma" v={r.portfolio.listed ? fmt(r.risks.inactive) : NA} tone={r.risks.inactive ? 'danger' : 'ok'} href={`/crm/hareketsiz?satici=${encodeURIComponent(r.owner)}&gun=15`} />
          </div>
        </div>
        <div className="pc-card">
          <div className="pc-title">
            <h2>Son 6 Ay Ciro</h2>
            <div className="pc-legend"><span><i className="pc-dot actual" />Gerçekleşen</span><span><i className="pc-dot target" />Hedef</span></div>
          </div>
          <Trend points={r.trend} href={(y) => link('fatura', { year: y })} />
        </div>
      </div>

      <div className="pc-section pc-card">
        <div className="pc-title"><h2>Son Hareketler</h2><span>görüşme, teklif, kazanım, fatura, kategori · satıra bas, kayıt açılsın</span></div>
        {recent.length ? (
          <table className="pc-table">
            <thead><tr><th>Tarih</th><th>Tür</th><th>Müşteri</th><th>Detay</th><th>Tutar</th></tr></thead>
            <tbody>
              {recent.map((e, i) => (
                <tr key={`${e.date}-${e.type}-${i}`} className={e.href ? 'pc-click' : ''} onClick={() => { if (e.href) window.open(e.href, '_blank', 'noopener'); }}>
                  <td>{e.date.split('-').reverse().join('.')}</td>
                  <td><span className={`pc-tag t-${e.type}`}>{typeLabel(e.type)}</span></td>
                  <td>{e.customer}</td>
                  <td>{e.detail}</td>
                  <td>{e.amount == null ? '' : fmtMoney(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="pc-mini">Bu dönem kayıtlı hareket yok.</div>}
      </div>

      {privileged ? (
        <div className="pc-section">
          <div className="pc-title"><h2>Satıcı Sıralaması</h2><span>karnedeki genel skora göre · basınca o kişinin durumu</span></div>
          <div className="pc-rank">
            {ranked.map(({ o, t }, i) => {
              const g = perfGrade(t);
              return (
                <button type="button" key={o.owner} className={`pc-card pc-rank-item${o.owner === r.owner ? ' active' : ''}`} onClick={() => { setSelected(o.owner); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <span className="pc-ov-rank">{i + 1}</span>
                  <strong>{o.owner}</strong>
                  <b className={`tone-${g.tone}`}>{t == null ? NA : `%${t}`}</b>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
