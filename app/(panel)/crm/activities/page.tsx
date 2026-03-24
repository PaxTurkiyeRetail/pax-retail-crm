'use client';
import '@/styles/activities-page.css';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSlaPresentation, getSlaState } from '@/lib/sla';
import { formatDate } from '@/lib/utils';
import ActivitiesDashboard from '@/components/activities/ActivitiesDashboard';

type ActivityRow = {
  id: string;
  faz_no: number | null;
  activity_label: string | null;
  activity_status?: string | null;
  owner: string | null;
  created_by?: string | null;
  partner_owner?: string | null;
  created_at: string;
  due_date: string | null;
  musteriler: { musteri: string; sorumlu: string | null } | null;
  sla_presentation?: ReturnType<typeof getSlaPresentation>;
};

type ActivityRowWithSla = ActivityRow & {
  sla: ReturnType<typeof getSlaPresentation>;
};

type FilterOptions = {
  phaseOptions: string[];
  statusOptions: string[];
  partnerOptions: string[];
  ownerOptions: string[];
  responsibleOptions: string[];
};

type TimeRange = 'week' | 'month' | 'quarter' | 'all';
type RoleKey = 'sales' | 'rs';

const EMPTY_OPTIONS: FilterOptions = {
  phaseOptions: [],
  statusOptions: [],
  partnerOptions: [],
  ownerOptions: [],
  responsibleOptions: [],
};

const SLA_OPTIONS = ['', 'overdue', 'today', 'upcoming', 'waiting', 'completed', 'unscheduled'];
const SLA_LABELS: Record<string, string> = {
  overdue: 'Geciken',
  today: 'Bugün',
  upcoming: 'Planlı',
  waiting: 'Bekliyor',
  completed: 'Tamamlanan',
  unscheduled: 'Tarihsiz',
};

const PHASE_DEFS = [
  { key: 'lead', title: 'Lead', range: 'Faz 1-4', colorClass: 'lead', match: (v: number | null) => (v ?? 0) >= 1 && (v ?? 0) <= 4 },
  { key: 'first', title: 'İlk Temas', range: 'Faz 5-8', colorClass: 'first', match: (v: number | null) => (v ?? 0) >= 5 && (v ?? 0) <= 8 },
  { key: 'business', title: 'Business', range: 'Faz 9-14', colorClass: 'business', match: (v: number | null) => (v ?? 0) >= 9 && (v ?? 0) <= 14 },
  { key: 'ops', title: 'Operasyon', range: 'Faz 15-22', colorClass: 'ops', match: (v: number | null) => (v ?? 0) >= 15 && (v ?? 0) <= 22 },
  { key: 'rollout', title: 'Yayılım', range: 'Faz 23+', colorClass: 'rollout', match: (v: number | null) => (v ?? 0) >= 23 },
] as const;


