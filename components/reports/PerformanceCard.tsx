'use client';

// PERFORMANS KARNESİ — Retail Sales Performance Report V1 (05.10.2026, müdür taslağı v2).
// Veri: /api/reports/performance?period=… (report.performance.read). Kurallar: lib/reports/performance-card.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drilldownHref } from '@/lib/reports/drilldown-shared';
import { fmtMoney, type Tone } from '@/lib/reports/live-board-shared';
import {
  PERF_PERIODS, attainmentPct, attainmentTone, perfDimensions, perfGrade, perfTotal,
  type Measure, type PerfOwnerReport, type PerfPayload, type PerfPeriodKind,
} from '@/lib/reports/performance-card';
import { PERF_EVENT_TYPES, type PerfEventType, type PerfEventsPayload } from '@/lib/reports/performance-activity-shared';
import '@/styles/performance-card.css';

const TEAM = '__team__';
const NA = 'N/A';
const fmt = (v: number | null | undefined) => (v == null ? NA : v.toLocaleString('tr-TR'));
const money = (v: number | null | undefined) => (v == null ? NA : fmtMoney(v));

/** Tıklanabilir kutu: her sayı detay (kırılım) ekranına yeni sekmede açılır. */
function Box({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={`${className} pc-link`}>{children}</a>
    : <div className={className}>{children}</div>;
}

function Hero({ label, m, render, href }: { label: string; m: Measure; render: (v: number) => string; href?: string }) {
  const pct = attainmentPct(m);
  const tone = attainmentTone(pct);
  return (
    <Box href={href} className="pc-card">
      <div className="pc-label">{label}</div>
      <div className={`pc-value tone-${pct == null ? 'info' : tone}`}>{render(m.actual)}</div>
      <div className="pc-mini">{m.target != null ? `${render(m.target)} hedef · %${pct} gerçekleşme` : 'hedef girilmemiş · N/A'}</div>
      <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
    </Box>
  );
}

function Row({ k, v, href, tone }: { k: string; v: string; href?: string; tone?: Tone }) {
  return (
    <div className="pc-row">
      <span>{k}</span>
      {href ? <a href={href} target="_blank" rel="noreferrer" className={tone ? `tone-${tone}` : ''}>{v}</a> : <b className={tone ? `tone-${tone}` : ''}>{v}</b>}
    </div>
  );
}

function Trend({ points, href }: { points: PerfOwnerReport['trend']; href: (year: number) => string }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.actual, p.target ?? 0)));
  return (
    <div className="pc-chart">
      {points.map((p) => (
        <a href={href(Number(p.month.slice(0, 4)))} target="_blank" rel="noreferrer" className="pc-month pc-link" key={p.month} title={`${p.label}: ${fmtMoney(p.actual)} / ${p.target == null ? 'hedef yok' : fmtMoney(p.target)}`}>
          <div className="pc-bars">
            <i className="pc-bar actual" style={{ height: `${(p.actual / max) * 100}%` }} />
            <i className="pc-bar target" style={{ height: `${((p.target ?? 0) / max) * 100}%` }} />
          </div>
          <small>{p.label}</small>
          <small className="pc-mini">{fmtMoney(p.actual)}</small>
        </a>
      ))}
    </div>
  );
}

