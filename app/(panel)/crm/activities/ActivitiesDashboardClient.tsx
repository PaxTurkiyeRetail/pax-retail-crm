'use client';
import '@/styles/activities-page.css';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getSlaPresentation, getSlaState } from '@/lib/sla';
import { formatDate, toLocalDateInputValue } from '@/lib/utils';
import ActivitiesDashboard from '@/components/activities/ActivitiesDashboard';
import { useConfiguredPageSize } from '@/components/hooks/useConfiguredPageSize';
import { FilterBar, FilterSelectField, ScopeLabel } from '@/components/filters/FilterBar';
import { useUrlFilters } from '@/lib/filters/use-url-filters';
import { resolvePeriod } from '@/lib/filters/period';
import type { FilterOption, PageFilterConfig } from '@/lib/filters/schema';
import { DEPARTMENT_LABELS, type Department } from '@/lib/departments';
import { resolveOwner } from '@/lib/reports/owner-filter';

/** Two-letter avatar text and a stable hue derived from the company name. */
function initialsOf(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toLocaleUpperCase('tr-TR');
}
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

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
  activity_scope?: 'account' | 'technical' | null;
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

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function resolveRole(row: ActivityRow): RoleKey {
  return row.activity_scope === 'technical' ? 'rs' : 'sales';
}


