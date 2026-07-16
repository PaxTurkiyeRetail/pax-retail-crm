'use client';
import '@/styles/activities-page.css';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSlaPresentation, getSlaState } from '@/lib/sla';
import { formatDate, toLocalDateInputValue } from '@/lib/utils';
import ActivitiesDashboard from '@/components/activities/ActivitiesDashboard';

type ActivityRow = {
  id: string;
  faz_no: number | null;
  activity_label: string | null;
  activity_status?: string | null;
  notlar?: string | null;
  owner: string | null;
  created_by?: string | null;
  partner_owner?: string | null;
  phase_title?: string | null;
  phase_owner?: string | null;
  created_by_display?: string | null;
  is_business_partner?: boolean | null;
  created_at: string;
  due_date: string | null;
  is_blocked?: boolean | null;
  blocked_note?: string | null;
  blocked_at?: string | null;
  blocked_by?: string | null;
  musteriler: { musteri: string; sorumlu: string | null } | null;
  sla_presentation?: ReturnType<typeof getSlaPresentation>;
};

type ActivityRowWithSla = ActivityRow & {
  sla: ReturnType<typeof getSlaPresentation>;
};


type FazOption = {
  faz_no: number;
  asama_adi: string | null;
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
  return toLocalDateInputValue(copy);
}