/** Boyut kartı hover açıklaması: puanın hangi rakamlardan, nasıl çıktığı (perfDimensions ile aynı formül). */
function dimExplain(key: string, r: PerfOwnerReport, elapsed: number): string[] {
  const num = (v: number) => v.toLocaleString('tr-TR');
  const pace = (label: string, m: Measure | null | undefined, render: (v: number) => string = num) => {
    if (!m || m.target == null || m.target <= 0) return `${label}: ${m ? render(m.actual) : NA} · hedef girilmemiş → hesaba katılmaz`;
    const pct = Math.round((m.actual / m.target) * 100);
    const speed = Math.min(100, Math.round((pct / Math.max(5, elapsed)) * 100));
    return `${label}: ${render(m.actual)} / ${render(m.target)} hedef = %${pct} gerçekleşme · beklenen %${elapsed} → %${speed} puan`;
  };
  switch (key) {
    case 'commercial':
      return [pace('Ciro', r.revenue, fmtMoney), pace('Satılan cihaz', r.devices), 'Puan = iki oranın ortalaması × 40'];
    case 'bizdev':
      return [
        pace('Lead → Hunter', r.leadToHunter), pace('Hunter → Farmer', r.hunterToFarmer),
        pace('Kazanılan teklif', { actual: r.won.quotes, target: r.won.target }), 'Puan = oranların ortalaması × 20',
      ];
    case 'customer': {
      const pf = r.meetingsPerFirm;
      const perFirm = pf && pf.target ? `Görüşme / firma: ${num(pf.actual)} / ${pf.target} hedef = %${Math.min(100, Math.round((pf.actual / pf.target) * 100))}` : 'Görüşme / firma: hedef yok → hesaba katılmaz';
      const total = r.portfolio.total;
      const active = total > 0 ? `Aktif portföy: ${num(total - r.risks.inactive)} / ${num(total)} firma = %${Math.round((1 - r.risks.inactive / total) * 100)} (hareketsiz ${num(r.risks.inactive)})` : 'Portföy yok → hesaba katılmaz';
      return [perFirm, active, 'Puan = iki oranın ortalaması × 15'];
    }
    case 'activity':
      return [pace('Görüşme (fiziki + online)', r.meetings), 'Puan = oran × 15'];
    case 'crm': {
      const issues = r.risks.staleQuotes + r.risks.overdueClose + r.risks.overdueActions + r.risks.longPoc;
      const base = r.pipeline.openCount + r.activePoc + r.portfolio.total;
      return [
        `Sorunlu kayıt: ${num(issues)} (30+ gün bekleyen teklif ${r.risks.staleQuotes}, kapanışı geçmiş ${r.risks.overdueClose}, aksiyonu geçmiş ${r.risks.overdueActions}, 30+ gün POC ${r.risks.longPoc})`,
        `Takip edilen kayıt: ${num(base)} (açık teklif + aktif POC + portföy)`,
        base > 0 ? `Temiz oran: %${Math.max(0, Math.round((1 - issues / base) * 100))} → puan = oran × 10` : 'Kayıt yok → hesaba katılmaz',
      ];
    }
    default:
      return [];
  }
}