export default function ActivitiesPage({ ownerOptions, allowedDepartments }: { ownerOptions: FilterOption[]; allowedDepartments: Department[] | null }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<ActivityRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [fazDefinitions, setFazDefinitions] = useState<Record<number, string>>({});
  const [partnerFazDefinitions, setPartnerFazDefinitions] = useState<Record<number, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useConfiguredPageSize();
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [sla, setSla] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [blockingRowId, setBlockingRowId] = useState<string | null>(null);

  // Merkezi filtreler URL'de; Satıcı = aktiviteyi giren kullanıcı (id, yoksa ad).
  const filterConfig = useMemo<PageFilterConfig>(() => ({
    keys: ownerOptions.length ? ['period', 'from', 'to', 'department', 'owner', 'phase', 'status', 'q'] : ['period', 'from', 'to', 'department', 'phase', 'status', 'q'],
    defaults: { period: 'this_week' },
    labels: { q: 'Ara' },
    options: {
      owner: ownerOptions,
      phase: Array.from({ length: 25 }, (_, i) => ({ value: String(i + 1), label: `Faz ${i + 1}` })),
      status: options.statusOptions.map((v) => ({ value: v, label: v })),
    },
  }), [ownerOptions, options.statusOptions]);
  const { values: filters, activeCount: urlActiveCount } = useUrlFilters(filterConfig, { allowedDepartments });
  const period = useMemo(() => resolvePeriod({ period: filters.period, from: filters.from, to: filters.to }), [filters.period, filters.from, filters.to]);
  const selectedOwner = resolveOwner(filters.owner, ownerOptions);
  const debouncedQ = filters.q ?? '';
  const status = filters.status ?? '';
  const fazNo = filters.phase ?? '';
  const department = filters.department ?? '';
  const ownerId = selectedOwner?.id ?? '';
  const ownerName = selectedOwner?.name ?? '';
  const effectiveFrom = period.from;
  const effectiveTo = period.to;

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
  }, [debouncedQ, status, fazNo, sla, ownerId, ownerName, department, blockedFilter, effectiveFrom, effectiveTo]);

  const buildActivityParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...extra });
    if (debouncedQ) p.set('q', debouncedQ);
    if (status) p.set('durum', status);
    if (fazNo) p.set('faz_no', fazNo);
    if (sla) p.set('sla', sla);
    if (ownerId) p.set('owner_id', ownerId);
    if (ownerName) p.set('owner', ownerName);
    if (department) p.set('department', department);
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
  }, [debouncedQ, page, pageSize, status, fazNo, sla, ownerId, ownerName, department, blockedFilter, effectiveFrom, effectiveTo]);

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
  }, [debouncedQ, status, fazNo, sla, ownerId, ownerName, department, blockedFilter, effectiveFrom, effectiveTo]);

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

  const activeFilterCount = urlActiveCount + [sla, blockedFilter].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="pax-page-container crm-activities-page">
      <ScopeLabel
        mode="period"
        period={period.label}
        department={department ? DEPARTMENT_LABELS[department] : undefined}
        owner={selectedOwner?.name}
      />

      <ActivitiesDashboard
        activityTotal={analyticsSlimRows.length}
        completedTotal={completedTotal}
        completedPct={slaHealthPct}
        dashboardMetrics={{
          ...dashboardMetrics,
          trendTitle: 'Bu hafta · seçili dönem',
          blockedCount: analyticsSlimRows.filter((row) => Boolean(row.is_blocked)).length,
          blockedFirmCount: new Set(analyticsSlimRows.filter((row) => Boolean(row.is_blocked)).map((row) => (row.musteriler?.musteri ?? '').trim() || 'Tanımsız Firma')).size,
        }}
        companyPhase={companyPhase}
        leaderboard={leaderboard}
        salesTotal={salesTotal}
        rsTotal={rsTotal}
        dueDateAnalysis={dueDateAnalysis}
      />

      <section className="command-bar">
        <FilterBar
          config={filterConfig}
          allowedDepartments={allowedDepartments}
          showScope={false}
          extraFields={(
            <>
              <FilterSelectField label="SLA / risk" value={sla} onChange={setSla}>
                <option value="">Tümü</option>
                {SLA_OPTIONS.filter(Boolean).map((v) => <option key={v} value={v}>{SLA_LABELS[v]}</option>)}
              </FilterSelectField>
              <FilterSelectField label="Blokaj" value={blockedFilter} onChange={setBlockedFilter}>
                <option value="">Tümü</option>
                <option value="blocked">Sadece blokajlı</option>
                <option value="unblocked">Sadece blokajsız</option>
              </FilterSelectField>
            </>
          )}
        />
        <div className="command-toolbar">
          <div className="command-meta-left">
            <span className="text-[12px] text-[var(--muted)]">
              <strong className="font-semibold text-[var(--text)]">{total.toLocaleString('tr-TR')}</strong> aktivite
              {total > rows.length && rows.length > 0 ? <> · {((page - 1) * pageSize + 1).toLocaleString('tr-TR')}–{((page - 1) * pageSize + rows.length).toLocaleString('tr-TR')} arası gösteriliyor</> : null}
            </span>
            {activeFilterCount > 0 ? <span className="chip active">{activeFilterCount} aktif filtre</span> : null}
          </div>
        </div>
      </section>

      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="table-head">
          <div>
            <h2 className="section-title">Aktivite listesi <span className="count">{total.toLocaleString('tr-TR')}</span></h2>
          </div>
          <div className="table-actions">
            <Link href="/crm/activities/new" className="add-btn">
              <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Aktivite ekle
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
                <th aria-label="İşlem" />
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
                      <div className="customer-cell">
                        <span className="avatar" aria-hidden style={{ '--h': hueOf(row.musteriler?.musteri ?? '') } as CSSProperties}>{initialsOf(row.musteriler?.musteri ?? '')}</span>
                        <div>
                          <div className="name">{row.musteriler?.musteri ?? '—'}</div>
                          {row.musteriler?.sorumlu ? <div className="muted">{row.musteriler.sorumlu}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="activity-cell">
                        {row.faz_no != null ? (
                          <span className="phase-pill" title={phaseTitle}>{`FAZ ${row.faz_no}`}</span>
                        ) : (
                          <span className="empty-cell">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="person-stack">
                        <span className="person-main">{row.owner ?? '—'}</span>
                        <span className="person-sub">{role === 'rs' ? 'Retail Support' : 'Sales'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="person-stack">
                        {row.partner_owner ? <span className="person-main">{row.partner_owner}</span> : <span className="empty-cell">—</span>}
                      </div>
                    </td>
                    <td>
                      <div className="activity-cell">
                        {row.activity_label ? <span className="activity-pill activity-pill-fixed" title={row.notlar || row.activity_label}>{row.activity_label}</span> : <span className="empty-cell">—</span>}
                      </div>
                    </td>
                    <td>
                      {row.activity_status ? (
                        <span className="status-text" data-s={/tamam/i.test(row.activity_status) ? 'done' : /devam/i.test(row.activity_status) ? 'progress' : 'idle'}>{row.activity_status}</span>
                      ) : <span className="empty-cell">—</span>}
                    </td>
                    <td>{row.due_date ? <span className="date-chip">{formatDate(row.due_date)}</span> : <span className="empty-cell">—</span>}</td>
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
                        {row.sla.dayText && row.sla.dayText !== '-' ? <span className="sla-text">{row.sla.dayText}</span> : null}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link className="icon-btn" href={`/crm/activities/new?edit=${row.id}`} title="Düzenle" aria-label="Düzenle">
                          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </Link>
                        <button
                          type="button"
                          className={`icon-btn${row.is_blocked ? ' danger' : ''}`}
                          onClick={() => void toggleBlock(row)}
                          disabled={blockingRowId === row.id}
                          title={row.is_blocked
                            ? `Blokajı kaldır\nNot: ${row.blocked_note || 'Blokaj notu girilmedi'}\nEkleyen: ${row.blocked_by || '—'}\nTarih: ${formatDate(row.blocked_at)}`
                            : 'Blokaj ekle'}
                          aria-label={row.is_blocked ? 'Blokajı kaldır' : 'Blokaj ekle'}
                        >
                          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
                        </button>
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
          <div className="inline"><span style={{ color: 'var(--text-3)', fontSize: 12 }}>Sayfa {page} / {totalPages}</span></div>
          <div className="pager-buttons">
            <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button>
            <button className="btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
      </section>
    </main>
  );
}
