'use client';

// PERFORMANS KARNESİ — Dashboard açılış sekmesi (05.10.2026, müdür taslağı "Retail Sales Performance
// Report"). Veri: /api/reports/live-board (Canlı Ekran ile aynı sayılar). Skor kuralları:
// lib/reports/performance-card.ts.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { drilldownHref } from '@/lib/reports/drilldown-shared';
import { fmtMoney, type LiveBoardPayload, type LiveOwner, type Tone } from '@/lib/reports/live-board-shared';
import { goalRatio, perfDimensions, perfGrade, perfReview, perfTotal, teamAsOwner } from '@/lib/reports/performance-card';
import '@/styles/performance-card.css';

const TEAM = '__team__';
const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('tr-TR'));
const pctText = (ratio: number | null) => (ratio == null ? 'hedef yok' : `%${Math.round(ratio * 100)} gerçekleşme`);
function toneOf(ratio: number | null, elapsedPct: number): Tone {
  if (ratio == null) return 'neutral';
  const pace = (ratio * 100) / Math.max(5, elapsedPct);
  return pace >= 1 ? 'ok' : pace >= 0.75 ? 'info' : pace >= 0.5 ? 'warn' : 'danger';
}

function Hero({ label, value, sub, ratio, tone }: { label: string; value: string; sub: string; ratio: number | null; tone: Tone }) {
  return (
    <div className="pc-card">
      <div className="pc-label">{label}</div>
      <div className={`pc-value tone-${tone}`}>{value}</div>
      <div className="pc-mini">{sub}</div>
      <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} /></div>
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

export default function PerformanceCard({ active }: { active: boolean }) {
  const [data, setData] = useState<LiveBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(TEAM);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/live-board', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri alınamadı');
    }
  }, []);
  useEffect(() => { if (active && !data) void load(); }, [active, data, load]);

  const owner: LiveOwner | null = useMemo(() => {
    if (!data) return null;
    if (selected === TEAM) return teamAsOwner(data);
    return data.owners.find((o) => o.owner === selected) ?? teamAsOwner(data);
  }, [data, selected]);

  if (!active) return null;
  if (error) return <div className="pc-wrap"><div className="pc-card">Veri alınamadı: {error} <button type="button" onClick={() => void load()}>Tekrar dene</button></div></div>;
  if (!data || !owner) return <div className="pc-wrap"><div className="pc-card">Yükleniyor…</div></div>;

  const isTeam = selected === TEAM;
  const r = owner.revenue;
  const g = owner.goals;
  const elapsed = r.yearElapsedPct;
  const dims = perfDimensions(owner);
  const total = isTeam
    ? (() => { const s = data.owners.map((o) => perfTotal(perfDimensions(o))).filter((v): v is number => v != null); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; })()
    : perfTotal(dims);
  const grade = perfGrade(total);
  const review = perfReview(owner);
  const revRatio = goalRatio({ actual: r.actualYtd, target: r.target, pct: null });
  const devRatio = goalRatio({ actual: r.deviceActualYtd, target: r.deviceTarget, pct: null });
  const visitRatio = goalRatio(g.visitsYear);
  const split = owner.list ?? owner.portfolio;
  const link = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Omit<Parameters<typeof drilldownHref>[0], 'kind' | 'owner'> = {}) =>
    drilldownHref({ kind, owner: isTeam ? null : owner.owner, year: r.year, ...extra });
  const ringStyle = { ['--pc-pct' as string]: `${total ?? 0}%` };

  return (
    <div className="pc-wrap">
      <div className="pc-top">
        <div>
          <div className="pc-eyebrow">Performans Karnesi</div>
          <h1>{owner.owner}</h1>
          <div className="pc-sub">YTD Performans · 01 Ocak – {new Date(`${data.range.today}T12:00:00Z`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })} · yılın %{elapsed}'i geçti</div>
        </div>
        <div className="pc-filters">
          <button type="button" className={isTeam ? 'active' : ''} onClick={() => setSelected(TEAM)}>Ekip Özeti</button>
          {data.owners.map((o) => (
            <button type="button" key={o.owner} className={selected === o.owner ? 'active' : ''} onClick={() => setSelected(o.owner)}>{o.owner}</button>
          ))}
        </div>
      </div>

      <div className="pc-grid g4">
        <div className="pc-card pc-score">
          <div className={`pc-ring tone-${grade.tone}`} style={ringStyle}><b>{total ?? '—'}</b></div>
          <div>
            <div className="pc-label">Genel Performans</div>
            <span className={`pc-grade tone-${grade.tone}`}>{grade.label}</span>
            <div className="pc-mini">{isTeam ? 'Kişi skorlarının ortalaması.' : 'Ticari sonuç, iş geliştirme, müşteri yönetimi, aktivite ve CRM disiplininin ağırlıklı skoru.'}</div>
          </div>
        </div>
        <Hero label="YTD Ciro" value={fmtMoney(r.actualYtd)} sub={`${r.target != null ? `${fmtMoney(r.target)} hedef` : 'hedef yok'} · ${pctText(revRatio)}`} ratio={revRatio} tone={toneOf(revRatio, elapsed)} />
        <Hero label="Satılan Cihaz" value={fmt(r.deviceActualYtd)} sub={`${r.deviceTarget != null ? `${fmt(r.deviceTarget)} hedef` : 'hedef yok'} · ${pctText(devRatio)}`} ratio={devRatio} tone={toneOf(devRatio, elapsed)} />
        <Hero label="Yıllık Görüşme" value={fmt(g.visitsYear.actual)} sub={`${g.visitsYear.target != null ? `${fmt(g.visitsYear.target)} hedef` : 'hedef yok'} · ${pctText(visitRatio)}`} ratio={visitRatio} tone={toneOf(visitRatio, elapsed)} />
      </div>

      <div className="pc-card pc-section">
        <div className="pc-title"><h2>Performans Boyutları</h2><span>YTD ağırlıklı skor · hedefi girilmemiş ölçüt hesaba katılmaz</span></div>
        <div className="pc-dims">
          {dims.map((d) => {
            const ratio = d.score == null ? null : d.score / d.weight;
            const tone: Tone = ratio == null ? 'neutral' : ratio >= 0.85 ? 'ok' : ratio >= 0.7 ? 'info' : ratio >= 0.55 ? 'warn' : 'danger';
            return (
              <div className="pc-dim" key={d.key}>
                <div className="pc-dimtop">
                  <div><div className="pc-dimname">{d.label}</div><div className="pc-mini">%{d.weight} ağırlık</div></div>
                  <div className={`pc-dimscore tone-${tone}`}>{d.score == null ? 'veri yok' : `${d.score}/${d.weight}`}</div>
                </div>
                <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} /></div>
                <div className="pc-mini">{d.hint}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Ticari Sonuç ve Pipeline</h2><span>sonuç + potansiyel</span></div>
          <div className="pc-summary">
            <div><span>Forecast · yıl sonu</span><b>{fmtMoney(r.forecast)}</b></div>
            <div><span>Ağırlıklı Pipeline</span><b>{fmtMoney(r.weightedPipeline)}</b></div>
            <div><span>Açık Teklif</span><b><a href={link('teklif', { state: 'acik' })} target="_blank" rel="noreferrer">{fmt(g.openAll)}</a></b></div>
            <div><span>Açık Teklif Değeri</span><b>{fmtMoney(r.pipeline)}</b></div>
          </div>
          <div className="pc-rows">
            <Row k="Kazanılan teklif" v={`${fmt(owner.quoteBox.won.count)} · ${fmtMoney(owner.quoteBox.won.amount)}`} href={link('teklif', { state: 'kazanilan' })} tone="ok" />
            <Row k="Kaybedilen teklif" v={`${fmt(owner.quoteBox.lost.count)} · ${fmtMoney(owner.quoteBox.lost.amount)}`} href={link('teklif', { state: 'kaybedilen' })} tone={owner.quoteBox.lost.count ? 'danger' : undefined} />
            <Row k="Teklif → Satış oranı" v={r.conversionPct == null ? '—' : `%${r.conversionPct}`} />
            <Row k="Entegre cihaz (YTD)" v={`${fmt(g.integration.actual)}${g.integration.target != null ? ` / ${fmt(g.integration.target)}` : ''}`} />
            <Row k="Entegrasyon geliri (YTD)" v={fmtMoney(g.integrationRevenue.usdYear)} />
            <Row k="Kiralanan cihaz" v={fmt(owner.devices.rental)} href={link('cihaz', { mode: 'rental' })} />
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Portföy Sağlığı</h2><span>müşteri kapsama ve takip</span></div>
          <div className="pc-summary">
            <div><span>Portföy</span><b><a href={link('portfoy')} target="_blank" rel="noreferrer">{fmt(owner.portfolio.total)}</a></b></div>
            <div><span>Temas Edilen Müşteri</span><b>{fmt(owner.coverage.covered.actual)}</b></div>
            <div><span>Ort. Görüşme / Firma</span><b>{isTeam ? '—' : owner.coverage.contactsPer.actual.toLocaleString('tr-TR')}{!isTeam && owner.coverage.contactsPer.target != null ? ` / ${owner.coverage.contactsPer.target}` : ''}</b></div>
            <div><span>Hareketsiz Firma</span><b className={owner.inactive.count ? 'tone-danger' : 'tone-ok'}>{fmt(owner.inactive.count)}</b></div>
          </div>
          <div className="pc-rows">
            <Row k="Hunter" v={fmt(split.hunter)} />
            <Row k="Farmer" v={fmt(split.farmer)} />
            <Row k="Lead" v={fmt(split.lead)} />
            <Row k="Kasa" v={fmt(split.kasa)} />
            <Row k="Aktif POC" v={fmt(owner.pipeline.poc)} href={link('poc')} />
          </div>
        </div>
      </div>

      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Risk ve Süreç Göstergeleri</h2><span>takip gereken noktalar</span></div>
          <div className="pc-rows">
            <Row k={`${owner.inactive.days}+ gün hareketsiz müşteri`} v={fmt(owner.inactive.count)} tone={owner.inactive.count ? 'danger' : 'ok'} />
            <Row k="Süresi dolmuş açık teklif" v={fmt(r.expiredOpenQuotes)} tone={r.expiredOpenQuotes ? 'danger' : 'ok'} />
            <Row k="Kritik bekleyen fırsat" v={fmt(owner.pipeline.staleCritical)} tone={owner.pipeline.staleCritical ? 'warn' : 'ok'} />
            <Row k="Tarihi geçmiş aksiyon" v={fmt(owner.pipeline.overdueActions)} tone={owner.pipeline.overdueActions ? 'danger' : 'ok'} />
            <Row k="Kesilen fatura" v={`${fmt(owner.invoices)} · ${fmtMoney(r.saleYtd.amount)}`} href={link('fatura')} />
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-title"><h2>Çeyrek Durumu · {g.quarter.label}</h2><span>{g.quarter.months} · çeyreğin %{g.quarter.elapsedPct}'i geçti</span></div>
          <div className="pc-rows">
            <Row k="Çeyrek ciro" v={`${fmtMoney(g.budgetQuarter.actual)}${g.budgetQuarter.target != null ? ` / ${fmtMoney(g.budgetQuarter.target)}` : ''}`} tone={toneOf(goalRatio(g.budgetQuarter), g.quarter.elapsedPct)} />
            <Row k="Çeyrek görüşme" v={`${fmt(g.visitsQuarter.actual)}${g.visitsQuarter.target != null ? ` / ${fmt(g.visitsQuarter.target)}` : ''}`} tone={toneOf(goalRatio(g.visitsQuarter), g.quarter.elapsedPct)} />
            <Row k="Hunter → Farmer çevirme" v={`${fmt(g.hunterToFarmer.actual)}${g.hunterToFarmer.target != null ? ` / ${fmt(g.hunterToFarmer.target)}` : ''}`} />
            <Row k="Lead → Hunter çevirme" v={`${fmt(g.leadToHunter.actual)}${g.leadToHunter.target != null ? ` / ${fmt(g.leadToHunter.target)}` : ''}`} />
            <Row k="Bu hafta aktivite" v={`${fmt(owner.actual.totalActivities)}${owner.target.totalActivities ? ` / ${fmt(owner.target.totalActivities)}` : ''}`} />
          </div>
        </div>
      </div>

      <div className="pc-card pc-section">
        <div className="pc-title"><h2>Yönetici Değerlendirmesi</h2><span>İK görüşmesi için kısa özet · kurallarla otomatik üretilir</span></div>
        <div className="pc-focus">
          <div><h3 className="tone-ok">Güçlü Alanlar</h3><ul>{(review.strong.length ? review.strong : ['Belirgin güçlü alan çıkmadı.']).map((t) => <li key={t}>{t}</li>)}</ul></div>
          <div><h3 className="tone-warn">Gelişim Alanları</h3><ul>{(review.improve.length ? review.improve : ['Belirgin gelişim alanı çıkmadı.']).map((t) => <li key={t}>{t}</li>)}</ul></div>
          <div><h3 className="tone-info">Sonraki Dönem Odağı</h3><ul>{review.focus.map((t) => <li key={t}>{t}</li>)}</ul></div>
        </div>
      </div>
      <div className="pc-footer">Canlı CRM verisi · {new Date(data.generatedAt).toLocaleString('tr-TR')} · sayılar Canlı Ekran ile aynı kaynaktan</div>
    </div>
  );
}
