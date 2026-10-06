'use client';

// CANLI EKRAN (05.10.2026, müdür: "slayt istemiyorum, karne mantığında net olsun").
// Eski dönen pano + Takip Listesi + Kişi Bazlı Aktivite + Faz sekmeleri TEK sayfada, dönmeyen,
// her sayı tıklanır. Veri: /api/reports/live-board (takım) + /api/reports/seller-followup (takip).
// Tasarım: Performans Karnesi (styles/performance-card.css, pc-*).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { drilldownHref } from '@/lib/reports/drilldown-shared';
import { fmtMoney, normalizeName, type AlertItem, type Distribution, type LiveBoardPayload, type Tone } from '@/lib/reports/live-board-shared';
import { attainmentTone } from '@/lib/reports/performance-card';
import { WEEKLY_TARGET_LABELS, sumKinds } from '@/lib/reports/weekly-targets-shared';
import { Box, Row } from '@/components/reports/PerformanceCard';
import '@/styles/performance-card.css';

type FollowupRow = {
  customerId: string; musteri: string; sektor: string | null; sorumlu: string | null; konuKimde: string;
  modelAdetLabel: string; totalQuantity: number; takipKonusu: string; cozumTarihi: string | null; overdue: boolean; nearTerm: boolean;
};
type FollowupPayload = { summary: { openFollowupCount: number; totalQuantity: number; nearTermQuantity: number }; rows: FollowupRow[] };

const NA = '—';
const fmt = (v: number | null | undefined) => (v == null ? NA : Number(v).toLocaleString('tr-TR'));
const pct = (a: number, t: number | null | undefined) => (t && t > 0 ? Math.round((a / t) * 100) : null);
const day = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('.') : NA);
const cust = (id: string | null | undefined) => (id ? `/crm/${id}` : undefined);

const ALERTS: Array<{ kind: AlertItem['kind']; title: string; hint: string }> = [
  { kind: 'overdue', title: 'Geciken Aksiyon', hint: 'tarihi geçmiş sonraki adım' },
  { kind: 'stale', title: 'Hareketsiz Fırsat', hint: 'uzun süredir dokunulmamış' },
  { kind: 'poc_delay', title: 'POC Gecikmesi', hint: 'hedef tarihi geçen POC / test' },
  { kind: 'expired_quote', title: 'Süresi Dolan Teklif', hint: 'kapatılmamış açık teklif' },
  { kind: 'customer_waiting', title: 'Müşteri Bekleniyor', hint: 'top müşteride' },
  { kind: 'contract_waiting', title: 'Sözleşme Bekliyor', hint: 'sözleşme fazında' },
  { kind: 'target_gap', title: 'Hedef Açığı', hint: 'forecast yıllık hedefin altında' },
  { kind: 'portfolio_load', title: 'Portföy Yükü', hint: 'tek sorumluda fazla firma' },
];

/** KPI kartı: değer, hedef ve hedefe göre ilerleme çubuğu. */
function Kpi({ label, value, target, sub, href, ratio }: { label: string; value: string; target?: string | null; sub?: string; href?: string; ratio: number | null }) {
  const tone = ratio == null ? 'info' : attainmentTone(ratio);
  return (
    <Box href={href} className="pc-card">
      <div className="pc-label">{label}</div>
      <div className={`pc-value tone-${tone}`}>{value}</div>
      <div className="pc-mini">{target ? `${target} hedef · %${ratio ?? 0}` : sub ?? 'hedef girilmemiş'}</div>
      <div className="pc-progress"><span className={`tone-${tone}`} style={{ width: `${Math.min(100, ratio ?? 0)}%` }} /></div>
    </Box>
  );
}

/** Yatay dağılım çubukları (portföy, faz, kayıp nedeni…). */
function Bars({ rows, href }: { rows: Distribution; href?: (label: string) => string | undefined }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="cc-bars">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="cc-bar-label" title={r.hint}>{r.label}</span>
            <span className="pc-progress"><span className={`tone-${r.tone ?? 'info'}`} style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <b>{fmt(r.value)}</b>
          </>
        );
        const h = href?.(r.label);
        return h ? <a key={r.label} href={h} target="_blank" rel="noreferrer" className="cc-bar pc-link">{inner}</a> : <div key={r.label} className="cc-bar">{inner}</div>;
      })}
    </div>
  );
}

/** İlk N satır + "tümünü göster" — uzun listeler sayfayı boğmasın. */
function useMore(limit: number) {
  const [all, setAll] = useState(false);
  const more = (total: number) => (total > limit ? (
    <button type="button" className="pc-btn cc-more" onClick={() => setAll((v) => !v)}>{all ? 'Daha az göster' : `Tümünü göster (${total})`}</button>
  ) : null);
  return { take: <T,>(rows: T[]) => (all ? rows : rows.slice(0, limit)), more };
}