function toIsoDate(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function getRangeDates(range: TimeRange) {
  const end = new Date();
  if (range === 'all') return { from: '', to: '' };
  const start = new Date();
  if (range === 'week') start.setDate(end.getDate() - 6);
  if (range === 'month') start.setDate(end.getDate() - 29);
  if (range === 'quarter') start.setDate(end.getDate() - 89);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function resolveRole(row: ActivityRow): RoleKey {
  const source = `${row.owner ?? ''} ${row.partner_owner ?? ''}`.toLocaleLowerCase('tr-TR');
  const rsHints = ['retail support', 'support', 'destek', 'teknik', 'rs', 'ishak', 'işhak', 'taha'];
  return rsHints.some((hint) => source.includes(hint)) ? 'rs' : 'sales';
}


export default function ActivitiesPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<ActivityRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [fazNo, setFazNo] = useState('');
  const [sla, setSla] = useState('');
  const [owner, setOwner] = useState('');
  const [responsible, setResponsible] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const rangeDates = useMemo(() => getRangeDates(timeRange), [timeRange]);
  const effectiveFrom = fromDate || rangeDates.from;
  const effectiveTo = toDate || rangeDates.to;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const loadOptions = async () => {
      const res = await fetch('/api/activities/options', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) setOptions({ ...EMPTY_OPTIONS, ...(payload ?? {}) });
    };
    void loadOptions();
  }, []);

  useEffect(() => {
    // Filtre değişince sayfa sıfırla
    setPage(1);
  }, [debouncedQ, status, fazNo, sla, owner, responsible, effectiveFrom, effectiveTo]);

  useEffect(() => {
    const buildParams = (extra: Record<string, string>) => {
      const p = new URLSearchParams({ ...extra });
      if (debouncedQ) p.set('q', debouncedQ);
      if (status) p.set('durum', status);
      if (fazNo) p.set('faz_no', fazNo);
      if (sla) p.set('sla', sla);
      if (owner) p.set('owner', owner);
      if (responsible) p.set('responsible', responsible);
      if (effectiveFrom) p.set('from', effectiveFrom);
      if (effectiveTo) p.set('to', effectiveTo);
      return p;
    };

    const load = async () => {
      setLoading(true);
      setMsg(null);
      try {
        // Sayfalı liste + analytics fetch'leri paralel çalışır
        const [listRes, analyticsRes] = await Promise.all([
          fetch(`/api/activities/list?${buildParams({ page: String(page), pageSize: String(pageSize) }).toString()}`, { cache: 'no-store' }),
          fetch(`/api/activities/list?${buildParams({ page: '1', pageSize: '500' }).toString()}`, { cache: 'no-store' }),
        ]);
        const [listPayload, analyticsPayload] = await Promise.all([
          listRes.json().catch(() => ({})),
          analyticsRes.json().catch(() => ({})),
        ]);
        if (!listRes.ok) {
          setMsg(listPayload?.message || 'Liste alınamadı');
          setRows([]);
          setTotal(0);
        } else {
          setRows(listPayload.rows ?? []);
          setTotal(Number(listPayload.total ?? 0));
          setServerToday(typeof listPayload.serverToday === 'string' ? listPayload.serverToday : null);
        }
        if (analyticsRes.ok) setAnalyticsRows(analyticsPayload.rows ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [debouncedQ, page, pageSize, status, fazNo, sla, owner, responsible, effectiveFrom, effectiveTo]);

  const slimRows = useMemo<ActivityRowWithSla[]>(
    () => rows.map((row) => ({ ...row, sla: row.sla_presentation ?? getSlaPresentation(row.due_date, row.activity_status, serverToday) })),
    [rows, serverToday],
  );

  const analyticsSlimRows = useMemo<ActivityRowWithSla[]>(
    () => analyticsRows.map((row) => ({ ...row, sla: row.sla_presentation ?? getSlaPresentation(row.due_date, row.activity_status, serverToday) })),
    [analyticsRows, serverToday],
  );

  const personRows = useMemo(() => {
    const map = new Map<string, { title: string; role: string; totalCount: number; overdueCount: number; firms: Set<string> }>();
    analyticsSlimRows.forEach((row) => {
      const title = (row.owner ?? '').trim() || 'Tanımsız Kişi';
      const role = resolveRole(row) === 'rs' ? 'Retail Support' : 'Sales';
      const firm = (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma';
      if (!map.has(title)) map.set(title, { title, role, totalCount: 0, overdueCount: 0, firms: new Set() });
      const item = map.get(title)!;
      item.totalCount += 1;
      item.firms.add(firm);
      if (getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue') item.overdueCount += 1;
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, firms: v.firms.size }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [analyticsSlimRows, serverToday]);

  const roleRows = useMemo(() => {
    const roles = [
      { title: 'Sales', key: 'sales' as const },
      { title: 'Retail Support', key: 'rs' as const },
    ];
    return roles.map((role) => {
      const subset = analyticsSlimRows.filter((row) => resolveRole(row) === role.key);
      const firmCount = new Set(subset.map((row) => (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma')).size;
      const overdue = subset.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue').length;
      const today = subset.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'today').length;
      return { title: role.title, totalCount: subset.length, firms: firmCount, overdueCount: overdue, todayCount: today };
    });
  }, [analyticsSlimRows, serverToday]);

  const leaderboard = personRows.slice(0, 3);
  const salesTotal = roleRows.find((row) => row.title === 'Sales')?.totalCount ?? 0;
  const rsTotal = roleRows.find((row) => row.title === 'Retail Support')?.totalCount ?? 0;
  const overdueTotal = analyticsSlimRows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue').length;
  const todayTotal = analyticsSlimRows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'today').length;
  const completedTotal = analyticsSlimRows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'completed').length;
  const slaHealthPct = Math.round((completedTotal / Math.max(1, analyticsSlimRows.length)) * 100);

  const companyPhase = useMemo(() => {
    const latestByFirm = new Map<string, ActivityRowWithSla>();
    analyticsSlimRows.forEach((row) => {
      const firm = (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma';
      const existing = latestByFirm.get(firm);
      if (!existing || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
        latestByFirm.set(firm, row);
      }
    });

    const totalFirms = latestByFirm.size;
    const list = PHASE_DEFS.map((phase) => {
      let count = 0;
      latestByFirm.forEach((row) => {
        if (phase.match(row.faz_no)) count += 1;
      });
      return {
        ...phase,
        count,
        pct: percentage(count, totalFirms || 1),
      };
    });

    return {
      totalFirms,
      list,
    };
  }, [analyticsSlimRows]);

  const riskByPhase = useMemo(() => {
    return companyPhase.list
      .map((item) => ({
        title: item.title,
        count: item.count,
        pct: item.pct,
      }))
      .sort((a, b) => b.count - a.count)[0];
  }, [companyPhase]);

  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const dayOfWeek = startOfToday.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWorkWeek = new Date(startOfToday);
    startOfWorkWeek.setDate(startOfToday.getDate() + mondayOffset);

    const weekdayLabels = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM'];
    const weekdayBucket = Array.from({ length: 5 }, (_, index) => {
      const day = new Date(startOfWorkWeek);
      day.setDate(startOfWorkWeek.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      return {
        key,
        label: weekdayLabels[index],
        count: 0,
      };
    });
    const weekdayMap = new Map(weekdayBucket.map((item) => [item.key, item]));

    const currentWeekStart = new Date(startOfToday);
    currentWeekStart.setDate(startOfToday.getDate() - 6);
    const previousWeekStart = new Date(startOfToday);
    previousWeekStart.setDate(startOfToday.getDate() - 13);
    const previousWeekEnd = new Date(startOfToday);
    previousWeekEnd.setDate(startOfToday.getDate() - 7);

    let currentWeekCount = 0;
    let previousWeekCount = 0;
    const firmsThisWeek = new Set<string>();

    analyticsSlimRows.forEach((row) => {
      const created = new Date(row.created_at);
      const createdKey = created.toISOString().slice(0, 10);
      const firm = (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma';

      if (weekdayMap.has(createdKey)) {
        weekdayMap.get(createdKey)!.count += 1;
      }
      if (created >= currentWeekStart && created <= now) {
        currentWeekCount += 1;
        firmsThisWeek.add(firm);
      }
      if (created >= previousWeekStart && created <= previousWeekEnd) {
        previousWeekCount += 1;
      }
    });

    const momentumPct = previousWeekCount > 0
      ? Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100)
      : currentWeekCount > 0
        ? 100
        : 0;

    const atRiskFirmCount = new Set(
      analyticsSlimRows
        .filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue')
        .map((row) => (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma'),
    ).size;

    const avgPerFirm = companyPhase.totalFirms ? (analyticsSlimRows.length / companyPhase.totalFirms) : 0;
    const workWeekCount = weekdayBucket.reduce((sum, item) => sum + item.count, 0);

    return {
      momentumPct,
      currentWeekCount,
      previousWeekCount,
      newFirmsThisWeek: firmsThisWeek.size,
      atRiskFirmCount,
      avgPerFirm: avgPerFirm.toFixed(1),
      trend: weekdayBucket,
      trendTotal: workWeekCount,
      trendMax: Math.max(1, ...weekdayBucket.map((item) => item.count)),
    };
  }, [analyticsSlimRows, companyPhase.totalFirms, serverToday]);

  const dueDateAnalysis = useMemo(() => {
    const relevant = analyticsSlimRows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) !== 'completed');
    const overdue = relevant.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue').length;
    const dueToday = relevant.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'today').length;
    const onTime = relevant.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'upcoming').length;
    const totalOpen = Math.max(1, relevant.length);
    return {
      overdue,
      dueToday,
      onTime,
      totalOpen: relevant.length,
      overduePct: percentage(overdue, totalOpen),
      onTimePct: percentage(onTime, totalOpen),
    };
  }, [analyticsSlimRows, serverToday]);

  const activeFilterCount = [debouncedQ, status, fazNo, sla, owner, responsible, fromDate, toDate].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setFazNo('');
    setSla('');
    setOwner('');
    setResponsible('');
    setFromDate('');
    setToDate('');
    setTimeRange('week');
    setShowAdvanced(false);
    setPage(1);
  };

  return (
    <main className="pax-page-container">

      <ActivitiesDashboard
        slaHealthPct={slaHealthPct}
        dashboardMetrics={dashboardMetrics}
        companyPhase={companyPhase}
        leaderboard={leaderboard}
        riskByPhase={riskByPhase}
        salesTotal={salesTotal}
        rsTotal={rsTotal}
        dueDateAnalysis={dueDateAnalysis}
      />

      <section className="command-bar">
        <div className="command-shell">
          <div className="command-main">
            <div className="command-search">
              <span style={{ color: 'var(--text-3)' }}>⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, aktivite veya firma ara" />
            </div>
            <div className="command-select-wrap">
              <span className="command-label">Sorumlu</span>
              <select className="command-select" value={responsible} onChange={(e) => setResponsible(e.target.value)}>
                <option value="">Tüm sorumlular</option>
                {options.responsibleOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="command-select-wrap">
              <span className="command-label">Durum</span>
              <select className="command-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tüm durumlar</option>
                {options.statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="command-side" />
        </div>

        <div className="command-toolbar">
          <div className="command-meta-left">
            <span className="status-chip">{total} toplam sonuç</span>
            <span className="status-chip">{rows.length} görünür kayıt</span>
            <span className="status-chip">{pageSize} / sayfa</span>
            {activeFilterCount > 0 ? <span className="chip active">{activeFilterCount} aktif filtre</span> : null}
          </div>
          <div className="command-actions">
            <button className={`segment-btn${timeRange === 'week' ? ' active' : ''}`} onClick={() => setTimeRange('week')}>Haftalık</button>
            <button className={`segment-btn${timeRange === 'month' ? ' active' : ''}`} onClick={() => setTimeRange('month')}>Aylık</button>
            <button className={`segment-btn${timeRange === 'quarter' ? ' active' : ''}`} onClick={() => setTimeRange('quarter')}>Quarterly</button>
            <button className={`segment-btn${timeRange === 'all' ? ' active' : ''}`} onClick={() => setTimeRange('all')}>Tümü</button>
            <button className="command-action" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Detaylı aramayı kapat' : 'Detaylı arama'}</button>
            <button className="command-action ghost" onClick={clearFilters}>Sıfırla</button>
          </div>
        </div>

        {showAdvanced ? (
          <div className="advanced-shell">
            <div className="advanced-grid">
              <label className="field">
                <span className="field-label">Faz</span>
                <select className="select" value={fazNo} onChange={(e) => setFazNo(e.target.value)}>
                  <option value="">Tüm fazlar</option>
                  {options.phaseOptions.map((v) => <option key={v} value={v}>{`FAZ ${v}`}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">SLA / risk</span>
                <select className="select" value={sla} onChange={(e) => setSla(e.target.value)}>
                  <option value="">Tüm SLA</option>
                  {SLA_OPTIONS.filter(Boolean).map((v) => <option key={v} value={v}>{SLA_LABELS[v]}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Aktiviteyi giren</span>
                <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Tüm kişiler</option>
                  {options.ownerOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Başlangıç tarihi</span>
                <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Bitiş tarihi</span>
                <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="table-head">
          <div>
            <h2 className="section-title">Aktivite listesi</h2>
          </div>
          <div className="table-actions">
            <Link
              href="/crm/activities/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 12,
                border: '1px solid #0b2456',
                background: 'linear-gradient(135deg,#0b2456 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 10px 18px rgba(29,78,216,.22)',
              }}
            >
              Aktivite Ekle
            </Link>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Müşteri Adı</th>
                <th>Faz</th>
                <th>Ekleyen</th>
                <th>Bekleyen Taraf</th>
                <th>Sonraki Aksiyon</th>
                <th>Hedef Tarih</th>
                <th>SLA</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {slimRows.map((row) => {
                const role = resolveRole(row);
                return (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="name">{row.musteriler?.musteri ?? '-'}</div>
                      <div className="muted">Sorumlu: {row.musteriler?.sorumlu ?? '-'}</div>
                    </td>
                    <td><span className="phase-pill">{row.faz_no != null ? `FAZ ${row.faz_no}` : '-'}</span></td>
                    <td>
                      <div className="person-stack">
                        <span className="person-main">{row.owner ?? '-'}</span>
                        <span className="person-sub">{role === 'rs' ? 'Retail Support' : 'Sales'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="person-stack">
                        <span className="person-main">{row.partner_owner ?? '-'}</span>
                      </div>
                    </td>
                    <td><span className="activity-pill">{row.activity_label ?? '-'}</span></td>
                    <td>{formatDate(row.due_date)}</td>
                    <td>
                      <span className="sla-inline">
                        <span
                          className="sla-dot"
                          style={{
                            backgroundColor: row.sla.dotColor,
                            borderColor: row.sla.dotBorderColor ?? 'transparent',
                            color: row.sla.textColor ?? '#ffffff',
                          }}
                        >
                          {row.sla.dotText || ''}
                        </span>
                        <span className="sla-text">{row.sla.dayText || '-'}</span>
                      </span>
                    </td>
                    <td><Link className="link-btn" href={`/crm/activities/new?edit=${row.id}`}>Düzenle</Link></td>
                  </tr>
                );
              })}
              {!loading && !slimRows.length ? <tr><td colSpan={9} style={{ padding: 18, color: 'var(--text-3)' }}>Kayıt bulunamadı.</td></tr> : null}
              {loading ? <tr><td colSpan={9} style={{ padding: 18, color: 'var(--text-3)' }}>Yükleniyor...</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <div className="inline"><span style={{ color: 'var(--text-3)', fontSize: 13 }}>Toplam {total} kayıt · Sayfa {page} / {totalPages}</span></div>
          <div className="pager-buttons">
            <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button>
            <button className="btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
      </section>
    </main>
  );
}