/** Hareket Dökümü: seçilen satıcı dönemde neyi, ne kadar, ne zaman yaptı (müdür, 05.10.2026). */
function Events({ period, owner }: { period: PerfPeriodKind; owner: string | null }) {
  const [data, setData] = useState<PerfEventsPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [filter, setFilter] = useState<PerfEventType | 'all'>('all');
  useEffect(() => {
    let alive = true;
    setState('loading');
    const qs = new URLSearchParams({ period, detail: 'events' });
    if (owner) qs.set('owner', owner);
    fetch(`/api/reports/performance?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((json: PerfEventsPayload) => { if (alive) { setData(json); setState('ok'); } })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [period, owner]);

  const counts = useMemo(() => {
    const m = new Map<string, { n: number; amount: number; devices: number }>();
    for (const e of data?.events ?? []) {
      const c = m.get(e.type) ?? { n: 0, amount: 0, devices: 0 };
      c.n += 1; c.amount += e.amount ?? 0; c.devices += e.devices ?? 0;
      m.set(e.type, c);
    }
    return m;
  }, [data]);
  const rows = (data?.events ?? []).filter((e) => filter === 'all' || e.type === filter);
  const label = (t: PerfEventType) => PERF_EVENT_TYPES.find((x) => x.key === t)?.label ?? t;
  const c = (t: PerfEventType) => counts.get(t);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Tarih', 'Tür', 'Satıcı', 'Firma', 'Detay', 'Tutar', 'Cihaz'].join(';'),
      ...rows.map((e) => [e.date, label(e.type), e.owner, e.customer, e.detail, e.amount ?? '', e.devices ?? ''].map(esc).join(';'))];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hareket-dokumu-${owner ?? 'ekip'}-${data?.range.from ?? ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="pc-section pc-card">
      <div className="pc-title">
        <h2>Hareket Dökümü</h2>
        <span>
          {owner ?? 'Ekip'} · {data?.range.label ?? ''} · kim, neyi, ne kadar, ne zaman
          <button type="button" className="pc-btn" disabled={!rows.length} onClick={exportCsv}>Excel&apos;e aktar</button>
        </span>
      </div>
      {state === 'loading' ? <div className="pc-mini">Yükleniyor…</div> : state === 'error' ? <div className="tone-danger">Hareketler alınamadı.</div> : (
        <>
          <div className="pc-mini">
            {fmt(c('gorusme')?.n ?? 0)} görüşme · {fmt(c('aktivite')?.n ?? 0)} diğer aktivite · {fmt(c('teklif')?.n ?? 0)} teklif ({money(c('teklif')?.amount ?? 0)})
            {' · '}{fmt(c('kazanim')?.n ?? 0)} kazanım ({money(c('kazanim')?.amount ?? 0)}) · {fmt(c('fatura')?.n ?? 0)} fatura ({money(c('fatura')?.amount ?? 0)}, {fmt(c('fatura')?.devices ?? 0)} cihaz)
            {' · '}{fmt(c('cevirme')?.n ?? 0)} kategori değişimi
          </div>
          <div className="pc-filters pc-chips">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tümü ({fmt(data?.events.length ?? 0)})</button>
            {PERF_EVENT_TYPES.map((t) => (
              <button type="button" key={t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>{t.label} ({fmt(c(t.key)?.n ?? 0)})</button>
            ))}
          </div>
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead><tr><th>Tarih</th><th>Tür</th>{owner ? null : <th>Satıcı</th>}<th>Firma</th><th>Detay</th><th className="r">Tutar</th><th className="r">Cihaz</th></tr></thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={i} className={e.href ? 'pc-click' : undefined} title={e.href ? 'Kaydı aç' : undefined}
                    onClick={(ev) => { if (e.href && !(ev.target as HTMLElement).closest('a')) window.open(e.href, '_blank', 'noopener'); }}>
                    <td className="nowrap">{new Date(`${e.date}T00:00:00`).toLocaleDateString('tr-TR')}</td>
                    <td><span className={`pc-tag t-${e.type}`}>{label(e.type)}</span></td>
                    {owner ? null : <td>{e.owner}</td>}
                    <td>{e.customerId ? <a href={`/crm/${e.customerId}`} target="_blank" rel="noreferrer">{e.customer}</a> : e.customer}</td>
                    <td>{e.detail}</td>
                    <td className="r">{e.amount == null ? '' : money(e.amount)}</td>
                    <td className="r">{e.devices == null ? '' : fmt(e.devices)}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={7} className="pc-mini">Bu dönemde hareket yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
          {data?.truncated ? <div className="pc-mini">İlk {fmt(data.events.length)} kayıt gösteriliyor (toplam {fmt(data.total)}).</div> : null}
        </>
      )}
    </div>
  );
}

export default function PerformanceCard() {
  const [period, setPeriod] = useState<PerfPeriodKind>('ytd');
  const [data, setData] = useState<PerfPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'forbidden'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  // Ekip Özeti menüde yok; gizli kısayol Ctrl+G ile aç/kapa (sayfa zaten yalnız karne yetkilisine açık).
  const [showTeam, setShowTeam] = useState(false);
  const prevSelected = useRef('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && (e.code === 'KeyG' || e.key.toLowerCase() === 'g'))) return;
      e.preventDefault();
      e.stopPropagation();
      setShowTeam((on) => {
        // Aç: Ekip Özeti'ne geç, önceki satıcıyı hatırla · Kapat: önceki satıcıya (yoksa özet sayfasına) dön.
        setSelected((cur) => {
          if (!on) { prevSelected.current = cur === TEAM ? '' : cur; return TEAM; }
          return prevSelected.current;
        });
        return !on;
      });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const load = useCallback(async (p: PerfPeriodKind) => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/reports/performance?period=${p}`, { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setStatus('forbidden'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setStatus('ok');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri alınamadı');
      setStatus('error');
    }
  }, []);
  useEffect(() => { void load(period); }, [load, period]);

  if (status === 'forbidden') return <div className="pc-wrap"><div className="pc-card">Bu rapor için yetkiniz yok.</div></div>;
  if (status === 'error') return <div className="pc-wrap"><div className="pc-card">Veri alınamadı: {error} <button type="button" className="pc-btn" onClick={() => void load(period)}>Tekrar dene</button></div></div>;
  if (!data) return <div className="pc-wrap"><div className="pc-card">Yükleniyor…</div></div>;

  const elapsed = data.range.elapsedPct;
  const periodButtons = PERF_PERIODS.map((x) => (
    <button type="button" key={x.key} className={period === x.key ? 'active' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>
  ));

  // İlk açılış: tüm satıcıların özet listesi (puana göre); karta basınca kişinin karnesi açılır.
  if (!selected) {
    const ranked = data.owners
      .map((o) => { const d = perfDimensions(o, elapsed); return { o, d, t: perfTotal(d) }; })
      .sort((a, b) => (b.t ?? -1) - (a.t ?? -1));
    const scored = ranked.filter((x) => x.t != null);
    const avg = scored.length ? Math.round(scored.reduce((s, x) => s + (x.t ?? 0), 0) / scored.length) : null;
    const below = scored.filter((x) => (x.t ?? 0) < 60).length;
    return (
      <div className={`pc-wrap${status === 'loading' ? ' is-loading' : ''}`}>
        <div className="pc-top">
          <div>
            <div className="pc-eyebrow">Retail Sales Performance Report</div>
            <h1>Performans Karnesi</h1>
            <div className="pc-sub">
              {data.range.label} · dönemin %{elapsed}&apos;i geçti · {ranked.length} satıcı · ortalama {avg == null ? NA : `%${avg}`}
              {below ? ` · ${below} kişi %60 altında` : ''}
            </div>
          </div>
          <div className="pc-filters">{periodButtons}</div>
        </div>
        <div className="pc-overview">
          {ranked.map(({ o, d, t }, i) => {
            const g = perfGrade(t);
            const kpi = (label: string, m: Measure, render: (v: number) => string) => {
              const pct = attainmentPct(m);
              return <div className="pc-ov-kpi"><span>{label}</span><b>{render(m.actual)}</b><small className={`tone-${attainmentTone(pct)}`}>{pct == null ? 'hedef yok' : `%${pct}`}</small></div>;
            };
            return (
              <button type="button" key={o.owner} className="pc-card pc-ov" onClick={() => setSelected(o.owner)}>
                <div className="pc-ov-head">
                  <span className="pc-ov-rank">{i + 1}</span>
                  <div className={`pc-ring sm tone-${g.tone}`} style={{ ['--pc-pct' as string]: `${t ?? 0}%` }}><b>{t == null ? NA : `%${t}`}</b></div>
                  <div className="pc-ov-name"><strong>{o.owner}</strong></div>
                </div>
                <div className="pc-ov-kpis">
                  {kpi('Ciro', o.revenue, fmtMoney)}
                  {kpi('Cihaz', o.devices, (v) => v.toLocaleString('tr-TR'))}
                  {kpi('Görüşme', o.meetings, (v) => v.toLocaleString('tr-TR'))}
                </div>
                <div className="pc-ov-dims">
                  {d.map((x) => {
                    const pct = x.score == null ? null : Math.round((x.score / x.weight) * 100);
                    return (
                      <div key={x.key} title={`${x.label}: ${pct == null ? NA : `%${pct}`}`}>
                        <span>{x.label}</span>
                        <span className="pc-progress"><span className={`tone-${perfGrade(pct).tone}`} style={{ width: `${pct ?? 0}%` }} /></span>
                        <small>{pct == null ? NA : `%${pct}`}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="pc-ov-foot">Açık teklif {o.pipeline.openCount} · {fmtMoney(o.pipeline.openAmount)} · hareketsiz {o.risks.inactive} → Karneyi aç</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isTeam = showTeam && selected === TEAM;
  const r = isTeam ? data.team : data.owners.find((o) => o.owner === selected) ?? data.owners[0] ?? data.team;
  const dims = perfDimensions(r, elapsed);
  const total = isTeam
    ? (() => { const s = data.owners.map((o) => perfTotal(perfDimensions(o, elapsed))).filter((v): v is number => v != null); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; })()
    : perfTotal(dims);
  const grade = perfGrade(total);
  const year = Number(data.range.from.slice(0, 4));
  const link = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Omit<Parameters<typeof drilldownHref>[0], 'kind' | 'owner'> = {}) =>
    drilldownHref({ kind, owner: isTeam ? null : r.owner, year, ...extra });
  const ownerQs = isTeam ? '' : `satici=${encodeURIComponent(r.owner)}&`;
  const inactiveHref = `/crm/hareketsiz?${ownerQs}gun=15`;
  const dimHref: Record<string, string> = {
    commercial: link('fatura'),
    bizdev: link('teklif', { state: 'kazanilan' }),
    customer: inactiveHref,
    activity: link('kapsama'),
    crm: link('teklif', { state: 'acik' }),
  };
  const ringStyle ={ ['--pc-pct' as string]: `${total ?? 0}%` };
  const risk = (v: number) => (v ? 'danger' : 'ok') as Tone;
  const p = r.portfolio;

  return (
    <div className={`pc-wrap${status === 'loading' ? ' is-loading' : ''}`}>
      <div className="pc-top">
        <div>
          <button type="button" className="pc-back" onClick={() => setSelected('')}>← Tüm satıcılar</button>
          <div className="pc-eyebrow">Performans Karnesi</div>
          <h1>{r.owner}</h1>
          <div className="pc-sub">{data.range.label} · dönemin %{elapsed}&apos;i geçti</div>
        </div>
        <div className="pc-filters">
          {periodButtons}
          <select value={isTeam ? TEAM : r.owner} onChange={(e) => setSelected(e.target.value)} aria-label="Satıcı">
            {data.owners.map((o) => <option key={o.owner} value={o.owner}>{o.owner}</option>)}
            {showTeam ? <option value={TEAM}>Ekip Özeti</option> : null}
          </select>
        </div>
      </div>

      <div className="pc-grid g4">
        <div className="pc-card pc-score">
          <div className={`pc-ring tone-${grade.tone}`} style={ringStyle}><b>{total == null ? NA : `%${total}`}</b></div>
          <div>
            <div className="pc-label">Genel Performans</div>
            <span className={`pc-grade tone-${grade.tone}`}>{grade.label}</span>
            <div className="pc-mini">{isTeam ? 'Kişi skorlarının ortalaması.' : 'Ticari sonuç, iş geliştirme, müşteri yönetimi, aktivite ve CRM disiplininin ağırlıklı bileşimi.'}</div>
          </div>
        </div>
        <Hero label={`${PERF_PERIODS.find((x) => x.key === period)?.label} Ciro`} m={r.revenue} render={fmtMoney} href={link('fatura')} />
        <Hero label="Satılan Cihaz" m={r.devices} render={(v) => v.toLocaleString('tr-TR')} href={link('cihaz', { mode: 'sale' })} />
        <Hero label="Görüşme" m={r.meetings} render={(v) => v.toLocaleString('tr-TR')} href={link('kapsama')} />
      </div>

      <div className="pc-section">
        <div className="pc-title"><h2>Performans Boyutları</h2><span>ağırlıklı skor · dönemin geçen süresine göre · hedefi olmayan ölçüt hesaba katılmaz</span></div>
        <div className="pc-dims">
          {dims.map((d) => {
            const pct = d.score == null ? null : Math.round((d.score / d.weight) * 100);
            const tone = attainmentTone(pct);
            return (
              <Box href={dimHref[d.key]} className="pc-dim" key={d.key}>
                <div className="pc-dimtop">
                  <div><div className="pc-dimname">{d.label}</div><div className="pc-mini">%{d.weight} ağırlık{d.score == null ? '' : ` · ${d.score}/${d.weight} puan`}</div></div>
                  <div className={`pc-dimscore tone-${tone}`}>{pct == null ? NA : `%${pct}`}</div>
                </div>
                <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${pct ?? 0}%` }} /></div>
                <div className="pc-mini">{d.hint}</div>
                <div className="pc-tip" role="tooltip">
                  <b>{d.label} nasıl hesaplandı?</b>
                  <ul>{dimExplain(d.key, r, elapsed).map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </Box>
            );
          })}
        </div>
      </div>

      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Ticari Sonuç ve Pipeline</h2><span>sonuç + potansiyel · pipeline anlık</span></div>
          <div className="pc-summary">
            <Box href="/crm/forecast" className=""><span>Forecast</span><b className="tone-info">{money(r.pipeline.forecast)}</b></Box>
            <Box href="/crm/forecast" className=""><span>Weighted Forecast</span><b>{money(r.pipeline.weighted)}</b></Box>
            <Box href={link('teklif', { state: 'acik' })} className=""><span>Açık Teklif</span><b>{fmt(r.pipeline.openCount)}</b></Box>
            <Box href={link('teklif', { state: 'acik' })} className=""><span>Açık Teklif Değeri</span><b>{money(r.pipeline.openAmount)}</b></Box>
          </div>
          <div className="pc-rows">
            <Row k="Kazanılan müşteri" v={fmt(r.won.customers)} href={link('teklif', { state: 'kazanilan' })} />
            <Row k="Kazanılan fırsat" v={`${fmt(r.won.quotes)} · ${money(r.won.amount)}`} href={link('teklif', { state: 'kazanilan' })} />
            <Row k="Aktif hizmet cihazı" v={`${fmt(r.service.activeDevices)}${r.service.target != null ? ` / ${fmt(r.service.target)}` : ''}`} href={link('cihaz', { mode: 'rental' })} tone={attainmentTone(attainmentPct({ actual: r.service.activeDevices, target: r.service.target }))} />
            <Row k="Aylık hizmet geliri" v={money(r.service.monthlyRevenue)} href={link('fatura')} />
            <Row k="Kiralanan cihaz (dönem)" v={fmt(r.rentalDevices)} href={link('cihaz', { mode: 'rental' })} />
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Portföy Sağlığı</h2><span>müşteri kapsama ve takip</span></div>
          <div className="pc-summary">
            <Box href={link('portfoy')} className=""><span>Portföy</span><b>{p.listed ? fmt(p.total) : NA}</b></Box>
            <Box href={link('kapsama')} className=""><span>Temas Edilen Müşteri</span><b>{fmt(r.contacted)}</b></Box>
            <Box href={link('kapsama')} className=""><span>Ort. Görüşme / Firma</span><b className={`tone-${attainmentTone(attainmentPct(r.meetingsPerFirm))}`}>{r.meetingsPerFirm ? `${r.meetingsPerFirm.actual.toLocaleString('tr-TR')} / ${r.meetingsPerFirm.target}` : NA}</b></Box>
            <Box href={inactiveHref} className=""><span>Hareketsiz Firma</span><b className={`tone-${risk(r.risks.inactive)}`}>{p.listed ? fmt(r.risks.inactive) : NA}</b></Box>
          </div>
          <div className="pc-rows">
            <Row k="Lead" v={p.listed ? fmt(p.lead) : NA} href={link('portfoy', { segment: 'Lead' })} />
            <Row k="Hunter" v={p.listed ? fmt(p.hunter) : NA} href={link('portfoy', { segment: 'Hunter' })} />
            <Row k="Farmer" v={p.listed ? fmt(p.farmer) : NA} href={link('portfoy', { segment: 'Farmer' })} />
            <Row k="Kasa" v={p.listed ? fmt(p.kasa) : NA} href={link('portfoy', { segment: 'Kasa' })} />
            <Row k="Aktif POC / Konsinye müşteri" v={fmt(r.activePoc)} href={link('poc')} />
          </div>
        </div>
      </div>

      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title">
            <h2>Son 6 Ay Ciro Trendi</h2>
            <div className="pc-legend"><span><i className="pc-dot actual" />Gerçekleşen</span><span><i className="pc-dot target" />Hedef</span></div>
          </div>
          <Trend points={r.trend} href={(y) => link('fatura', { year: y })} />
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Risk ve Süreç Göstergeleri</h2><span>takip gereken noktalar · anlık</span></div>
          <div className="pc-rows">
            <Row k="15/30+ gün hareketsiz müşteri" v={p.listed ? fmt(r.risks.inactive) : NA} tone={risk(r.risks.inactive)} href={inactiveHref} />
            <Row k="30+ gün hareketsiz açık teklif" v={fmt(r.risks.staleQuotes)} tone={r.risks.staleQuotes ? 'warn' : 'ok'} href={link('teklif', { state: 'acik' })} />
            <Row k="30+ gün açık POC" v={fmt(r.risks.longPoc)} tone={r.risks.longPoc ? 'warn' : 'ok'} href={link('poc')} />
            <Row k="Aksiyon tarihi geçmiş" v={fmt(r.risks.overdueActions)} tone={risk(r.risks.overdueActions)} href="/crm/activities" />
            <Row k="Kapanış tarihi geçmiş açık teklif" v={fmt(r.risks.overdueClose)} tone={risk(r.risks.overdueClose)} href={link('teklif', { state: 'acik' })} />
            <Row k="Kesilen fatura (dönem)" v={`${fmt(r.invoices.count)} · ${money(r.invoices.amount)}`} href={link('fatura')} />
          </div>
        </div>
      </div>

      <Events period={period} owner={isTeam ? null : r.owner} />

      <div className="pc-footer">
        Canlı CRM verisi · {new Date(data.generatedAt).toLocaleString('tr-TR')}
        {data.notes.map((n) => <div key={n}>{n}</div>)}
      </div>
    </div>
  );
}
