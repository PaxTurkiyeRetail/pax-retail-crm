'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import {
  BLOCKER_CATEGORIES,
  RESOLUTION_OWNER_TYPES,
  categoryLabel,
  periodLabel,
  statusLabel,
} from '@/lib/forecast-blockers';
import { buildForecastYears, FORECAST_MONTHS } from '@/lib/forecast-shared';
import { buildBlockerImpactWorkbook } from '@/components/blocker-impact/BlockerImpactExport';
import '@/styles/blocker-impact.css';

type Status = 'pending' | 'no_blocker' | 'open' | 'in_progress' | 'overdue' | 'resolved';
type ViewTab = 'customers' | 'team' | 'budget';

type ForecastOption = {
  forecast_id: string;
  product_code: string | null;
  product_name: string;
  quantity: number;
  year: number;
  month: number;
  period_label: string;
};

type Row = {
  customer_id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  forecast_id: string | null;
  product_code_snapshot: string | null;
  product_name_snapshot: string | null;
  quantity: number | null;
  forecast_year: number | null;
  forecast_month: number | null;
  forecast_period_label: string;
  active_forecast_count: number;
  total_forecast_quantity: number;
  forecast_options: ForecastOption[];
  blocker_id: string | null;
  has_blocker: boolean | null;
  blocker_category: string | null;
  blocker_description: string | null;
  resolution_owner_type: string | null;
  resolution_owner_name: string | null;
  resolution_due_date: string | null;
  impact_type: 'none' | 'month_shift' | null;
  shift_year: number | null;
  shift_month: number | null;
  shifted_quantity: number | null;
  shift_period_label: string | null;
  workflow_status: string | null;
  manager_note: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  effective_status: Status;
};

type Summary = {
  activeCustomers: number;
  answered: number;
  pending: number;
  open: number;
  overdue: number;
  noBlocker: number;
  resolved: number;
  riskQuantity: number;
  completionRate: number;
};

type CompletionRow = {
  owner: string;
  customers: number;
  answered: number;
  pending: number;
  open: number;
  overdue: number;
  completionRate: number;
};

type BudgetRow = {
  key: string;
  year: number;
  month: number;
  periodLabel: string;
  currentForecast: number;
  outgoing: number;
  incoming: number;
  projected: number;
};

type ApiResponse = {
  rows?: Row[];
  total?: number;
  page?: number;
  pageSize?: number;
  scope?: 'all' | 'own';
  summary?: Summary;
  completionByOwner?: CompletionRow[];
  budgetImpact?: BudgetRow[];
  ownerOptions?: string[];
  onboardingNeeded?: boolean;
  message?: string;
};

type FormState = {
  hasBlocker: '' | 'yes' | 'no';
  blockerCategory: string;
  blockerDescription: string;
  resolutionOwnerType: string;
  resolutionOwnerName: string;
  resolutionDueDate: string;
  impactType: 'none' | 'month_shift';
  forecastId: string;
  shiftYear: string;
  shiftMonth: string;
  shiftedQuantity: string;
  workflowStatus: 'open' | 'in_progress';
  managerNote: string;
  reviewed: boolean;
};

const EMPTY_SUMMARY: Summary = {
  activeCustomers: 0,
  answered: 0,
  pending: 0,
  open: 0,
  overdue: 0,
  noBlocker: 0,
  resolved: 0,
  riskQuantity: 0,
  completionRate: 0,
};
const YEARS = buildForecastYears();

function emptyForm(): FormState {
  return {
    hasBlocker: '',
    blockerCategory: '',
    blockerDescription: '',
    resolutionOwnerType: '',
    resolutionOwnerName: '',
    resolutionDueDate: '',
    impactType: 'none',
    forecastId: '',
    shiftYear: String(YEARS[0] ?? new Date().getFullYear()),
    shiftMonth: '',
    shiftedQuantity: '',
    workflowStatus: 'open',
    managerNote: '',
    reviewed: false,
  };
}

function numberFormat(value: unknown) {
  return new Intl.NumberFormat('tr-TR').format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusTone(status: Status) {
  if (status === 'overdue') return 'danger';
  if (status === 'pending') return 'neutral';
  if (status === 'open') return 'warning';
  if (status === 'in_progress') return 'info';
  return 'success';
}

function forecastTitle(option: ForecastOption) {
  const product = option.product_code ? `${option.product_code} · ${option.product_name}` : option.product_name;
  return `${option.period_label} · ${product} · ${numberFormat(option.quantity)} adet`;
}

function customerPlanText(row: Row) {
  if (!row.active_forecast_count) return 'Aktif Forecast yok';
  if (row.active_forecast_count === 1) return `${row.forecast_period_label} · ${numberFormat(row.quantity)} adet`;
  return `${numberFormat(row.active_forecast_count)} aktif Forecast · ${numberFormat(row.total_forecast_quantity)} adet`;
}

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.message || 'İşlem tamamlanamadı.');
  return json;
}