/** Kişi kartları (Canlı Ekran verisi, karne tasarımı): kaydırmasız; sayfalar yavaşça geçer, üzerine gelince durur. */
const CARD_PAGE = 6;
const CARD_MS = 12000;
const pctOf = (a: number, b: number | null | undefined) => (b && b > 0 ? Math.round((a / b) * 100) : null);
const toneOf = (p: number | null) => (p == null ? 'neutral' : p >= 90 ? 'ok' : p >= 60 ? 'info' : p >= 35 ? 'warn' : 'danger');

function LiveCard({ o, rank, onOpen }: { o: LiveBoardPayload['owners'][number]; rank: number; onOpen: () => void }) {
  const rv = o.revenue;
  const ring = rv.attainmentPct;
  const meet = sumKinds(o.actual, ['salesPhysical', 'salesOnline']);
  const meetT = sumKinds(o.target, ['salesPhysical', 'salesOnline']);
  const cont = sumKinds(o.actual, ['salesPhone', 'salesEmail']);
  const contT = sumKinds(o.target, ['salesPhone', 'salesEmail']);
  const bars: Array<{ label: string; v: string; p: number | null }> = [
    { label: 'Görüşme (hafta)', v: `${meet}/${meetT || '–'}`, p: pctOf(meet, meetT) },
    { label: 'Temas (hafta)', v: `${cont}/${contT || '–'}`, p: pctOf(cont, contT) },
    { label: 'Cihaz (yıl)', v: `${rv.deviceActualYtd}/${rv.deviceTarget ?? '–'}`, p: pctOf(rv.deviceActualYtd, rv.deviceTarget) },
    { label: 'Forecast', v: fmtMoney(rv.forecast), p: rv.forecastPct },
    { label: 'Aktif portföy', v: `${o.portfolio.active}/${o.portfolio.total}`, p: pctOf(o.portfolio.active, o.portfolio.total) },
  ];
  const kpi = (label: string, v: string, sub: string, tone: string) => (
    <div className="pc-ov-kpi"><span>{label}</span><b>{v}</b><small className={`tone-${tone}`}>{sub}</small></div>
  );
  return (
    <button type="button" className={`pc-card pc-ov cc-live tone-b-${toneOf(ring)}`} onClick={onOpen}>
      <div className="pc-ov-head">
        <span className="pc-ov-rank">{rank}</span>
        <div className={`pc-ring sm tone-${toneOf(ring)}`} style={{ ['--pc-pct' as string]: `${Math.min(100, ring ?? 0)}%` }}><b>{ring == null ? '–' : `%${ring}`}</b></div>
        <div className="pc-ov-name"><strong>{o.owner}</strong><small className="pc-mini">bugün {o.todayActivities} aktivite{o.jira ? ` · Jira ${o.jira.open}` : ''}</small></div>
      </div>
      <div className="pc-ov-kpis">
        {kpi('Ciro', fmtMoney(rv.actualYtd), rv.target ? `hedef ${fmtMoney(rv.target)}` : 'hedef yok', toneOf(ring))}
        {kpi('Açık teklif', String(rv.openQuotes), fmtMoney(rv.pipeline), rv.expiredOpenQuotes ? 'warn' : 'neutral')}
        {kpi('Haftalık', `${o.actual.totalActivities}`, o.achievementPct == null ? 'hedef yok' : `%${o.achievementPct}`, toneOf(o.achievementPct))}
      </div>
      <div className="pc-ov-dims">
        {bars.map((b) => (
          <div key={b.label} title={`${b.label}: ${b.v}`}>
            <span>{b.label}</span>
            <span className="pc-progress"><span className={`tone-${toneOf(b.p)}`} style={{ width: `${Math.min(100, b.p ?? 0)}%` }} /></span>
            <small>{b.p == null ? b.v : `%${b.p}`}</small>
          </div>
        ))}
      </div>
      <div className="pc-ov-foot">Bu hafta {o.quotes.weekCount} teklif · {fmtMoney(o.quotes.weekAmount)}{rv.expiredOpenQuotes ? ` · süresi geçmiş ${rv.expiredOpenQuotes}` : ''} → Detayı aç</div>
    </button>
  );
}

