'use client';

// PERFORMANS KARNESİ — Retail Sales Performance Report V1 (05.10.2026, müdür taslağı v2).
// Veri: /api/reports/performance?period=… (report.performance.read). Kurallar: lib/reports/performance-card.ts.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { drilldownHref } from '@/lib/reports/drilldown-shared';
import { fmtMoney, type Tone } from '@/lib/reports/live-board-shared';
import {
  PERF_PERIODS, attainmentPct, attainmentTone, perfDimensions, perfGrade, perfTotal,
  type Measure, type PerfOwnerReport, type PerfPayload, type PerfPeriodKind,
} from '@/lib/reports/performance-card';
import '@/styles/performance-card.css';

const TEAM = '__team__';
const NA = 'N/A';
const fmt = (v: number | null | undefined) => (v == null ? NA : v.toLocaleString('tr-TR'));
const money = (v: number | null | undefined) => (v == null ? NA : fmtMoney(v));

function Hero({ label, m, render }: { label: string; m: Measure; render: (v: number) => string }) {
  const pct = attainmentPct(m);
  const tone = attainmentTone(pct);
  return (
    <div className="pc-card">
      <div className="pc-label">{label}</div>
      <div className={`pc-value tone-${pct == null ? 'info' : tone}`}>{render(m.actual)}</div>
      <div className="pc-mini">{m.target != null ? `${render(m.target)} hedef · %${pct} gerçekleşme` : 'hedef girilmemiş · N/A'}</div>
      <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
    </div>
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

function Trend({ points }: { points: PerfOwnerReport['trend'] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.actual, p.target ?? 0)));
  return (
    <div className="pc-chart">
      {points.map((p) => (
        <div className="pc-month" key={p.month} title={`${p.label}: ${fmtMoney(p.actual)} / ${p.target == null ? 'hedef yok' : fmtMoney(p.target)}`}>
          <div className="pc-bars">
            <i className="pc-bar actual" style={{ height: `${(p.actual / max) * 100}%` }} />
            <i className="pc-bar target" style={{ height: `${((p.target ?? 0) / max) * 100}%` }} />
          </div>
          <small>{p.label}</small>
          <small className="pc-mini">{fmtMoney(p.actual)}</small>
        </div>
      ))}
    </div>
  );
}

const REVIEW_FIELDS = [
  { key: 'strong', title: 'Güçlü Alanlar', tone: 'ok' },
  { key: 'improve', title: 'Gelişim Alanları', tone: 'warn' },
  { key: 'focus', title: 'Sonraki Dönem Odağı', tone: 'info' },
] as const;
type ReviewKey = (typeof REVIEW_FIELDS)[number]['key'];

