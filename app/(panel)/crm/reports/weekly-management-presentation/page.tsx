'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import '@/styles/reports-weekly-management-presentation.css';
import { appToast } from '@/lib/app-toast';

type Customer = {
  musteri_id: string;
  customer: string;
  owner: string;
  sector: string;
  entegrasyon_tipi: string;
  phase_no: number | null;
  phase_name: string | null;
  phase_group: string;
  kasapos_firmasi: string;
  sabit_bilgisayar_markasi: string;
  pos_markasi: string;
  store_count: number | null;
  pos_count: number | null;
  quote_count: number;
  total_quote_amount: number;
  kunye_status: 'Var' | 'Eksik' | 'Yok';
};

type ActivityItem = { customer: string; note: string; owner: string; phase: string; waiting: string; created_at: string };

type JiraTicketSummary = {
  totalCreated: number;
  totalClosed: number;
  totalOngoing: number;
  totalDevelopmentWaiting: number;
  totalCustomerWaiting: number;
  rows: Array<{ company: string; created: number; closed: number; ongoing: number; developmentWaiting: number; customerWaiting: number }>;
  warning?: string;
  jql?: string;
  debug?: {
    connected: boolean;
    issueCount: number;
    companyFieldId: string;
    queryMode: string;
    searchEndpoint?: string;
    recentProjectCount?: number;
    availableStatuses?: string[];
    candidateCompanyFields?: Array<{ id: string; name: string; sampleValue: string }>;
    diagnostics?: string[];
    sampleIssues: Array<{ key: string; company: string; status: string; created: string; resolved: string; summary: string }>;
  };
};

type Payload = {
  filters: {
    from: string;
    to: string;
    ownerOptions: string[];
    segmentOptions: string[];
    selectedOwner: string;
    selectedSegment: string;
  };
  summary: {
    totalAccounts: number;
    totalPosDevices: number;
    activeProjects: number;
    completedAccounts: number;
    pipelinePosDevices: number;
    completedPosDevices: number;
    weeklyActivities: number;
    activePeople: number;
    quoteCount: number;
    quoteAmount: number;
    kunyeCoveragePct: number;
  };
  phaseSummary: Array<{ label: string; totalAccounts: number; totalPos: number }>;
  eftPosBrandDistribution: Array<{ label: string; value: number }>;
  kasaposDistribution: Array<{ label: string; value: number }>;
  topActiveAccounts: Customer[];
  topCompletedAccounts: Customer[];
  weeklyHighlights: ActivityItem[];
  weeklyNewContacts: ActivityItem[];
  weeklyRisks: ActivityItem[];
  weeklyCompleted: ActivityItem[];
  segmentBoards: Array<{ segment: string; totalAccounts: number; totalPos: number; activeCount: number; completedCount: number; items: Customer[] }>;
  narrative: {
    title: string;
    dateRangeLabel: string;
    executiveSummary: string[];
    segmentSummaries: Array<{ title: string; bullets: string[] }>;
    riskSummary: string[];
  };
  customers: Customer[];
  jiraTicketSummary?: JiraTicketSummary;
};

const EMPTY: Payload = {
  filters: { from: '', to: '', ownerOptions: [], segmentOptions: [], selectedOwner: '', selectedSegment: '' },
  summary: { totalAccounts: 0, totalPosDevices: 0, activeProjects: 0, completedAccounts: 0, pipelinePosDevices: 0, completedPosDevices: 0, weeklyActivities: 0, activePeople: 0, quoteCount: 0, quoteAmount: 0, kunyeCoveragePct: 0 },
  phaseSummary: [], eftPosBrandDistribution: [], kasaposDistribution: [], topActiveAccounts: [], topCompletedAccounts: [], weeklyHighlights: [], weeklyNewContacts: [], weeklyRisks: [], weeklyCompleted: [], segmentBoards: [],
  narrative: { title: '', dateRangeLabel: '', executiveSummary: [], segmentSummaries: [], riskSummary: [] },
  customers: [],
};

function thisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(end) };
}

function numberFormat(value: number) {
  return value.toLocaleString('tr-TR');
}

function moneyFormat(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function buildMarkdown(payload: Payload) {
  const lines: string[] = [];
  lines.push(`# ${payload.narrative.title}`);
  lines.push('');
  lines.push('## Yönetici Özeti');
  payload.narrative.executiveSummary.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## İlerlemeler / İlk Temaslar / Tamamlananlar');
  buildCombinedWeeklyItems(payload).forEach((item) => lines.push(`- **${item.customer}**: ${item.note}`));
  lines.push('');
  lines.push('## Tamamlananlar');
  payload.weeklyCompleted.forEach((item) => lines.push(`- **${item.customer}**: ${item.note}`));
  lines.push('');
  lines.push('## Riskler');
  payload.weeklyRisks.forEach((item) => lines.push(`- **${item.customer}**: ${item.note}`));
  lines.push('');
  payload.segmentBoards.forEach((segment) => {
    lines.push(`## ${segment.segment}`);
    segment.items.slice(0, 8).forEach((item) => lines.push(`- **${item.customer}** · ${item.phase_group} · ${item.pos_count ?? 0} POS · ${item.quote_count} teklif`));
    lines.push('');
  });
  return lines.join('\n');
}


function buildCombinedWeeklyItems(payload: Payload) {
  return payload.weeklyNewContacts.map((item, index) => ({
    key: `new-${item.customer}-${index}`,
    kind: 'Yeni Temas' as const,
    customer: item.customer,
    note: item.note,
  }));
}

export default function WeeklyManagementPresentationPage() {
  const defaults = useMemo(() => thisWeekRange(), []);
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingPptx, setDownloadingPptx] = useState(false);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [owner, setOwner] = useState('');
  const [segment, setSegment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (owner) params.set('owner', owner);
      if (segment) params.set('segment', segment);
      const res = await fetch(`/api/reports/weekly-management-presentation?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayload(EMPTY);
        setMessage(json?.message || 'Sunum verisi yüklenemedi');
        return;
      }
      setPayload({ ...EMPTY, ...(json ?? {}) });
    } finally {
      setLoading(false);
    }
  }, [from, to, owner, segment]);

  useEffect(() => { void load(); }, [load]);

  const downloadPptx = async () => {
    if (downloadingPptx) return;
    setDownloadingPptx(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (owner) params.set('owner', owner);
      if (segment) params.set('segment', segment);
      const res = await fetch(`/api/reports/weekly-management-presentation/pptx?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorMessage = json?.message || 'PPTX oluşturulamadı';
        setMessage(errorMessage);
        appToast.error('PPTX indirilemedi', errorMessage);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `haftalik-yonetim-sunumu-${from}-${to}.pptx`;
      link.click();
      URL.revokeObjectURL(href);
      appToast.success('PPTX hazır', 'Dosya indirme işlemi başlatıldı.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PPTX oluşturulamadı';
      setMessage(errorMessage);
      appToast.error('PPTX indirilemedi', errorMessage);
    } finally {
      setDownloadingPptx(false);
    }
  };

  const printDeck = () => window.print();
  const combinedWeeklyItems = useMemo(() => buildCombinedWeeklyItems(payload), [payload]);

  return (
    <main className="wmp-page pax-page-container">
      <section className="wmp-hero">
        <span className="wmp-eyebrow">Rapor Merkezi · Haftalık Yönetim Sunumu</span>
        <h1>{payload.narrative.title || 'Haftalık Yönetim Sunumu'}</h1>
        <p>
          CRM verilerini doğrudan haftalık yönetim sunumu şablonuna bağlayan ekran. Buradaki filtrelerle aynı sunum yapısında PPTX dışa aktarımı alınır; KPI, faz kırılımı, haftalık ilerlemeler, riskler ve segment slaytları hazır dosyaya basılır.
        </p>
        <div className="wmp-actions">
          <button onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor...' : '↻ Yenile'}</button>
          <button className="secondary" onClick={() => void downloadPptx()} disabled={!payload.customers.length || loading || downloadingPptx}>{downloadingPptx ? 'PPTX hazırlanıyor...' : 'PPTX İndir'}</button>
          <button className="secondary" onClick={printDeck} disabled={!payload.customers.length}>Yazdır / PDF</button>
        </div>
      </section>

      <section className="wmp-filter-card">
        <div className="wmp-filter-grid">
          <label><span>Başlangıç</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>Bitiş</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label>
            <span>Satıcı</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.ownerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Segment</span>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.segmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {message ? <div className="wmp-message">{message}</div> : null}
      </section>

      <section className="wmp-slide-card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2>Jira Retail Support Ticket Ön İzleme</h2>
            <p className="wmp-empty" style={{ margin: 0 }}>
              PPTX indirmeden önce Jira bağlantısını ve seçili oluşturma tarihi aralığındaki RS ticketlarını burada kontrol edin.
            </p>
          </div>
          <div style={{ textAlign: 'right', color: payload.jiraTicketSummary?.debug?.connected ? '#047857' : '#b45309', fontWeight: 800 }}>
            {payload.jiraTicketSummary?.debug?.connected ? 'Jira Bağlandı ✅' : 'Jira Kontrol Ediliyor / Hata ⚠️'}
          </div>
        </div>

        <div className="wmp-kpi-grid" style={{ marginTop: 16 }}>
          {[
            ['Oluşturulan', numberFormat(payload.jiraTicketSummary?.totalCreated ?? 0)],
            ['Kapatılmış', numberFormat(payload.jiraTicketSummary?.totalClosed ?? 0)],
            ['Devam Eden', numberFormat(payload.jiraTicketSummary?.totalOngoing ?? 0)],
            ['Geliştirme Bekl.', numberFormat(payload.jiraTicketSummary?.totalDevelopmentWaiting ?? 0)],
            ['Müşteri Bekl.', numberFormat(payload.jiraTicketSummary?.totalCustomerWaiting ?? 0)],
            ['Jira Issue Count', numberFormat(payload.jiraTicketSummary?.debug?.issueCount ?? 0)],
          ].map(([label, value]) => (
            <div className="wmp-kpi-card" key={`jira-${label}`}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>

        {payload.jiraTicketSummary?.warning ? (
          <div className="wmp-message" style={{ marginTop: 12 }}>{payload.jiraTicketSummary.warning}</div>
        ) : null}

        <div className="wmp-mini-table big" style={{ marginTop: 16 }}>
          <div className="head"><span>Firma</span><span>Oluşturulan</span><span>Kapatılmış</span><span>Devam</span><span>Geliştirme</span><span>Müşteri</span></div>
          {(payload.jiraTicketSummary?.rows ?? []).slice(0, 15).map((row) => (
            <div className="row" key={`jira-row-${row.company}`}>
              <span>{row.company}</span>
              <span>{numberFormat(row.created)}</span>
              <span>{numberFormat(row.closed)}</span>
              <span>{numberFormat(row.ongoing)}</span>
              <span>{numberFormat(row.developmentWaiting)}</span>
              <span>{numberFormat(row.customerWaiting)}</span>
            </div>
          ))}
          {!(payload.jiraTicketSummary?.rows ?? []).length ? (
            <div className="row"><span>Seçili oluşturma tarihi aralığında Jira ticket bulunamadı.</span><span>-</span><span>-</span><span>-</span><span>-</span><span>-</span></div>
          ) : null}
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Jira Debug Detayı</summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <code style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10 }}>
              {payload.jiraTicketSummary?.jql || 'JQL henüz oluşmadı'}
            </code>
            <p className="wmp-empty" style={{ margin: 0 }}>
              Firma alanı: {payload.jiraTicketSummary?.debug?.companyFieldId || 'customfield_10002'} · Mod: oluşturma tarihi aralığı · Endpoint: {payload.jiraTicketSummary?.debug?.searchEndpoint || '-'} · Recent count: {payload.jiraTicketSummary?.debug?.recentProjectCount ?? 0}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <strong>Jira status adları</strong>
                <p className="wmp-empty" style={{ margin: '6px 0 0' }}>
                  {(payload.jiraTicketSummary?.debug?.availableStatuses ?? []).join(' · ') || 'Status listesi alınamadı'}
                </p>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <strong>Firma field adayları</strong>
                <p className="wmp-empty" style={{ margin: '6px 0 0' }}>
                  {(payload.jiraTicketSummary?.debug?.candidateCompanyFields ?? []).map((f) => `${f.id} / ${f.name}: ${f.sampleValue}`).join(' · ') || 'Firma field adayı bulunamadı'}
                </p>
              </div>
            </div>
            <code style={{ whiteSpace: 'pre-wrap', background: '#fff7ed', border: '1px solid #fed7aa', padding: 10, borderRadius: 10 }}>
              {(payload.jiraTicketSummary?.debug?.diagnostics ?? []).join('\n') || 'Diagnostic satırı yok'}
            </code>
            <div className="wmp-mini-table big">
              <div className="head"><span>Issue</span><span>Firma</span><span>Status</span><span>Created</span><span>Resolved</span></div>
              {(payload.jiraTicketSummary?.debug?.sampleIssues ?? []).map((issue) => (
                <div className="row" key={`sample-${issue.key}`}>
                  <span>{issue.key}</span>
                  <span>{issue.company}</span>
                  <span>{issue.status}</span>
                  <span>{issue.created || '-'}</span>
                  <span>{issue.resolved || '-'}</span>
                </div>
              ))}
              {!(payload.jiraTicketSummary?.debug?.sampleIssues ?? []).length ? (
                <div className="row"><span>Örnek issue yok</span><span>-</span><span>-</span><span>-</span><span>-</span></div>
              ) : null}
            </div>
          </div>
        </details>
      </section>

      <section className="wmp-kpi-grid">
        {[
          ['Toplam Firma', numberFormat(payload.summary.totalAccounts)],
          ['Toplam POS', numberFormat(payload.summary.totalPosDevices)],
          ['Aktif Proje', numberFormat(payload.summary.activeProjects)],
          ['Tamamlanan Hesap', numberFormat(payload.summary.completedAccounts)],
          ['Pipeline POS', numberFormat(payload.summary.pipelinePosDevices)],
          ['Tamamlanan POS', numberFormat(payload.summary.completedPosDevices)],
          ['Haftalık Aktivite', numberFormat(payload.summary.weeklyActivities)],
          ['Aktif Kişi', numberFormat(payload.summary.activePeople)],
          ['Teklif Sayısı', numberFormat(payload.summary.quoteCount)],
          ['Teklif Tutarı', moneyFormat(payload.summary.quoteAmount)],
          ['Künye Tamamlama', `%${payload.summary.kunyeCoveragePct}`],
        ].map(([label, value]) => (
          <div className={`wmp-kpi-card${label === 'Teklif Tutarı' ? ' offer-amount' : ''}`} key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </section>

      <section className="wmp-slide-grid">
        <article className="wmp-slide-card">
          <h2>Yönetici Özeti</h2>
          <ul>{payload.narrative.executiveSummary.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="wmp-slide-card">
          <h2>Faz Durumu</h2>
          <div className="wmp-mini-table">
            <div className="head"><span>Faz Grubu</span><span>Firma</span><span>POS</span></div>
            {payload.phaseSummary.map((item) => (
              <div className="row" key={item.label}><span>{item.label}</span><span>{numberFormat(item.totalAccounts)}</span><span>{numberFormat(item.totalPos)}</span></div>
            ))}
          </div>
        </article>
        <article className="wmp-slide-card">
          <h2>EFT-POS Marka Dağılımı</h2>
          <ul>{payload.eftPosBrandDistribution.map((item) => <li key={item.label}><strong>{item.label}</strong> · {numberFormat(item.value)}</li>)}</ul>
        </article>
        <article className="wmp-slide-card">
          <h2>KasaPOS Firma Dağılımı</h2>
          <ul>{payload.kasaposDistribution.map((item) => <li key={item.label}><strong>{item.label}</strong> · {numberFormat(item.value)}</li>)}</ul>
        </article>
      </section>

      <section className="wmp-two-col">
        <article className="wmp-slide-card wmp-span-2">
          <h2>İlerlemeler / İlk Temaslar / Tamamlananlar</h2>
          {combinedWeeklyItems.length ? (
            <ul>{combinedWeeklyItems.map((item) => <li key={item.key}><span className={`wmp-kind wmp-kind-${item.kind.toLocaleLowerCase('tr').replace(/\s+/g, '-')}`}>{item.kind}</span> <strong>{item.customer}</strong>: {item.note}</li>)}</ul>
          ) : (
            <p className="wmp-empty">Seçili tarih aralığında sunuma taşınacak yeni temas kaydı bulunamadı.</p>
          )}
        </article>
      </section>

      <section className="wmp-two-col">
        <article className="wmp-slide-card danger">
          <h2>Ticari Riskler ve Yönetim Kararı Gerektiren Konular</h2>
          {payload.weeklyRisks.length ? (
            <ul>{payload.weeklyRisks.map((item, index) => <li key={`${item.customer}-${index}`}><strong>{item.customer}</strong>: {item.note}</li>)}</ul>
          ) : (
            <p className="wmp-empty">Bu alan aktivite dashboardındaki blokaj notlarından beslenir. Seçili tarih aralığında blokaj notu işaretlenmiş aktivite bulunamadı.</p>
          )}
        </article>
        <article className="wmp-slide-card">
          <h2>En Büyük Aktif Hesaplar</h2>
          <div className="wmp-mini-table">
            <div className="head"><span>Firma</span><span>Faz</span><span>POS</span></div>
            {payload.topActiveAccounts.map((item) => (
              <div className="row" key={item.musteri_id}><span>{item.customer}</span><span>{item.phase_group}</span><span>{numberFormat(item.pos_count ?? 0)}</span></div>
            ))}
          </div>
        </article>
      </section>

      <section className="wmp-two-col">
        <article className="wmp-slide-card">
          <h2>En Büyük Tamamlanan Hesaplar</h2>
          <div className="wmp-mini-table">
            <div className="head"><span>Firma</span><span>Faz</span><span>POS</span></div>
            {payload.topCompletedAccounts.map((item) => (
              <div className="row" key={item.musteri_id}><span>{item.customer}</span><span>{item.phase_group}</span><span>{numberFormat(item.pos_count ?? 0)}</span></div>
            ))}
          </div>
        </article>
        <article className="wmp-slide-card">
          <h2>Sunum Metni</h2>
          <textarea readOnly value={buildMarkdown(payload)} />
        </article>
      </section>

      {payload.segmentBoards.map((board) => (
        <section className="wmp-segment-card" key={board.segment}>
          <div className="wmp-segment-head">
            <div>
              <h2>{board.segment} kullanan firmalardaki durumlar</h2>
              <p>{numberFormat(board.totalAccounts)} firma · {numberFormat(board.totalPos)} POS · {numberFormat(board.activeCount)} aktif · {numberFormat(board.completedCount)} tamamlanan</p>
            </div>
          </div>
          <div className="wmp-mini-table big">
            <div className="head"><span>Firma</span><span>Satıcı</span><span>Faz</span><span>POS</span><span>Teklif</span></div>
            {board.items.map((item) => (
              <div className="row" key={`${board.segment}-${item.musteri_id}`}>
                <span>{item.customer}</span>
                <span>{item.owner}</span>
                <span>{item.phase_group}</span>
                <span>{numberFormat(item.pos_count ?? 0)}</span>
                <span>{numberFormat(item.quote_count)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