function PersonCards({ owners, onOpen }: { owners: LiveBoardPayload['owners']; onOpen: (owner: string) => void }) {
  const [page, setPage] = useState(0);
  const [fade, setFade] = useState(true);
  const [paused, setPaused] = useState(false);
  const pages = Math.max(1, Math.ceil(owners.length / CARD_PAGE));
  useEffect(() => {
    if (paused || pages < 2) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setFade(false);
      swap = setTimeout(() => { setPage((p) => (p + 1) % pages); setFade(true); }, 900);
    }, CARD_MS);
    return () => { clearInterval(id); if (swap) clearTimeout(swap); };
  }, [paused, pages]);
  const cur = page % pages;
  return (
    <div className="cc-cards" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={`pc-overview cc-cards-page${fade ? ' is-in' : ''}`}>
        {owners.slice(cur * CARD_PAGE, cur * CARD_PAGE + CARD_PAGE).map((o, i) => (
          <LiveCard key={o.owner} o={o} rank={cur * CARD_PAGE + i + 1} onOpen={() => onOpen(o.owner)} />
        ))}
      </div>
      {pages > 1 ? (
        <div className="cc-dots">
          {Array.from({ length: pages }, (_, i) => (
            <button type="button" key={i} className={i === cur ? 'active' : ''} aria-label={`Sayfa ${i + 1}`} onClick={() => { setPage(i); setFade(true); }} />
          ))}
          <span className="pc-mini">{paused ? 'durdu' : `${CARD_MS / 1000} sn'de geçer`}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function CommandCenter() {
  const [data, setData] = useState<LiveBoardPayload | null>(null);
  const [follow, setFollow] = useState<FollowupPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [alertKind, setAlertKind] = useState<AlertItem['kind'] | null>(null);
  const [sel, setSel] = useState('');
  const [view, setView] = useState<'cards' | 'detail'>('cards');
  const hot = useMore(6);
  const poc = useMore(6);
  const fol = useMore(10);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [a, b] = await Promise.all([
        fetch('/api/reports/live-board', { cache: 'no-store' }),
        fetch('/api/reports/seller-followup', { cache: 'no-store' }),
      ]);
      const ja = await a.json();
      if (!a.ok) throw new Error(ja?.message || `HTTP ${a.status}`);
      setData(ja as LiveBoardPayload);
      setFollow(b.ok ? ((await b.json()) as FollowupPayload) : null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const followRows = useMemo(
    () => [...(follow?.rows ?? [])].sort((x, y) => Number(y.overdue) - Number(x.overdue) || Number(y.nearTerm) - Number(x.nearTerm) || (x.cozumTarihi ?? '9').localeCompare(y.cozumTarihi ?? '9')),
    [follow],
  );

  if (status === 'error' && !data) return <div className="pc-wrap"><div className="pc-card">Veri alınamadı: {error} <button type="button" className="pc-btn" onClick={() => void load()}>Tekrar dene</button></div></div>;
  if (!data) return <div className="pc-wrap"><div className="pc-card">Yükleniyor…</div></div>;

  const t = data.team;
  // Kişi seçiliyse tüm sayfa o kişiye süzülür (takım verisi yerine kişinin bloğu).
  const so = sel ? data.owners.find((x) => x.owner === sel) ?? null : null;
  const same = (n: string | null | undefined) => !so || (!!n && normalizeName(n) === normalizeName(so.owner));
  const rv = so?.revenue ?? t.revenue;
  const act = so?.actual ?? t.actual;
  const tgt = so?.target ?? t.target;
  const alerts = t.alerts.filter((a) => same(a.owner));
  const hotRows = t.hot.filter((h) => same(h.owner));
  const pocRows = t.poc.filter((p) => same(p.owner));
  const folRows = followRows.filter((r) => same(r.sorumlu));
  const year = data.range.year;
  const dd = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Omit<Parameters<typeof drilldownHref>[0], 'kind'> = {}) => drilldownHref({ kind, year, owner: so?.owner ?? null, ...extra });
  const meet = act.salesPhysical + act.salesOnline;
  const meetT = tgt.salesPhysical + tgt.salesOnline;
  const cl = data.customerList;
  const alertRows = alertKind ? alerts.filter((a) => a.kind === alertKind) : [];
  const q = data.quotes;
  const owners = [...data.owners].sort((a, b) => (b.revenue.attainmentPct ?? -1) - (a.revenue.attainmentPct ?? -1));

  return (
    <div className={`pc-wrap${status === 'loading' ? ' is-loading' : ''}`}>
      <div className="pc-top">
        <div>
          <div className="pc-eyebrow">Canlı Ekran · {so ? 'Kişi' : 'Takım'}</div>
          <h1>{so ? so.owner : 'Takım Durumu'}</h1>
          <div className="pc-sub">{year} · yılın %{rv.yearElapsedPct}&apos;i geçti · {so ? `ekipte ciro sırası ${owners.findIndex((x) => x.owner === so.owner) + 1}/${owners.length}` : `${t.ownerCount} satıcı`} · bu hafta {data.range.label} · güncelleme {new Date(data.generatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="pc-filters">
          <button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => { setView('cards'); setSel(''); }}>Kişi Kartları</button>
          <button type="button" className={view === 'detail' ? 'active' : ''} onClick={() => setView('detail')}>Detay</button>
          <select value={sel} onChange={(e) => { setSel(e.target.value); setAlertKind(null); setView('detail'); }} aria-label="Satıcı">
            <option value="">Tüm ekip</option>
            {owners.map((o) => <option key={o.owner} value={o.owner}>{o.owner}</option>)}
          </select>
          <button type="button" onClick={() => void load()} disabled={status === 'loading'}>{status === 'loading' ? 'Yükleniyor…' : 'Yenile'}</button>
        </div>
      </div>

      {view === 'cards' ? <PersonCards owners={owners} onOpen={(o) => { setSel(o); setAlertKind(null); setView('detail'); }} /> : (<>
      {/* 1 — Ana göstergeler */}
      <div className="pc-grid cc-g5">
        <Kpi label="Ciro (YTD)" value={fmtMoney(rv.actualYtd)} target={rv.target != null ? fmtMoney(rv.target) : null} ratio={rv.attainmentPct} href={dd('fatura')} />
        <Kpi label="Satılan Cihaz (YTD)" value={fmt(rv.deviceActualYtd)} target={rv.deviceTarget != null ? fmt(rv.deviceTarget) : null} ratio={pct(rv.deviceActualYtd, rv.deviceTarget)} href={dd('cihaz', { mode: 'sale' })} />
        <Kpi label="Görüşme (bu hafta)" value={fmt(meet)} target={meetT ? fmt(meetT) : null} ratio={pct(meet, meetT)} href={dd('kapsama')} />
        <Kpi label="Açık Teklif" value={fmtMoney(rv.pipeline)} sub={`${fmt(rv.openQuotes)} teklif · ağırlıklı ${fmtMoney(rv.weightedPipeline)}${rv.expiredOpenQuotes ? ` · ${rv.expiredOpenQuotes} süresi dolmuş` : ''}`} ratio={null} href={dd('teklif', { state: 'acik' })} />
        <Kpi label="Yıl Sonu Forecast" value={fmtMoney(rv.forecast)} target={rv.target != null ? fmtMoney(rv.target) : null} ratio={rv.forecastPct} href="/crm/forecast" />
        <Kpi label="Entegrasyon" value={fmt(rv.integrationDone)} target={rv.integrationTarget != null ? fmt(rv.integrationTarget) : null} sub={`${fmt(rv.integrationTotal)} entegrasyon firması`} ratio={pct(rv.integrationDone, rv.integrationTarget)} href="/crm/reports/entegrasyon-raporu" />
      </div>
      <div className="pc-section pc-card">
        <div className="pc-title"><h2>Özet</h2><span>takım toplamı · yıl içi ve bu ay</span></div>
        <div className="pc-summary">
          <Box href={dd('teklif', { state: 'kazanilan' })} className=""><span>Kazanılan (YTD)</span><b className="tone-ok">{fmt(rv.wonYtd.count)} · {fmtMoney(rv.wonYtd.amount)}</b></Box>
          <Box href={dd('teklif', { state: 'kazanilan' })} className=""><span>Kazanılan (bu ay)</span><b>{fmt(rv.wonMonth.count)} · {fmtMoney(rv.wonMonth.amount)}</b></Box>
          <Box href={dd('fatura')} className=""><span>Satış (bu ay)</span><b>{fmt(rv.saleMonth.count)} · {fmtMoney(rv.saleMonth.amount)}</b></Box>
          <div><span>Kalan hedef</span><b className="tone-warn">{rv.remaining == null ? NA : fmtMoney(rv.remaining)}</b></div>
        </div>
        <div className="pc-rows">
          <Row k="Aktif satış sürecindeki firma" v={fmt((so ?? t).pipeline.activeCustomers)} href={dd('portfoy')} />
          <Row k="Potansiyel cihaz / değer" v={`${fmt((so ?? t).pipeline.potentialDevices)} · ${fmtMoney((so ?? t).pipeline.potentialValue)}`} href="/crm/forecast" />
          <Row k="Planlı aksiyon / geciken" v={`${fmt((so ?? t).pipeline.plannedActions)} / ${fmt((so ?? t).pipeline.overdueActions)}`} tone={(so ?? t).pipeline.overdueActions ? 'danger' : 'ok'} href="/crm/activities" />
          <Row k="Bugün girilen aktivite" v={fmt((so ?? t).todayActivities)} href="/crm/activities" />
          <Row k="Bu hafta / bu ay açılan teklif" v={`${fmt((so ?? t).quotes.weekCount)} · ${fmtMoney((so ?? t).quotes.weekAmount)} / ${fmt((so ?? t).quotes.monthCount)} · ${fmtMoney((so ?? t).quotes.monthAmount)}`} href={dd('teklif', { state: 'acik' })} />
          <Row k="İptal edilen satış (YTD)" v={fmt(rv.saleCancelled)} />
        </div>
      </div>

      {/* 2 — Yönetim uyarıları */}
      <div className="pc-section">
        <div className="pc-title"><h2>Yönetim Uyarıları</h2><span>aksiyon gerektiren başlıklar · karta bas, liste açılsın</span></div>
        <div className="cc-alerts">
          {ALERTS.map((a) => {
            const n = so ? alerts.filter((x) => x.kind === a.kind).length : t.alertCounts[a.kind] ?? 0;
            const tone: Tone = n === 0 ? 'ok' : a.kind === 'overdue' || a.kind === 'poc_delay' || a.kind === 'target_gap' ? 'danger' : 'warn';
            return (
              <button type="button" key={a.kind} disabled={!n} className={`pc-card cc-alert tone-b-${tone}${alertKind === a.kind ? ' active' : ''}`} onClick={() => setAlertKind(alertKind === a.kind ? null : a.kind)}>
                <b className={`tone-${tone}`}>{fmt(n)}</b>
                <span>{a.title}</span>
                <small>{a.hint}</small>
              </button>
            );
          })}
        </div>
        {alertKind ? (
          <div className="pc-card cc-list">
            <table className="pc-table">
              <thead><tr><th>Başlık</th><th>Detay</th><th>Sorumlu</th><th>Gün</th></tr></thead>
              <tbody>
                {alertRows.map((a, i) => (
                  <tr key={`${a.title}-${i}`}><td><b className={`tone-${a.tone}`}>{a.title}</b></td><td>{a.detail}</td><td>{a.owner ?? NA}</td><td>{a.days ?? NA}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* 3 — Hot Pipeline + POC */}
      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Hot Pipeline</h2><span>sonuçlanmaya yakın · {hotRows.length} fırsat</span></div>
          <table className="pc-table">
            <thead><tr><th>Müşteri</th><th>Faz</th><th>Adet</th><th>Değer</th><th>Hedef</th></tr></thead>
            <tbody>
              {hot.take(hotRows).map((h) => (
                <tr key={h.customerId} className="pc-click" onClick={() => window.open(`/crm/${h.customerId}`, '_blank', 'noopener')}>
                  <td><b>{h.musteri}</b><div className="pc-mini">{h.owner ?? NA}{h.nextAction ? ` · ${h.nextAction}` : ''}</div></td>
                  <td>{h.phaseName ?? NA}</td>
                  <td>{fmt(h.quantity)}</td>
                  <td>{fmtMoney(h.quoteAmount || h.potentialValue)}</td>
                  <td className={`tone-${h.tone}`}>{day(h.targetDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hot.more(hotRows.length)}
        </div>
        <div className="pc-card">
          <div className="pc-title"><h2>POC · Pilot · Rollout</h2><span>canlıya yakın · {pocRows.length} proje</span></div>
          <table className="pc-table">
            <thead><tr><th>Müşteri</th><th>Faz</th><th>Adet</th><th>Son temas</th><th>Hedef</th></tr></thead>
            <tbody>
              {poc.take(pocRows).map((p) => (
                <tr key={p.customerId} className="pc-click" onClick={() => window.open(`/crm/${p.customerId}`, '_blank', 'noopener')}>
                  <td><b>{p.musteri}</b><div className="pc-mini">{p.owner ?? NA}</div></td>
                  <td>{p.phaseName ?? NA}</td>
                  <td>{fmt(p.quantity)}</td>
                  <td>{p.daysSinceActivity == null ? NA : `${p.daysSinceActivity} gün`}</td>
                  <td className={`tone-${p.tone}`}>{day(p.targetDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {poc.more(pocRows.length)}
        </div>
      </div>

      {/* 4 — Teklifler & dönüşüm */}
      <div className="pc-section pc-card">
        <div className="pc-title"><h2>Teklifler &amp; Dönüşüm</h2><span>yıl içi · kapanan tekliflerin satışa dönüşü</span></div>
        <div className="pc-summary">
          <Box href={dd('teklif', { state: 'acik' })} className=""><span>Açık</span><b className="tone-info">{fmt(rv.openQuotes)} · {fmtMoney(rv.pipeline)}</b></Box>
          <Box href={dd('teklif', { state: 'kazanilan' })} className=""><span>Satışa dönen</span><b className="tone-ok">{fmt(rv.saleYtd.count)} · {fmtMoney(rv.saleYtd.amount)}</b></Box>
          <Box href={dd('teklif', { state: 'kaybedilen' })} className=""><span>Kaybedilen</span><b className="tone-danger">{fmt(rv.lostYtd.count)} · {fmtMoney(rv.lostYtd.amount)}</b></Box>
          <div><span>Dönüşüm</span><b className={`tone-${q.conversion.pct == null ? 'info' : q.conversion.pct >= 50 ? 'ok' : q.conversion.pct >= 30 ? 'warn' : 'danger'}`}>{q.conversion.pct == null ? NA : `%${q.conversion.pct}`}</b></div>
        </div>
        <div className="pc-grid g2">
          <div>
            <table className="pc-table">
              <thead><tr><th>Satıcı</th><th>Açık</th><th>Pasif</th><th>Satış</th><th>Kayıp</th><th>Dönüşüm</th></tr></thead>
              <tbody>
                {q.byOwner.filter((o) => same(o.owner)).map((o) => (
                  <tr key={o.owner} className="pc-click" onClick={() => window.open(drilldownHref({ kind: 'teklif', owner: o.owner, year, state: 'acik' }), '_blank', 'noopener')}>
                    <td><b>{o.owner}</b></td>
                    <td>{fmt(o.open)} · {fmtMoney(o.openAmount)}</td>
                    <td className={o.passive ? 'tone-warn' : ''}>{fmt(o.passive)}</td>
                    <td>{fmt(o.sale)} · {fmtMoney(o.saleAmount)}</td>
                    <td>{fmt(o.lost)}</td>
                    <td>{o.conversionPct == null ? NA : `%${o.conversionPct}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="pc-label">Kayıp nedenleri</div>
            {q.lostReasons.length ? <Bars rows={q.lostReasons} href={() => dd('teklif', { state: 'kaybedilen' })} /> : <div className="pc-mini">Kayıp yok.</div>}
            <div className="pc-label">Son kapanan teklifler</div>
            <table className="pc-table">
              <tbody>
                {q.recentClosed.slice(0, 8).map((r) => (
                  <tr key={r.quoteNo}>
                    <td><b>{r.musteri}</b><div className="pc-mini">{r.owner ?? NA} · {day(r.date)}</div></td>
                    <td className={r.status === 'won' && !r.saleCancelled ? 'tone-ok' : 'tone-danger'}>{r.status === 'won' ? (r.saleCancelled ? 'Kazanıldı · satış iptal' : 'Kazanıldı') : `Kayıp${r.reason ? ` · ${r.reason}` : ''}`}</td>
                    <td>{fmtMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4b — Forecast */}
      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Forecast · Aylara Göre</h2><span>{data.forecast.year} · {fmt(data.forecast.totalQuantity)} adet · ağırlıklı {fmt(data.forecast.weightedQuantity)}</span></div>
          <Bars rows={data.forecast.byMonth.map((m) => ({ label: m.label, value: m.quantity, hint: `ağırlıklı ${m.weighted}` }))} href={() => '/crm/forecast'} />
        </div>
        <div className="pc-card">
          <div className="pc-title"><h2>Forecast · Satıcıya Göre</h2><span>adet</span></div>
          <Bars rows={data.forecast.byOwner} href={() => '/crm/forecast'} />
        </div>
      </div>

      {/* 5 — Portföy + havuz */}
      <div className="pc-grid g2 pc-section">
        <div className="pc-card">
          <div className="pc-title"><h2>Portföy</h2><span>{fmt(data.portfolio.total)} firma · Account Atama</span></div>
          {cl ? (
            <div className="pc-summary">
              <Box href={dd('portfoy', { segment: 'Lead' })} className=""><span>Lead</span><b>{fmt(cl.lead)}</b></Box>
              <Box href={dd('portfoy', { segment: 'Hunter' })} className=""><span>Hunter</span><b>{fmt(cl.hunter)}</b></Box>
              <Box href={dd('portfoy', { segment: 'Farmer' })} className=""><span>Farmer</span><b>{fmt(cl.farmer)}</b></Box>
              <Box href={dd('portfoy', { segment: 'Kasa' })} className=""><span>Kasa</span><b>{fmt(cl.kasa)}</b></Box>
            </div>
          ) : null}
          <div className="pc-label">Faz dağılımı</div>
          <Bars rows={data.portfolio.byPhaseGroup} href={() => dd('portfoy')} />
          {cl?.unlisted ? <div className="pc-mini">{fmt(cl.unlisted)} firma Account Atama&apos;da yok.</div> : null}
          <div className="pc-label">Sorumluya göre</div>
          <Bars rows={data.portfolio.byOwner} href={(l) => drilldownHref({ kind: 'portfoy', owner: l, year })} />
          <div className="pc-label">Sektör</div>
          <Bars rows={data.portfolio.bySector} />
          <div className="pc-label">Künye</div>
          <Bars rows={data.portfolio.kunye} />
        </div>
        <div className="pc-card">
          <div className="pc-title"><h2>Havuz &amp; Yemek Kartları</h2><span>satıcıya atanmamış portföy</span></div>
          <Bars rows={data.pools.breakdown} />
          <div className="pc-rows">
            {data.pools.blocks.map((b) => (
              <Row key={b.label} k={b.label} v={`${fmt(b.total)} firma · 30 günde hareket ${fmt(b.touched30)} · 90+ gün hareketsiz ${fmt(b.inactive90)}`} href="/crm/customer-list" tone={b.inactive90 > b.total / 2 ? 'warn' : undefined} />
            ))}
          </div>
        </div>
      </div>

      {/* 6 — Satıcı bazlı aktivite + hedef */}
      <div className="pc-section pc-card">
        <div className="pc-title"><h2>Satıcı Bazında Aktivite</h2><span>bu hafta · gerçekleşen / hedef · satıra bas, satıcı detayı açılsın</span></div>
        <div className="cc-scroll">
          <table className="pc-table">
            <thead><tr><th>Satıcı</th>{WEEKLY_TARGET_LABELS.map((l) => <th key={l.key}>{l.label}</th>)}<th>Toplam</th><th>Tekil firma</th><th>Bugün</th><th>Ciro (YTD)</th><th>Hareketsiz</th></tr></thead>
            <tbody>
              {owners.filter((o) => same(o.owner)).map((o) => {
                const cell = (a: number, tg: number) => <span className={`tone-${tg ? attainmentTone(pct(a, tg)) : 'info'}`}>{fmt(a)}{tg ? ` / ${fmt(tg)}` : ''}</span>;
                return (
                  <tr key={o.owner} className={`pc-click${sel === o.owner ? ' cc-sel' : ''}`} onClick={() => setSel(sel === o.owner ? '' : o.owner)}>
                    <td><b>{o.owner}</b></td>
                    {WEEKLY_TARGET_LABELS.map((l) => <td key={l.key}>{cell(o.actual[l.key], o.target[l.key])}</td>)}
                    <td>{cell(o.actual.totalActivities, o.target.totalActivities)}</td>
                    <td>{fmt(o.actual.uniqueCustomers)}</td>
                    <td>{fmt(o.todayActivities)}</td>
                    <td><span className={`tone-${o.revenue.attainmentPct == null ? 'info' : attainmentTone(o.revenue.attainmentPct)}`}>{fmtMoney(o.revenue.actualYtd)}{o.revenue.attainmentPct == null ? '' : ` · %${o.revenue.attainmentPct}`}</span></td>
                    <td className={o.inactive.count ? 'tone-danger' : 'tone-ok'}>{fmt(o.inactive.count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6b — Satıcı detayı (eski kişi slaytının verisi) */}
      {(() => {
        const o = data.owners.find((x) => x.owner === sel);
        if (!o) return null;
        const g = o.goals;
        const od = (kind: Parameters<typeof drilldownHref>[0]['kind'], extra: Omit<Parameters<typeof drilldownHref>[0], 'kind' | 'owner'> = {}) => drilldownHref({ kind, owner: o.owner, year, ...extra });
        const gp = (label: string, p: { actual: number; target: number | null; pct: number | null }, render: (v: number) => string = fmt, href?: string, note?: string) => (
          <Kpi label={label} value={render(p.actual)} target={p.target != null ? render(p.target) : null} sub={note} ratio={p.pct} href={href} />
        );
        return (
          <div className="pc-section pc-card cc-detail">
            <div className="pc-title">
              <h2>{o.owner}</h2>
              <span>{g.quarter.label} ({g.quarter.months}) · çeyreğin %{g.quarter.elapsedPct}&apos;i geçti · <a href="/performans-karnesi" target="_blank" rel="noreferrer">Karneyi aç</a> · <button type="button" className="pc-btn" onClick={() => setSel('')}>Kapat</button></span>
            </div>
            <div className="pc-grid cc-g5">
              {gp('Görüşme (çeyrek)', g.visitsQuarter, fmt, od('kapsama'), g.visitsQuarterAssumed ? 'hedef yıllıktan' : undefined)}
              {gp('Görüşme (yıl)', g.visitsYear, fmt, od('kapsama'))}
              {gp('Ciro (çeyrek)', g.budgetQuarter, fmtMoney, od('fatura'))}
              {gp(`Entegrasyon (${g.integrationMonthLabel} sonu)`, g.integrationMonth, fmt, '/crm/reports/entegrasyon-raporu', `bu ay +${fmt(g.integrationMonthDevices)} cihaz`)}
              {gp('Entegrasyon (yıl)', g.integration, fmt, '/crm/reports/entegrasyon-raporu')}
            </div>
            <div className="pc-grid g2">
              <div>
                <div className="pc-rows">
                  <Row k="Entegrasyon (çeyrek sonu)" v={`${fmt(g.integrationQuarter.actual)} / ${fmt(g.integrationQuarter.target)}`} />
                  <Row k="Entegrasyon geliri (ay / yıl)" v={`${fmtMoney(g.integrationRevenue.usdMonth)} / ${fmtMoney(g.integrationRevenue.usdYear)}${g.integrationRevenue.otherYear ? ` · TL ${fmt(g.integrationRevenue.otherYear)}` : ''}`} />
                  <Row k="Lead → Hunter" v={`${fmt(g.leadToHunter.actual)}${g.leadToHunter.target != null ? ` / ${fmt(g.leadToHunter.target)}` : ''}`} href={od('portfoy', { segment: 'Hunter' })} />
                  <Row k="Hunter → Farmer" v={`${fmt(g.hunterToFarmer.actual)}${g.hunterToFarmer.target != null ? ` / ${fmt(g.hunterToFarmer.target)}` : ''}`} href={od('portfoy', { segment: 'Farmer' })} />
                  <Row k="Kazanılan teklif" v={`${fmt(g.wonQuotes.actual)}${g.wonQuotes.target != null ? ` / ${fmt(g.wonQuotes.target)}` : ''}`} href={od('teklif', { state: 'kazanilan' })} />
                  <Row k="Açık teklif (taslak dahil)" v={`${fmt(g.openAll)} (taslak ${fmt(g.draft)}) · ${fmtMoney(o.quoteBox.open.amount)}`} href={od('teklif', { state: 'acik' })} />
                  <Row k="Kaybedilen teklif" v={`${fmt(o.quoteBox.lost.count)} · ${fmtMoney(o.quoteBox.lost.amount)}`} href={od('teklif', { state: 'kaybedilen' })} />
                  <Row k="Kesilen fatura (YTD)" v={fmt(o.invoices)} href={od('fatura')} />
                  <Row k="Kapsanan firma (yıl)" v={`${fmt(o.coverage.covered.actual)}${o.coverage.covered.target != null ? ` / ${fmt(o.coverage.covered.target)}` : ''}`} href={od('kapsama')} />
                  <Row k="Firma başına temas" v={`${fmt(o.coverage.contactsPer.actual)}${o.coverage.contactsPer.target != null ? ` / ${fmt(o.coverage.contactsPer.target)}` : ''}`} href={od('kapsama')} />
                  <Row k={`Hareketsiz firma (${o.inactive.days}+ gün)`} v={fmt(o.inactive.count)} tone={o.inactive.count ? 'danger' : 'ok'} href={`/crm/hareketsiz?satici=${encodeURIComponent(o.owner)}&gun=${o.inactive.days}`} />
                  {o.list ? <Row k="Account Atama (L / H / F / K)" v={`${o.list.lead} / ${o.list.hunter} / ${o.list.farmer} / ${o.list.kasa}`} href={od('portfoy')} /> : null}
                  {o.jira ? <Row k="Jira açık / müşteri bekleyen" v={`${fmt(o.jira.open)} / ${fmt(o.jira.customerWaiting)}`} /> : null}
                </div>
              </div>
              <div>
                <div className="pc-label">Cihaz · toplam {fmt(o.devices.total)} (satış {fmt(o.devices.sold)} · kira {fmt(o.devices.rental)}{o.devices.unlinked ? ` · kalemsiz ${fmt(o.devices.unlinked)}` : ''})</div>
                <Bars rows={o.devices.byModel.map((m) => ({ label: m.code, value: m.total, hint: `satış ${m.sold} · kira ${m.rental}` }))} href={(l) => od('cihaz', { model: l })} />
                <div className="pc-label">Son aktiviteler</div>
                <table className="pc-table">
                  <tbody>
                    {o.recentActivities.slice(0, 8).map((a) => (
                      <tr key={a.id}>
                        <td>{day(a.date)}</td>
                        <td><b>{a.musteri}</b><div className="pc-mini">{a.label}{a.phaseChange === 'up' ? ` · faz ${a.phaseFrom ?? '—'} → ${a.phaseTo}` : ''}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7 — Takip listesi */}
      <div className="pc-section pc-card">
        <div className="pc-title">
          <h2>Takip Listesi</h2>
          <span>{follow ? `${fmt(follow.summary.openFollowupCount)} açık engel · ${fmt(follow.summary.totalQuantity)} adet · yakın vadede ${fmt(follow.summary.nearTermQuantity)} adet · tarihi geçen önce` : 'yüklenemedi'}</span>
        </div>
        {folRows.length ? (
          <>
            <table className="pc-table">
              <thead><tr><th>Müşteri</th><th>Konu kimde</th><th>Model / Adet</th><th>Takip konusu</th><th>Çözüm</th></tr></thead>
              <tbody>
                {fol.take(folRows).map((r) => (
                  <tr key={r.customerId} className="pc-click" onClick={() => window.open(cust(r.customerId), '_blank', 'noopener')}>
                    <td><b>{r.musteri}</b><div className="pc-mini">{r.sorumlu ?? ''}</div></td>
                    <td>{r.konuKimde}</td>
                    <td>{r.modelAdetLabel}</td>
                    <td>{r.takipKonusu}</td>
                    <td className={r.overdue ? 'tone-danger' : r.nearTerm ? 'tone-warn' : ''}>{day(r.cozumTarihi)}{r.overdue ? ' · geçti' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fol.more(folRows.length)}
          </>
        ) : <div className="pc-mini">Açık takip yok.</div>}
      </div>

      {/* 8 — Jira */}
      {t.jira ? (
        <div className="pc-section pc-card">
          <div className="pc-title"><h2>Jira · Retail Support</h2><span>teknik operasyon</span></div>
          <div className="pc-summary">
            <div><span>Devam eden</span><b className="tone-info">{fmt(t.jira.ongoing)}</b></div>
            <div><span>Geliştirme bekleyen</span><b className="tone-warn">{fmt(t.jira.developmentWaiting)}</b></div>
            <div><span>Müşteri bekleyen</span><b className="tone-warn">{fmt(t.jira.customerWaiting)}</b></div>
            <div><span>Bu hafta açılan / kapanan</span><b>{fmt(t.jira.created)} / {fmt(t.jira.closed)}</b></div>
          </div>
          {t.jira.byCompany.length ? (
            <table className="pc-table">
              <thead><tr><th>Firma</th><th>Devam</th><th>Geliştirme bekl.</th><th>Müşteri bekl.</th><th>Açılan</th><th>Kapanan</th></tr></thead>
              <tbody>
                {t.jira.byCompany.map((c) => (
                  <tr key={c.company}><td><b>{c.company}</b></td><td>{fmt(c.ongoing)}</td><td>{fmt(c.developmentWaiting)}</td><td>{fmt(c.customerWaiting)}</td><td>{fmt(c.created)}</td><td>{fmt(c.closed)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
      </>)}
    </div>
  );
}