function Review({ report, periodKey, canEdit, onSaved }: { report: PerfOwnerReport; periodKey: string; canEdit: boolean; onSaved: () => void }) {
  const initial = useMemo(() => ({ strong: report.review?.strong ?? '', improve: report.review?.improve ?? '', focus: report.review?.focus ?? '' }), [report]);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  useEffect(() => { setDraft(initial); setEditing(false); }, [initial]);

  const save = async () => {
    setState('saving');
    try {
      const res = await fetch('/api/reports/performance', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerKey: report.key, periodKey, ...draft }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('idle');
      setEditing(false);
      onSaved();
    } catch {
      setState('error');
    }
  };
  const lines = (text: string) => text.split('\n').map((t) => t.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className="pc-section">
      <div className="pc-title">
        <h2>Yönetici Değerlendirmesi</h2>
        <span>
          İK görüşmesi için kısa özet · {report.review?.updatedAt ? `${report.review.updatedBy ?? ''} · ${new Date(report.review.updatedAt).toLocaleString('tr-TR')}` : 'henüz yazılmadı'}
          {canEdit && !editing ? <button type="button" className="pc-btn" onClick={() => setEditing(true)}>Düzenle</button> : null}
        </span>
      </div>
      <div className="pc-focus">
        {REVIEW_FIELDS.map((f) => (
          <div className="pc-card" key={f.key}>
            <h3 className={`tone-${f.tone}`}>{f.title}</h3>
            {editing ? (
              <textarea
                className="pc-textarea" rows={5} value={draft[f.key as ReviewKey]} placeholder="Her satır bir madde"
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            ) : lines(initial[f.key as ReviewKey]).length ? (
              <ul>{lines(initial[f.key as ReviewKey]).map((t, i) => <li key={i}>{t}</li>)}</ul>
            ) : <div className="pc-mini">Değerlendirme girilmemiş.</div>}
          </div>
        ))}
      </div>
      {editing ? (
        <div className="pc-actions">
          <button type="button" className="pc-btn primary" disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}</button>
          <button type="button" className="pc-btn" onClick={() => { setDraft(initial); setEditing(false); setState('idle'); }}>Vazgeç</button>
          {state === 'error' ? <span className="tone-danger">Kaydedilemedi.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PerformanceCard() {
  const [period, setPeriod] = useState<PerfPeriodKind>('ytd');
  const [data, setData] = useState<PerfPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'forbidden'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(TEAM);

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

  const isTeam = selected === TEAM;
  const r = isTeam ? data.team : data.owners.find((o) => o.owner === selected) ?? data.team;
  const elapsed = data.range.elapsedPct;
  const dims = perfDimensions(r, elapsed);
  const total = isTeam
    ? (() => { const s = data.owners.map((o) => perfTotal(perfDimensions(o, elapsed))).filter((v): v is number => v != null); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; })()
    : perfTotal(dims);
  const grade = perfGrade(total);
  const year = Number(data.range.from.slice(0, 4));
  const link = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Omit<Parameters<typeof drilldownHref>[0], 'kind' | 'owner'> = {}) =>
    drilldownHref({ kind, owner: isTeam ? null : r.owner, year, ...extra });
  const ringStyle = { ['--pc-pct' as string]: `${total ?? 0}%` };
  const risk = (v: number) => (v ? 'danger' : 'ok') as Tone;
  const p = r.portfolio;

  return (
    <div className={`pc-wrap${status === 'loading' ? ' is-loading' : ''}`}>
      <div className="pc-top">
        <div>
          <div className="pc-eyebrow">Retail Sales Performance Report</div>
          <h1>{r.owner}</h1>
          <div className="pc-sub">{data.range.label} · dönemin %{elapsed}&apos;i geçti</div>
        </div>
        <div className="pc-filters">
          {PERF_PERIODS.map((x) => (
            <button type="button" key={x.key} className={period === x.key ? 'active' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>
          ))}
          <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Satıcı">
            {data.owners.map((o) => <option key={o.owner} value={o.owner}>{o.owner}</option>)}
            <option value={TEAM}>Ekip Özeti</option>
          </select>
        </div>
      </div>

      <div className="pc-grid g4">
        <div className="pc-card pc-score">
          <div className={`pc-ring tone-${grade.tone}`} style={ringStyle}><b>{total ?? NA}</b></div>
          <div>
            <div className="pc-label">Genel Performans</div>
            <span className={`pc-grade tone-${grade.tone}`}>{grade.label}</span>
            <div className="pc-mini">{isTeam ? 'Kişi skorlarının ortalaması.' : 'Ticari sonuç, iş geliştirme, müşteri yönetimi, aktivite ve CRM disiplininin ağırlıklı bileşimi.'}</div>
          </div>
        </div>
        <Hero label={`${PERF_PERIODS.find((x) => x.key === period)?.label} Ciro`} m={r.revenue} render={fmtMoney} />
        <Hero label="Satılan Cihaz" m={r.devices} render={(v) => v.toLocaleString('tr-TR')} />
        <Hero label="Görüşme" m={r.meetings} render={(v) => v.toLocaleString('tr-TR')} />
      </div>

      <div className="pc-section">
        <div className="pc-title"><h2>Performans Boyutları</h2><span>ağırlıklı skor · dönemin geçen süresine göre · hedefi olmayan ölçüt hesaba katılmaz</span></div>
        <div className="pc-dims">
          {dims.map((d) => {
            const pct = d.score == null ? null : Math.round((d.score / d.weight) * 100);
            const tone = attainmentTone(pct);
            return (
              <div className="pc-dim" key={d.key}>
                <div className="pc-dimtop">
                  <div><div className="pc-dimname">{d.label}</div><div className="pc-mini">%{d.weight} ağırlık</div></div>
                  <div className={`pc-dimscore tone-${tone}`}>{d.score == null ? NA : `${d.score}/${d.weight}`}</div>
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
          <div className="pc-title"><h2>Ticari Sonuç ve Pipeline</h2><span>sonuç + potansiyel · pipeline anlık</span></div>
          <div className="pc-summary">
            <div><span>Forecast</span><b className="tone-info">{money(r.pipeline.forecast)}</b></div>
            <div><span>Weighted Forecast</span><b>{money(r.pipeline.weighted)}</b></div>
            <div><span>Açık Teklif</span><b><a href={link('teklif', { state: 'acik' })} target="_blank" rel="noreferrer">{fmt(r.pipeline.openCount)}</a></b></div>
            <div><span>Açık Teklif Değeri</span><b>{money(r.pipeline.openAmount)}</b></div>
          </div>
          <div className="pc-rows">
            <Row k="Kazanılan müşteri" v={fmt(r.won.customers)} />
            <Row k="Kazanılan fırsat" v={`${fmt(r.won.quotes)} · ${money(r.won.amount)}`} href={link('teklif', { state: 'kazanilan' })} />
            <Row k="Aktif hizmet cihazı" v={`${fmt(r.service.activeDevices)}${r.service.target != null ? ` / ${fmt(r.service.target)}` : ''}`} tone={attainmentTone(attainmentPct({ actual: r.service.activeDevices, target: r.service.target }))} />
            <Row k="Aylık hizmet geliri" v={money(r.service.monthlyRevenue)} />
            <Row k="Kiralanan cihaz (dönem)" v={fmt(r.rentalDevices)} href={link('cihaz', { mode: 'rental' })} />
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Portföy Sağlığı</h2><span>müşteri kapsama ve takip</span></div>
          <div className="pc-summary">
            <div><span>Portföy</span><b><a href={link('portfoy')} target="_blank" rel="noreferrer">{p.listed ? fmt(p.total) : NA}</a></b></div>
            <div><span>Temas Edilen Müşteri</span><b>{fmt(r.contacted)}</b></div>
            <div><span>Ort. Görüşme / Firma</span><b className={`tone-${attainmentTone(attainmentPct(r.meetingsPerFirm))}`}>{r.meetingsPerFirm ? `${r.meetingsPerFirm.actual.toLocaleString('tr-TR')} / ${r.meetingsPerFirm.target}` : NA}</b></div>
            <div><span>Hareketsiz Firma</span><b className={`tone-${risk(r.risks.inactive)}`}>{p.listed ? fmt(r.risks.inactive) : NA}</b></div>
          </div>
          <div className="pc-rows">
            <Row k="Lead" v={p.listed ? fmt(p.lead) : NA} />
            <Row k="Hunter" v={p.listed ? fmt(p.hunter) : NA} />
            <Row k="Farmer" v={p.listed ? fmt(p.farmer) : NA} />
            <Row k="Kasa" v={p.listed ? fmt(p.kasa) : NA} />
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
          <Trend points={r.trend} />
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Risk ve Süreç Göstergeleri</h2><span>takip gereken noktalar · anlık</span></div>
          <div className="pc-rows">
            <Row k="15/30+ gün hareketsiz müşteri" v={p.listed ? fmt(r.risks.inactive) : NA} tone={risk(r.risks.inactive)} />
            <Row k="30+ gün hareketsiz açık teklif" v={fmt(r.risks.staleQuotes)} tone={r.risks.staleQuotes ? 'warn' : 'ok'} />
            <Row k="30+ gün açık POC" v={fmt(r.risks.longPoc)} tone={r.risks.longPoc ? 'warn' : 'ok'} />
            <Row k="Aksiyon tarihi geçmiş" v={fmt(r.risks.overdueActions)} tone={risk(r.risks.overdueActions)} />
            <Row k="Kapanış tarihi geçmiş açık teklif" v={fmt(r.risks.overdueClose)} tone={risk(r.risks.overdueClose)} />
            <Row k="Kesilen fatura (dönem)" v={`${fmt(r.invoices.count)} · ${money(r.invoices.amount)}`} href={link('fatura')} />
          </div>
        </div>
      </div>

      <Review report={r} periodKey={data.range.periodKey} canEdit={data.canEditReview} onSaved={() => void load(period)} />

      <div className="pc-footer">
        Canlı CRM verisi · {new Date(data.generatedAt).toLocaleString('tr-TR')}
        {data.notes.map((n) => <div key={n}>{n}</div>)}
      </div>
    </div>
  );
}