function getSaturdayFridayWeekRange(baseDate = new Date()) {
  const start = new Date(baseDate);
  const diffToSaturday = (start.getDay() + 1) % 7;
  start.setDate(start.getDate() - diffToSaturday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getRangeDates(range: TimeRange) {
  if (range === 'all') return { from: '', to: '' };
  if (range === 'week') {
    const { start, end } = getSaturdayFridayWeekRange(new Date());
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  const end = new Date();
  const start = new Date();
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
  const [fazDefinitions, setFazDefinitions] = useState<Record<number, string>>({});
  const [partnerFazDefinitions, setPartnerFazDefinitions] = useState<Record<number, string>>({});
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [blockedFilter, setBlockedFilter] = useState('');
  const [blockingRowId, setBlockingRowId] = useState<string | null>(null);

  const rangeDates = useMemo(() => getRangeDates(timeRange), [timeRange]);
  const effectiveFrom = fromDate || rangeDates.from;
  const effectiveTo = toDate || rangeDates.to;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const loadOptions = async () => {
      const [optionsRes, fazRes, partnerFazRes] = await Promise.all([
        fetch('/api/activities/options', { cache: 'no-store' }),
        fetch('/api/faz/list', { cache: 'no-store' }),
        fetch('/api/faz/list?type=business-partner', { cache: 'no-store' }),
      ]);

      const optionsPayload = await optionsRes.json().catch(() => ({}));
      if (optionsRes.ok) setOptions({ ...EMPTY_OPTIONS, ...(optionsPayload ?? {}) });

      const fazPayload = await fazRes.json().catch(() => ({}));
      if (fazRes.ok) {
        const definitions = Object.fromEntries(
          ((fazPayload?.fazlar ?? []) as FazOption[])
            .filter((item) => item?.faz_no != null)
            .map((item) => [item.faz_no, (item.asama_adi ?? '').trim()])
            .filter((entry) => entry[1]),
        ) as Record<number, string>;
        setFazDefinitions(definitions);
      }

      const partnerFazPayload = await partnerFazRes.json().catch(() => ({}));
      if (partnerFazRes.ok) {
        const definitions = Object.fromEntries(
          ((partnerFazPayload?.fazlar ?? []) as FazOption[])
            .filter((item) => item?.faz_no != null)
            .map((item) => [item.faz_no, (item.asama_adi ?? '').trim()])
            .filter((entry) => entry[1]),
        ) as Record<number, string>;
        setPartnerFazDefinitions(definitions);
      }
    };
    void loadOptions();
  }, []);

  useEffect(() => {
    // Filtre değişince sayfa sıfırla
    setPage(1);
  }, [debouncedQ, status, fazNo, sla, owner, responsible, blockedFilter, effectiveFrom, effectiveTo]);

  const buildActivityParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...extra });
    if (debouncedQ) p.set('q', debouncedQ);
    if (status) p.set('durum', status);
    if (fazNo) p.set('faz_no', fazNo);
    if (sla) p.set('sla', sla);
    if (owner) p.set('owner', owner);
    if (responsible) p.set('responsible', responsible);
    if (blockedFilter) p.set('blocked', blockedFilter);
    if (effectiveFrom) p.set('from', effectiveFrom);
    if (effectiveTo) p.set('to', effectiveTo);
    return p;
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadList = async () => {
      setLoading(true);
      setMsg(null);
      try {
        const params = buildActivityParams({ page: String(page), pageSize: String(pageSize) });
        const listRes = await fetch(`/api/activities/list?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
        const listPayload = await listRes.json().catch(() => ({}));
        if (!listRes.ok) {
          setMsg(listPayload?.message || 'Liste alınamadı');
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(listPayload.rows ?? []);
        setTotal(Number(listPayload.total ?? 0));
        setServerToday(typeof listPayload.serverToday === 'string' ? listPayload.serverToday : null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setMsg('Liste alınamadı');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadList();
    return () => controller.abort();
  }, [debouncedQ, page, pageSize, status, fazNo, sla, owner, responsible, blockedFilter, effectiveFrom, effectiveTo]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const loadAnalytics = async () => {
        try {
          const params = buildActivityParams({ page: '1', pageSize: '1000', analytics: '1' });
          const analyticsRes = await fetch(`/api/activities/list?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
          const analyticsPayload = await analyticsRes.json().catch(() => ({}));
          if (analyticsRes.ok) setAnalyticsRows(analyticsPayload.rows ?? []);
        } catch {}
      };
      void loadAnalytics();
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedQ, status, fazNo, sla, owner, responsible, blockedFilter, effectiveFrom, effectiveTo]);

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

    const { start: currentWeekStart, end: currentWeekEnd } = getSaturdayFridayWeekRange(startOfToday);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    previousWeekStart.setHours(0, 0, 0, 0);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    previousWeekEnd.setHours(23, 59, 59, 999);

    const weekdayLabels = ['CMT', 'PAZ', 'PZT', 'SAL', 'ÇAR', 'PER', 'CUM'];
    const weekdayBucket = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + index);
      const key = toLocalDateInputValue(day);
      return {
        key,
        label: weekdayLabels[index],
        count: 0,
      };
    });
    const weekdayMap = new Map(weekdayBucket.map((item) => [item.key, item]));

    let currentWeekCount = 0;
    let previousWeekCount = 0;
    const firmsThisWeek = new Set<string>();

    analyticsSlimRows.forEach((row) => {
      const created = new Date(row.created_at);
      const createdKey = toLocalDateInputValue(created);
      const firm = (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma';

      if (weekdayMap.has(createdKey)) {
        weekdayMap.get(createdKey)!.count += 1;
      }
      if (created >= currentWeekStart && created <= currentWeekEnd) {
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


  const toggleBlock = async (row: ActivityRow) => {
    const willBlock = !row.is_blocked;
    let note = row.blocked_note ?? '';
    if (willBlock) {
      note = window.prompt('Blokaj notu', row.blocked_note ?? '')?.trim() ?? '';
    }

    setBlockingRowId(row.id);
    setMsg(null);
    try {
      const res = await fetch('/api/activities/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: row.id,
          blocked: willBlock,
          note,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(payload?.message || 'Blokaj güncellenemedi');
        return;
      }

      const nextRows = (current: ActivityRow[]) => current.map((item) => (
        item.id === row.id
          ? {
              ...item,
              is_blocked: Boolean(payload?.row?.is_blocked),
              blocked_note: payload?.row?.blocked_note ?? null,
              blocked_at: payload?.row?.blocked_at ?? null,
              blocked_by: payload?.row?.blocked_by ?? null,
            }
          : item
      ));

      setRows(nextRows);
      setAnalyticsRows((current) => nextRows(current));
    } finally {
      setBlockingRowId(null);
    }
  };

  const activeFilterCount = [debouncedQ, status, fazNo, sla, owner, responsible, blockedFilter, fromDate, toDate].filter(Boolean).length;
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
        dashboardMetrics={{
          ...dashboardMetrics,
          blockedCount: analyticsSlimRows.filter((row) => Boolean(row.is_blocked)).length,
          blockedFirmCount: new Set(analyticsSlimRows.filter((row) => Boolean(row.is_blocked)).map((row) => (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma')).size,
        }}
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
                <span className="field-label">Blokaj</span>
                <select className="select" value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="blocked">Sadece blokajlı</option>
                  <option value="unblocked">Sadece blokajsız</option>
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
          <table className="activity-table">
            <colgroup>
              <col className="col-date" />
              <col className="col-customer" />
              <col className="col-phase" />
              <col className="col-owner" />
              <col className="col-partner" />
              <col className="col-activity" />
              <col className="col-next" />
              <col className="col-due" />
              <col className="col-sla" />
              <col className="col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Müşteri Adı</th>
                <th>Faz</th>
                <th>Ekleyen</th>
                <th>Bekleyen Taraf</th>
                <th>Aktivite Tipi</th>
                <th>Durum</th>
                <th>Hedef Tarih</th>
                <th>SLA</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {slimRows.map((row) => {
                const role = resolveRole(row);
                const phaseTitle = row.phase_title || (row.is_business_partner ? partnerFazDefinitions[row.faz_no ?? -1] : fazDefinitions[row.faz_no ?? -1]) || (row.faz_no != null ? `FAZ ${row.faz_no}` : '-');
                return (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className="name">{row.musteriler?.musteri ?? '-'}</div>
                      <div className="muted">Sorumlu: {row.musteriler?.sorumlu ?? '-'}</div>
                    </td>
                    <td>
                      <div className="activity-cell">
                        {row.faz_no != null ? (
                          <span className="phase-pill" title={phaseTitle}>{`FAZ ${row.faz_no}`}</span>
                        ) : (
                          <span className="muted empty-cell">-</span>
                        )}
                      </div>
                    </td>
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
                    <td>
                      <div className="activity-cell">
                        <span className="activity-pill activity-pill-fixed" title={row.notlar || row.activity_label || '-'}>{row.activity_label ?? '-'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="person-stack">
                        <span className="person-main">{row.activity_status ?? '-'}</span>
                      </div>
                    </td>
                    <td><span className="date-chip">{formatDate(row.due_date)}</span></td>
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
                    <td>
                      <div className="action-stack">
                        <Link className="link-btn" href={`/crm/activities/new?edit=${row.id}`}>Düzenle</Link>
                        {row.is_blocked ? (
                          <button
                            type="button"
                            className={`link-btn secondary danger`}
                            onClick={() => void toggleBlock(row)}
                            disabled={blockingRowId === row.id}
                            title={`Blokaj Notu: ${row.blocked_note || 'Blokaj notu girilmedi'}\nEkleyen: ${row.blocked_by || '-'}\nTarih: ${formatDate(row.blocked_at)}`}
                            aria-label={row.blocked_note || 'Blokaj notu girilmedi'}
                          >
                            {blockingRowId === row.id ? 'Kaydediliyor...' : 'Blokajı Kaldır'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="link-btn secondary"
                            onClick={() => void toggleBlock(row)}
                            disabled={blockingRowId === row.id}
                          >
                            {blockingRowId === row.id ? 'Kaydediliyor...' : 'Blokaj Ekle'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !slimRows.length ? <tr><td colSpan={10} style={{ padding: 18, color: 'var(--text-3)' }}>Kayıt bulunamadı.</td></tr> : null}
              {loading ? <tr><td colSpan={10} style={{ padding: 18, color: 'var(--text-3)' }}>Yükleniyor...</td></tr> : null}
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