export default function BlockerImpactClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [completion, setCompletion] = useState<CompletionRow[]>([]);
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [scope, setScope] = useState<'all' | 'own'>('own');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<ViewTab>('customers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const isAdmin = scope === 'all';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedForecast = selected?.forecast_options?.find((item) => item.forecast_id === form.forecastId) ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (owner) params.set('owner', owner);
    if (category) params.set('category', category);
    try {
      const response = await fetch(`/api/forecast/blockers/list?${params.toString()}`, { cache: 'no-store' });
      const json = await readJson(response) as ApiResponse;
      setRows((json.rows ?? []).map((row) => ({ ...row, forecast_options: Array.isArray(row.forecast_options) ? row.forecast_options : [] })));
      setTotal(Number(json.total ?? 0));
      setScope(json.scope ?? 'own');
      setSummary(json.summary ?? EMPTY_SUMMARY);
      setCompletion(json.completionByOwner ?? []);
      setBudget(json.budgetImpact ?? []);
      setOwnerOptions(json.ownerOptions ?? []);
      setOnboarding(Boolean(json.onboardingNeeded));
      if (json.message && !json.onboardingNeeded) setMessage(json.message);
    } catch (error: any) {
      setMessage(error?.message || 'Engel ve Etki listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, status, owner, category]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadData, q]);

  useEffect(() => {
    if (!isAdmin && view !== 'customers') setView('customers');
  }, [isAdmin, view]);

  const statusTabs = useMemo(() => [
    { value: '', label: 'Tümü', count: summary.activeCustomers },
    { value: 'pending', label: 'Cevap Bekleyen', count: summary.pending },
    { value: 'overdue', label: 'Tarihi Geçen', count: summary.overdue },
    { value: 'active', label: 'Açık Engel', count: summary.open },
    { value: 'no_blocker', label: 'Engel Yok', count: summary.noBlocker },
    { value: 'resolved', label: 'Çözülen', count: summary.resolved },
  ], [summary]);

  function openForm(row: Row) {
    const initialForecastId = row.forecast_id ?? row.forecast_options?.[0]?.forecast_id ?? '';
    setSelected(row);
    setForm({
      hasBlocker: row.blocker_id ? (row.has_blocker ? 'yes' : 'no') : '',
      blockerCategory: row.blocker_category ?? '',
      blockerDescription: row.blocker_description ?? '',
      resolutionOwnerType: row.resolution_owner_type ?? '',
      resolutionOwnerName: row.resolution_owner_name ?? '',
      resolutionDueDate: row.resolution_due_date?.slice(0, 10) ?? '',
      impactType: row.impact_type === 'month_shift' ? 'month_shift' : 'none',
      forecastId: initialForecastId,
      shiftYear: String(row.shift_year ?? YEARS[0] ?? new Date().getFullYear()),
      shiftMonth: row.shift_month ? String(row.shift_month) : '',
      shiftedQuantity: row.shifted_quantity ? String(row.shifted_quantity) : '',
      workflowStatus: row.workflow_status === 'in_progress' ? 'in_progress' : 'open',
      managerNote: row.manager_note ?? '',
      reviewed: Boolean(row.reviewed_at),
    });
  }

  function closeForm() {
    if (saving) return;
    setSelected(null);
    setForm(emptyForm());
  }

  async function saveForm() {
    if (!selected) return;
    if (!form.hasBlocker) {
      appToast.warning('Seçim gerekli', 'Satışın önünde engel olup olmadığını seçin.');
      return;
    }
    setSaving(true);
    try {
      await readJson(await fetch('/api/forecast/blockers/upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_id: selected.customer_id,
          forecast_id: form.forecastId || null,
          has_blocker: form.hasBlocker === 'yes',
          blocker_category: form.blockerCategory,
          blocker_description: form.blockerDescription,
          resolution_owner_type: form.resolutionOwnerType,
          resolution_owner_name: form.resolutionOwnerName,
          resolution_due_date: form.resolutionDueDate,
          impact_type: form.impactType,
          shift_year: form.shiftYear,
          shift_month: form.shiftMonth,
          shifted_quantity: form.shiftedQuantity,
          workflow_status: form.workflowStatus,
        }),
      }));

      if (isAdmin) {
        await readJson(await fetch('/api/forecast/blockers/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customer_id: selected.customer_id,
            manager_note: form.managerNote,
            reviewed: form.reviewed,
          }),
        }));
      }

      appToast.success('Kayıt güncellendi', `${selected.musteri} müşterisinin Engel ve Etki bilgisi kaydedildi.`);
      setSelected(null);
      setForm(emptyForm());
      await loadData();
    } catch (error: any) {
      appToast.error('Kayıt tamamlanamadı', error?.message || 'Bilgiler kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function updateWorkflow(row: Row, action: 'resolve' | 'reopen') {
    const question = action === 'resolve'
      ? `${row.musteri} müşterisindeki engel çözüldü olarak işaretlensin mi?`
      : `${row.musteri} müşterisindeki engel yeniden açılsın mı?`;
    if (!window.confirm(question)) return;
    try {
      await readJson(await fetch(`/api/forecast/blockers/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer_id: row.customer_id }),
      }));
      appToast.success(action === 'resolve' ? 'Engel çözüldü' : 'Engel yeniden açıldı');
      await loadData();
    } catch (error: any) {
      appToast.error('İşlem tamamlanamadı', error?.message || 'Durum güncellenemedi.');
    }
  }

  async function exportWorkbook() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '5000' });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (owner) params.set('owner', owner);
      if (category) params.set('category', category);
      const response = await fetch(`/api/forecast/blockers/list?${params.toString()}`, { cache: 'no-store' });
      const json = await readJson(response) as ApiResponse;
      const exportRows = json.rows ?? [];
      const blob = await buildBlockerImpactWorkbook([
        {
          name: 'Engel ve Etki Listesi',
          widths: [22, 28, 20, 20, 16, 44, 24, 16, 20, 14, 20, 18],
          rows: [
            ['Account', 'Müşteri', 'Sektör', 'Forecast Özeti', 'Toplam Adet', 'Satışın Önündeki Engel', 'Kim Çözecek?', 'Çözüm Tarihi', 'Kayacağı Dönem', 'Kayacak Adet', 'Durum', 'Son Güncelleme'],
            ...exportRows.map((row) => [
              row.sorumlu ?? '-',
              row.musteri,
              row.sektor ?? '-',
              customerPlanText(row),
              row.total_forecast_quantity ?? 0,
              row.effective_status === 'pending' ? 'Yanıt bekliyor' : row.has_blocker ? row.blocker_description ?? '-' : 'Engel yok',
              row.resolution_owner_name ?? '-',
              formatDate(row.resolution_due_date),
              row.shift_period_label ?? '-',
              row.shifted_quantity ?? 0,
              statusLabel(row.effective_status),
              formatDateTime(row.updated_at),
            ]),
          ],
        },
        {
          name: 'Kullanıcı Tamamlama',
          widths: [24, 18, 15, 18, 15, 15, 18],
          rows: [
            ['Kullanıcı', 'Toplam Müşteri', 'Cevaplanan', 'Cevap Bekleyen', 'Açık Engel', 'Tarihi Geçen', 'Tamamlama Oranı'],
            ...(json.completionByOwner ?? []).map((item) => [item.owner, item.customers, item.answered, item.pending, item.open, item.overdue, `%${item.completionRate}`]),
          ],
        },
        {
          name: 'Aylık Bütçe Etkisi',
          widths: [20, 18, 22, 18, 22],
          rows: [
            ['Ay', 'Mevcut Forecast', 'Ay Dışına Kayacak', 'Aya Gelecek', 'Risk Sonrası Görünüm'],
            ...(json.budgetImpact ?? []).map((item) => [item.periodLabel, item.currentForecast, item.outgoing, item.incoming, item.projected]),
          ],
        },
      ]);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `engel-etki-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      appToast.success('Excel hazırlandı', 'Müşteri, ekip ve bütçe raporu indirildi.');
    } catch (error: any) {
      appToast.error('Excel oluşturulamadı', error?.message || 'Dosya hazırlanamadı.');
    } finally {
      setExporting(false);
    }
  }

  const kpis = [
    { label: 'Toplam Müşteri', value: summary.activeCustomers, hint: isAdmin ? 'Tüm satış portföyü' : 'Sorumluluğunuzdaki müşteriler', icon: ClipboardCheck, tone: 'slate' },
    { label: 'Cevap Bekleyen', value: summary.pending, hint: summary.pending ? 'Bilgi girişi gerekiyor' : 'Tüm müşteriler cevaplandı', icon: CircleAlert, tone: summary.pending ? 'amber' : 'green' },
    { label: 'Açık Engel', value: summary.open, hint: 'Takip edilmesi gereken müşteri', icon: AlertTriangle, tone: summary.open ? 'red' : 'green' },
    { label: 'Tarihi Geçen', value: summary.overdue, hint: 'Planlanan çözüm tarihi aşıldı', icon: CalendarClock, tone: summary.overdue ? 'red' : 'green' },
    { label: 'Risk Altındaki Adet', value: summary.riskQuantity, hint: 'Başka aya kayma ihtimali', icon: BarChart3, tone: summary.riskQuantity ? 'violet' : 'green' },
  ];

  return (
    <main className="blocker-page premium-workspace">
      <section className="blocker-hero">
        <div className="blocker-hero-copy">
          <span className="blocker-eyebrow"><ShieldCheck size={15} /> Satış Risk Yönetimi</span>
          <h1>Engel &amp; Etki Takibi</h1>
          <p>{isAdmin ? 'Tüm satış ekibinin müşteri portföyündeki engelleri ve bütçe etkisini yönetin.' : 'Kendi müşteri portföyünüzdeki engelleri, çözüm sorumlusunu ve satış etkisini bildirin.'}</p>
          <div className="blocker-hero-progress">
            <span><strong>%{summary.completionRate}</strong> cevaplanma</span>
            <div className="blocker-progress"><i style={{ width: `${summary.completionRate}%` }} /></div>
          </div>
        </div>
        <div className="blocker-hero-actions">
          {isAdmin ? <button type="button" className="blocker-btn light" onClick={() => void exportWorkbook()} disabled={exporting}><Download size={17} /> {exporting ? 'Hazırlanıyor...' : 'Yönetim Raporu'}</button> : null}
          <button type="button" className="blocker-btn light" onClick={() => void loadData()} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Yenile</button>
        </div>
      </section>

      {onboarding ? <section className="blocker-setup-alert"><AlertTriangle size={22} /><div><strong>Engel ve Etki SQL kurulumu bekleniyor.</strong><span><code>sql/forecast_blocker_impact_setup.sql</code> dosyasını PostgreSQL üzerinde çalıştırın.</span></div></section> : null}
      {message ? <section className="blocker-error"><CircleAlert size={19} /> {message}</section> : null}

      {summary.pending > 0 && !onboarding ? (
        <section className="blocker-action-banner">
          <div className="blocker-action-icon"><ClipboardCheck size={23} /></div>
          <div><strong>{isAdmin ? `${summary.pending} müşteri için ekip cevabı bekleniyor` : `${summary.pending} müşteriniz için kısa değerlendirme bekleniyor`}</strong><span>{isAdmin ? 'Kullanıcı Tamamlama sekmesinden eksikleri kişi bazında takip edebilirsiniz.' : 'Her müşteri için yalnızca üç soruyu cevaplamanız yeterli.'}</span></div>
          <button type="button" onClick={() => { setView('customers'); setStatus('pending'); setPage(1); }}>Bekleyenleri Aç <ArrowRight size={16} /></button>
        </section>
      ) : null}

      <section className="blocker-kpi-grid">
        {kpis.map((item) => {
          const Icon = item.icon;
          return <article key={item.label} className={`blocker-kpi tone-${item.tone}`}><span className="blocker-kpi-icon"><Icon size={19} /></span><div><span>{item.label}</span><strong>{numberFormat(item.value)}</strong><small>{item.hint}</small></div></article>;
        })}
      </section>

      {isAdmin ? (
        <nav className="blocker-view-tabs" aria-label="Yönetim görünümleri">
          <button type="button" className={view === 'customers' ? 'active' : ''} onClick={() => setView('customers')}><ClipboardCheck size={18} /><span>Müşteri Listesi</span></button>
          <button type="button" className={view === 'team' ? 'active' : ''} onClick={() => setView('team')}><Users size={18} /><span>Kullanıcı Tamamlama</span></button>
          <button type="button" className={view === 'budget' ? 'active' : ''} onClick={() => setView('budget')}><BarChart3 size={18} /><span>Bütçe Etkisi</span></button>
        </nav>
      ) : null}

      {view === 'customers' ? (
        <>
          <section className="blocker-filter-card">
            <div className="blocker-filter-top"><div><span>Müşteri Portföyü</span><h2>{isAdmin ? 'Tüm ekibin müşteri engellerini yönetin' : 'Kendi müşterilerinizin değerlendirmesini tamamlayın'}</h2></div><button type="button" className="blocker-clear" onClick={() => { setQ(''); setStatus(''); setOwner(''); setCategory(''); setPage(1); }}>Filtreleri Temizle</button></div>
            <div className="blocker-filters">
              <label className="blocker-search"><Search size={17} /><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Müşteri, sektör, engel veya sorumlu ara" /></label>
              {isAdmin ? <label><span>Account</span><select value={owner} onChange={(event) => { setOwner(event.target.value); setPage(1); }}><option value="">Tüm kullanıcılar</option>{ownerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}
              <label><span>Engel Türü</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">Tüm kategoriler</option>{BLOCKER_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label><span>Gösterim</span><select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10 / sayfa</option><option value="20">20 / sayfa</option><option value="50">50 / sayfa</option><option value="100">100 / sayfa</option></select></label>
            </div>
            <div className="blocker-status-tabs">{statusTabs.map((item) => <button key={item.value || 'all'} type="button" className={status === item.value ? 'active' : ''} onClick={() => { setStatus(item.value); setPage(1); }}>{item.label}<b>{item.count}</b></button>)}</div>
          </section>

          <section className="blocker-list-card">
            <div className="blocker-list-head"><div><span>{isAdmin ? 'Tüm Satış Müşterileri' : 'Müşterilerim'}</span><strong>{numberFormat(total)} müşteri · Sayfa {page}/{totalPages}</strong></div><div className="blocker-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Önceki</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Sonraki</button></div></div>

            {loading ? <div className="blocker-empty"><RefreshCw size={25} className="spin" /><strong>Müşteriler yükleniyor</strong></div> : rows.length === 0 ? <div className="blocker-empty"><CheckCircle2 size={30} /><strong>Bu filtrede müşteri bulunamadı</strong><span>Filtreleri temizleyerek portföyü tekrar görüntüleyebilirsiniz.</span></div> : (
              <>
                <div className="blocker-table-wrap">
                  <table className="blocker-table">
                    <thead><tr><th>Müşteri</th>{isAdmin ? <th>Account</th> : null}<th>Forecast Özeti</th><th>Engel / Sorumlu</th><th>Gecikme Etkisi</th><th>Durum</th><th aria-label="Aksiyon" /></tr></thead>
                    <tbody>{rows.map((row) => (
                      <tr key={row.customer_id} className={row.effective_status === 'pending' || row.effective_status === 'overdue' ? `row-${row.effective_status}` : ''}>
                        <td><div className="project-cell"><strong>{row.musteri}</strong><span>{row.sektor || 'Sektör belirtilmemiş'}</span></div></td>
                        {isAdmin ? <td><div className="owner-cell"><span className="owner-avatar">{String(row.sorumlu ?? '?').trim().charAt(0).toUpperCase()}</span><span>{row.sorumlu || 'Atanmamış'}</span></div></td> : null}
                        <td><div className="plan-cell"><strong>{row.active_forecast_count ? `${numberFormat(row.active_forecast_count)} aktif Forecast` : 'Forecast yok'}</strong><span>{row.active_forecast_count ? `${numberFormat(row.total_forecast_quantity)} toplam adet` : 'Engel kaydı yine girilebilir'}</span></div></td>
                        <td>{row.effective_status === 'pending' ? <span className="muted">Henüz cevap girilmedi</span> : row.has_blocker ? <div className="obstacle-cell"><strong>{categoryLabel(row.blocker_category)}</strong><span>{row.blocker_description}</span><small>{row.resolution_owner_name} · {formatDate(row.resolution_due_date)}</small></div> : <div className="no-obstacle"><CheckCircle2 size={16} /> Satışın önünde engel yok</div>}</td>
                        <td><div className={row.impact_type === 'month_shift' ? 'impact-cell has-impact' : 'impact-cell'}><strong>{row.impact_type === 'month_shift' ? `${numberFormat(row.shifted_quantity)} adet` : 'Etki yok'}</strong><span>{row.impact_type === 'month_shift' ? `${row.forecast_period_label} → ${row.shift_period_label}` : row.active_forecast_count ? 'Mevcut satış planı korunuyor' : 'Aktif Forecast bulunmuyor'}</span></div></td>
                        <td><span className={`blocker-status tone-${statusTone(row.effective_status)}`}>{statusLabel(row.effective_status)}</span>{row.reviewed_at ? <small className="reviewed-mark"><UserRoundCheck size={13} /> İncelendi</small> : null}</td>
                        <td><div className="row-actions"><button type="button" className="row-primary" onClick={() => openForm(row)}>{row.blocker_id ? 'Güncelle' : 'Cevapla'} <ChevronRight size={15} /></button>{row.has_blocker && row.effective_status !== 'resolved' ? <button type="button" className="row-icon success" title="Çözüldü olarak işaretle" onClick={() => void updateWorkflow(row, 'resolve')}><CheckCircle2 size={17} /></button> : null}{row.effective_status === 'resolved' ? <button type="button" className="row-icon" title="Yeniden aç" onClick={() => void updateWorkflow(row, 'reopen')}><RefreshCw size={16} /></button> : null}</div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

                <div className="blocker-mobile-list">{rows.map((row) => (
                  <article key={row.customer_id} className={`blocker-mobile-card state-${row.effective_status}`}>
                    <div className="mobile-card-top"><div><strong>{row.musteri}</strong><span>{row.sektor || 'Sektör belirtilmemiş'}</span></div><span className={`blocker-status tone-${statusTone(row.effective_status)}`}>{statusLabel(row.effective_status)}</span></div>
                    <div className="mobile-plan"><span><b>{row.active_forecast_count ? `${row.active_forecast_count} aktif Forecast` : 'Forecast yok'}</b>{row.active_forecast_count ? ` · ${numberFormat(row.total_forecast_quantity)} adet` : ''}</span>{isAdmin ? <span>Account: <b>{row.sorumlu || 'Atanmamış'}</b></span> : null}</div>
                    {row.effective_status === 'pending' ? <div className="mobile-pending"><CircleAlert size={18} /><span>Bu müşteri için değerlendirme bekleniyor.</span></div> : row.has_blocker ? <div className="mobile-detail-grid"><div><small>Engel</small><strong>{categoryLabel(row.blocker_category)}</strong><span>{row.blocker_description}</span></div><div><small>Kim / Tarih</small><strong>{row.resolution_owner_name}</strong><span>{formatDate(row.resolution_due_date)}</span></div><div><small>Gecikme Etkisi</small><strong>{row.impact_type === 'month_shift' ? `${numberFormat(row.shifted_quantity)} adet` : 'Etki yok'}</strong><span>{row.impact_type === 'month_shift' ? `${row.forecast_period_label} → ${row.shift_period_label}` : 'Satış kayması beklenmiyor'}</span></div></div> : <div className="mobile-no-obstacle"><CheckCircle2 size={18} /> Satışın önünde engel bulunmuyor.</div>}
                    <div className="mobile-card-actions"><button type="button" onClick={() => openForm(row)}>{row.blocker_id ? 'Bilgiyi Güncelle' : '3 Soruyu Cevapla'} <ChevronRight size={16} /></button>{row.has_blocker && row.effective_status !== 'resolved' ? <button type="button" className="secondary" onClick={() => void updateWorkflow(row, 'resolve')}>Çözüldü</button> : null}{row.effective_status === 'resolved' ? <button type="button" className="secondary" onClick={() => void updateWorkflow(row, 'reopen')}>Yeniden Aç</button> : null}</div>
                  </article>
                ))}</div>
              </>
            )}
          </section>
        </>
      ) : null}

      {view === 'team' && isAdmin ? (
        <section className="blocker-report-card">
          <div className="report-card-head"><div><span>Ekip Takibi</span><h2>Kullanıcı Tamamlama Durumu</h2><p>Her satışçının sorumluluğundaki tüm müşterileri cevaplayıp cevaplamadığını görün.</p></div><Users size={24} /></div>
          <div className="team-summary-strip"><div><span>Toplam Kullanıcı</span><strong>{completion.length}</strong></div><div><span>Tümünü Tamamlayan</span><strong>{completion.filter((item) => item.pending === 0).length}</strong></div><div><span>Cevabı Eksik</span><strong>{completion.filter((item) => item.pending > 0).length}</strong></div></div>
          <div className="blocker-table-wrap team-table-wrap"><table className="blocker-table team-table"><thead><tr><th>Kullanıcı</th><th>Toplam Müşteri</th><th>Cevaplanan</th><th>Cevap Bekleyen</th><th>Açık Engel</th><th>Tarihi Geçen</th><th>Tamamlama</th></tr></thead><tbody>{completion.map((item) => <tr key={item.owner}><td><div className="owner-cell"><span className="owner-avatar">{item.owner.charAt(0).toUpperCase()}</span><strong>{item.owner}</strong></div></td><td>{numberFormat(item.customers)}</td><td>{numberFormat(item.answered)}</td><td><button type="button" className={item.pending ? 'metric-link danger' : 'metric-link'} onClick={() => { setView('customers'); setOwner(item.owner); setStatus('pending'); setPage(1); }}>{numberFormat(item.pending)}</button></td><td>{numberFormat(item.open)}</td><td>{numberFormat(item.overdue)}</td><td><div className="completion-cell"><div><i style={{ width: `${item.completionRate}%` }} /></div><strong>%{item.completionRate}</strong></div></td></tr>)}</tbody></table></div>
          <div className="team-mobile-list">{completion.map((item) => <article key={item.owner}><div className="team-mobile-top"><span className="owner-avatar">{item.owner.charAt(0).toUpperCase()}</span><div><strong>{item.owner}</strong><span>{item.customers} müşteri</span></div><b>%{item.completionRate}</b></div><div className="completion-cell"><div><i style={{ width: `${item.completionRate}%` }} /></div></div><div className="team-mobile-metrics"><span>Cevaplanan <b>{item.answered}</b></span><button type="button" onClick={() => { setView('customers'); setOwner(item.owner); setStatus('pending'); setPage(1); }}>Bekleyen <b>{item.pending}</b></button><span>Geciken <b>{item.overdue}</b></span></div></article>)}</div>
        </section>
      ) : null}

      {view === 'budget' && isAdmin ? (
        <section className="blocker-report-card">
          <div className="report-card-head"><div><span>Yönetim Raporu</span><h2>Aylık Satış Kayması</h2><p>Tüm aktif Forecast’lar ile açık engellerde bildirilen satış kaymalarını birlikte gösterir.</p></div><BarChart3 size={24} /></div>
          <div className="budget-callout"><AlertTriangle size={19} /><span><strong>{numberFormat(summary.riskQuantity)} adet</strong> açık engeller nedeniyle farklı bir aya kayma riski taşıyor.</span></div>
          <div className="blocker-table-wrap"><table className="blocker-table budget-table"><thead><tr><th>Ay</th><th>Mevcut Forecast</th><th>Ay Dışına Kayacak</th><th>Aya Gelecek</th><th>Risk Sonrası Görünüm</th></tr></thead><tbody>{budget.map((item) => <tr key={item.key}><td><strong>{item.periodLabel}</strong></td><td>{numberFormat(item.currentForecast)}</td><td><span className={item.outgoing ? 'budget-number outgoing' : 'budget-number'}>{item.outgoing ? `-${numberFormat(item.outgoing)}` : '0'}</span></td><td><span className={item.incoming ? 'budget-number incoming' : 'budget-number'}>{item.incoming ? `+${numberFormat(item.incoming)}` : '0'}</span></td><td><strong className="projected-number">{numberFormat(item.projected)}</strong></td></tr>)}</tbody></table></div>
          <div className="budget-mobile-list">{budget.map((item) => <article key={item.key}><div><strong>{item.periodLabel}</strong><span>Mevcut {numberFormat(item.currentForecast)}</span></div><div className="budget-flow"><span className="outgoing">-{numberFormat(item.outgoing)}</span><ArrowRight size={15} /><strong>{numberFormat(item.projected)}</strong><ArrowRight size={15} /><span className="incoming">+{numberFormat(item.incoming)}</span></div><small>Risk sonrası görünüm</small></article>)}</div>
        </section>
      ) : null}

      {selected ? (
        <div className="blocker-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <aside className="blocker-drawer" role="dialog" aria-modal="true" aria-label="Engel ve Etki Bildirimi">
            <header className="drawer-head"><div><span>Engel ve Etki Bildirimi</span><h2>{selected.musteri}</h2><p>{selected.sektor || 'Sektör belirtilmemiş'}</p></div><button type="button" onClick={closeForm} aria-label="Kapat"><X size={20} /></button></header>
            <div className="drawer-project-summary"><div><span>Aktif Forecast</span><strong>{numberFormat(selected.active_forecast_count)}</strong></div><div><span>Toplam Forecast adedi</span><strong>{numberFormat(selected.total_forecast_quantity)} adet</strong></div>{isAdmin ? <div><span>Account</span><strong>{selected.sorumlu || 'Atanmamış'}</strong></div> : null}</div>

            <div className="drawer-body">
              <section className="question-block">
                <div className="question-title"><b>1</b><div><h3>Satışın önünde engel var mı?</h3><p>Bu müşteride satışı durduran veya satış tarihini riske atan bir konu bulunuyor mu?</p></div></div>
                <div className="choice-grid two">
                  <button type="button" className={form.hasBlocker === 'no' ? 'choice active success' : 'choice'} onClick={() => setForm((value) => ({ ...value, hasBlocker: 'no', blockerCategory: '', blockerDescription: '', resolutionOwnerType: '', resolutionOwnerName: '', resolutionDueDate: '', impactType: 'none', forecastId: '', shiftMonth: '', shiftedQuantity: '', workflowStatus: 'open' }))}><CheckCircle2 size={20} /><span><strong>Engel yok</strong><small>Satış süreci normal ilerliyor</small></span></button>
                  <button type="button" className={form.hasBlocker === 'yes' ? 'choice active danger' : 'choice'} onClick={() => setForm((value) => ({ ...value, hasBlocker: 'yes', forecastId: value.forecastId || selected.forecast_options?.[0]?.forecast_id || '' }))}><AlertTriangle size={20} /><span><strong>Engel var</strong><small>Takip edilmesi gereken konu var</small></span></button>
                </div>
                {form.hasBlocker === 'yes' ? <div className="question-fields"><label><span>Engel türü *</span><select value={form.blockerCategory} onChange={(event) => setForm((value) => ({ ...value, blockerCategory: event.target.value }))}><option value="">Seçiniz</option>{BLOCKER_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Engeli net olarak açıklayın *</span><textarea rows={4} maxLength={500} value={form.blockerDescription} onChange={(event) => setForm((value) => ({ ...value, blockerDescription: event.target.value }))} placeholder="Örnek: Müşterinin pilot mağaza listesini paylaşması bekleniyor." /><small>{form.blockerDescription.length}/500</small></label></div> : null}
              </section>

              {form.hasBlocker === 'yes' ? <section className="question-block"><div className="question-title"><b>2</b><div><h3>Kim, hangi tarihte çözecek?</h3><p>Sorumlu tarafı ve gerçekçi hedef tarihi belirtin.</p></div></div><div className="question-fields grid-two"><label><span>Sorumlu taraf *</span><select value={form.resolutionOwnerType} onChange={(event) => setForm((value) => ({ ...value, resolutionOwnerType: event.target.value }))}><option value="">Seçiniz</option>{RESOLUTION_OWNER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Planlanan çözüm tarihi *</span><input type="date" value={form.resolutionDueDate} onChange={(event) => setForm((value) => ({ ...value, resolutionDueDate: event.target.value }))} /></label><label className="full"><span>Çözüm sorumlusu *</span><input value={form.resolutionOwnerName} onChange={(event) => setForm((value) => ({ ...value, resolutionOwnerName: event.target.value }))} placeholder="Kişi, müşteri ekibi, banka veya iş ortağı" /></label><label className="full"><span>Takip durumu</span><select value={form.workflowStatus} onChange={(event) => setForm((value) => ({ ...value, workflowStatus: event.target.value as FormState['workflowStatus'] }))}><option value="open">Çözüm bekleniyor</option><option value="in_progress">Çözüm çalışması başladı</option></select></label></div></section> : null}

              {form.hasBlocker === 'yes' ? (
                <section className="question-block">
                  <div className="question-title"><b>3</b><div><h3>Gecikirse satış nasıl etkilenecek?</h3><p>Aktif Forecast varsa hangi satış kaleminin başka aya kayacağını belirtin.</p></div></div>
                  {!selected.forecast_options.length ? <div className="blocker-setup-alert"><CircleAlert size={20} /><div><strong>Bu müşteride aktif Forecast bulunmuyor.</strong><span>Engel ve çözüm bilgisi kaydedilebilir; adet ve ay kayması için önce Forecast girişi yapılmalıdır.</span></div></div> : null}
                  <div className="choice-grid two"><button type="button" className={form.impactType === 'none' ? 'choice active success' : 'choice'} onClick={() => setForm((value) => ({ ...value, impactType: 'none', shiftMonth: '', shiftedQuantity: '' }))}><CheckCircle2 size={20} /><span><strong>Kayma beklenmiyor</strong><small>Aktif plan korunacak</small></span></button><button type="button" disabled={!selected.forecast_options.length} className={form.impactType === 'month_shift' ? 'choice active warning' : 'choice'} onClick={() => setForm((value) => ({ ...value, impactType: 'month_shift', forecastId: value.forecastId || selected.forecast_options[0]?.forecast_id || '' }))}><CalendarClock size={20} /><span><strong>Başka aya kayacak</strong><small>Bütçe etkisi oluşacak</small></span></button></div>
                  {form.impactType === 'month_shift' ? <div className="question-fields"><label><span>Etkilenen Forecast *</span><select value={form.forecastId} onChange={(event) => setForm((value) => ({ ...value, forecastId: event.target.value, shiftedQuantity: '' }))}><option value="">Forecast seçiniz</option>{selected.forecast_options.map((item) => <option key={item.forecast_id} value={item.forecast_id}>{forecastTitle(item)}</option>)}</select></label><div className="question-fields grid-three"><label><span>Kayacağı ay *</span><select value={form.shiftMonth} onChange={(event) => setForm((value) => ({ ...value, shiftMonth: event.target.value }))}><option value="">Ay seçiniz</option>{FORECAST_MONTHS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Kayacağı yıl *</span><select value={form.shiftYear} onChange={(event) => setForm((value) => ({ ...value, shiftYear: event.target.value }))}>{YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label><span>Kayacak adet *</span><input type="number" min={1} max={selectedForecast?.quantity ?? undefined} value={form.shiftedQuantity} onChange={(event) => setForm((value) => ({ ...value, shiftedQuantity: event.target.value }))} placeholder={selectedForecast ? `En fazla ${selectedForecast.quantity}` : 'Önce Forecast seçin'} /></label><div className="impact-preview"><span>Olası satış kayması</span><strong>{selectedForecast?.period_label ?? 'Forecast seçin'} <ArrowRight size={16} /> {form.shiftMonth ? periodLabel(form.shiftYear, form.shiftMonth) : 'Yeni dönem'}</strong><small>{form.shiftedQuantity ? `${numberFormat(form.shiftedQuantity)} adet risk altında` : 'Kayacak adedi girin'}</small></div></div></div> : null}
                </section>
              ) : null}

              {isAdmin && form.hasBlocker ? <section className="manager-review-block"><div className="question-title"><b><UserRoundCheck size={18} /></b><div><h3>Yönetim incelemesi</h3><p>Satışçı cevabına yönetim notu ekleyin ve incelendi olarak işaretleyin.</p></div></div><label><span>Yönetim notu</span><textarea rows={3} value={form.managerNote} onChange={(event) => setForm((value) => ({ ...value, managerNote: event.target.value }))} placeholder="Karar, takip notu veya yönlendirme..." /></label><label className="review-check"><input type="checkbox" checked={form.reviewed} onChange={(event) => setForm((value) => ({ ...value, reviewed: event.target.checked }))} /><span><strong>Yönetim tarafından incelendi</strong><small>Müşteri listesinde incelendi işareti gösterilir.</small></span></label></section> : null}
            </div>

            <footer className="drawer-footer"><button type="button" className="cancel" onClick={closeForm} disabled={saving}>Vazgeç</button><button type="button" className="save" onClick={() => void saveForm()} disabled={saving || onboarding}><Save size={17} /> {saving ? 'Kaydediliyor...' : form.hasBlocker === 'no' ? 'Engel Yok Olarak Kaydet' : 'Bilgileri Kaydet'}</button></footer>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
