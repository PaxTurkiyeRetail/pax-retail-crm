'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { Button, DataTable, KpiStrip, Notice, Page, PageHeader, Select, StackField, Tabs, type Column } from '@/components/ui';
import { FilterBar, ScopeLabel } from '@/components/filters/FilterBar';
import { useUrlFilters } from '@/lib/filters/use-url-filters';
import { resolvePeriod } from '@/lib/filters/period';
import type { FilterOption, PageFilterConfig } from '@/lib/filters/schema';
import { DEPARTMENT_LABELS, type Department } from '@/lib/departments';
import { resolveOwner } from '@/lib/reports/owner-filter';

type Kpis = {
  totalActivities: number; activePeople: number; distinctCustomers: number;
  phone: number; faceToFace: number; online: number;
  technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number;
  salesActivities: number; technicalActivities: number;
  topPerformer: string; topCustomer: string;
};

type FilterBag = { from: string; to: string; channelOptions: string[]; statusOptions: string[] };

type Channels = { phone: number; face: number; online: number; technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number };

type ByPerson = Channels & {
  kisi: string; total: number; sales: number; technical: number;
  customerCount: number; lastActivity: string; busiestCustomer: string; dailyAverage: number;
};

type ByCustomer = Channels & {
  customer: string; responsible: string; total: number;
  lastActivity: string; lastOwner: string; lastChannel: string; phase: string; waiting: string; notes: string;
};

type ByDay = Channels & { day: string; total: number; activePeople: number; customerCount: number };

type DetailRow = {
  id: string; created_at: string; created_by: string; responsible: string;
  customer: string; sector: string; integration: string;
  phase: string; waiting: string; status: string; channel: string; notes: string;
};

type Payload = {
  filters: FilterBag; kpis: Kpis;
  byPerson: ByPerson[]; byCustomer: ByCustomer[]; byDay: ByDay[]; list: DetailRow[];
};

const EMPTY: Payload = {
  filters: { from: '', to: '', channelOptions: [], statusOptions: [] },
  kpis: { totalActivities: 0, activePeople: 0, distinctCustomers: 0, phone: 0, faceToFace: 0, online: 0, technicalVisit: 0, technicalOnline: 0, pom: 0, email: 0, other: 0, salesActivities: 0, technicalActivities: 0, topPerformer: '-', topCustomer: '-' },
  byPerson: [], byCustomer: [], byDay: [], list: [],
};

type TabKey = 'person' | 'customer' | 'day' | 'detail';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'person', label: 'Kişi Bazlı' },
  { key: 'customer', label: 'Firma Bazlı' },
  { key: 'day', label: 'Günlük Kırılım' },
  { key: 'detail', label: 'Detay Liste' },
];

const ROLE_OPTIONS: FilterOption[] = [
  { value: 'sales', label: 'Satış' },
  { value: 'technical', label: 'Teknik' },
];
const PHASE_OPTIONS: FilterOption[] = Array.from({ length: 25 }, (_, i) => ({ value: String(i + 1), label: `Faz ${i + 1}` }));

function channelCols<T extends Channels>(): Column<T>[] {
  return [
    { key: 'phone', label: 'Telefon', num: true, value: (r) => r.phone },
    { key: 'face', label: 'Yüz Yüze', num: true, value: (r) => r.face },
    { key: 'online', label: 'Online', num: true, value: (r) => r.online },
    { key: 'tv', label: 'Tek. Ziyaret', num: true, value: (r) => r.technicalVisit },
    { key: 'to', label: 'Tek. Online', num: true, value: (r) => r.technicalOnline },
    { key: 'pom', label: 'POM', num: true, value: (r) => r.pom ?? 0 },
    { key: 'email', label: 'E-posta', num: true, value: (r) => r.email },
    { key: 'other', label: 'Diğer', num: true, value: (r) => r.other },
  ];
}

const dt = (v: string) => (v ? formatDate(v) : '-');

const personCols: Column<ByPerson>[] = [
  { key: 'kisi', label: 'Kişi', value: (r) => r.kisi },
  { key: 'total', label: 'Toplam', num: true, value: (r) => r.total },
  ...channelCols<ByPerson>(),
  { key: 'sales', label: 'Satış', num: true, value: (r) => r.sales },
  { key: 'technical', label: 'Teknik', num: true, value: (r) => r.technical },
  { key: 'cc', label: 'Firma', num: true, value: (r) => r.customerCount },
  { key: 'avg', label: 'Gün Ort.', num: true, value: (r) => r.dailyAverage },
  { key: 'busy', label: 'En Yoğun Firma', value: (r) => r.busiestCustomer },
  { key: 'last', label: 'Son Aktivite', value: (r) => r.lastActivity, render: (r) => dt(r.lastActivity) },
];

const customerCols: Column<ByCustomer>[] = [
  { key: 'customer', label: 'Firma', value: (r) => r.customer },
  { key: 'responsible', label: 'Sorumlu', value: (r) => r.responsible },
  { key: 'total', label: 'Toplam', num: true, value: (r) => r.total },
  ...channelCols<ByCustomer>(),
  { key: 'last', label: 'Son Aktivite', value: (r) => r.lastActivity, render: (r) => dt(r.lastActivity) },
  { key: 'lastOwner', label: 'Son Kişi', value: (r) => r.lastOwner },
  { key: 'lastChannel', label: 'Son Kanal', value: (r) => r.lastChannel },
  { key: 'phase', label: 'Faz', value: (r) => r.phase },
  { key: 'waiting', label: 'Bekleyen', value: (r) => r.waiting },
  { key: 'notes', label: 'Not', value: (r) => r.notes, cellClass: () => 'max-w-[320px] truncate' },
];

const dayCols: Column<ByDay>[] = [
  { key: 'day', label: 'Gün', value: (r) => r.day, render: (r) => dt(r.day) },
  { key: 'total', label: 'Toplam', num: true, value: (r) => r.total },
  ...channelCols<ByDay>(),
  { key: 'ap', label: 'Aktif Kişi', num: true, value: (r) => r.activePeople },
  { key: 'cc', label: 'Firma', num: true, value: (r) => r.customerCount },
];

const detailCols: Column<DetailRow>[] = [
  { key: 'created_at', label: 'Tarih', value: (r) => r.created_at, render: (r) => dt(r.created_at) },
  { key: 'created_by', label: 'Kişi', value: (r) => r.created_by },
  { key: 'responsible', label: 'Sorumlu', value: (r) => r.responsible },
  { key: 'customer', label: 'Firma', value: (r) => r.customer },
  { key: 'sector', label: 'Sektör', value: (r) => r.sector },
  { key: 'integration', label: 'Entegrasyon', value: (r) => r.integration },
  { key: 'channel', label: 'Kanal', value: (r) => r.channel },
  { key: 'phase', label: 'Faz', value: (r) => r.phase },
  { key: 'waiting', label: 'Bekleyen', value: (r) => r.waiting },
  { key: 'status', label: 'Durum', value: (r) => r.status },
  { key: 'notes', label: 'Not', value: (r) => r.notes, cellClass: () => 'max-w-[360px] truncate' },
];

export default function WeeklyActivitiesReportPage({ ownerOptions, allowedDepartments }: { ownerOptions: FilterOption[]; allowedDepartments: Department[] | null }) {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('person');
  const [channel, setChannel] = useState('');
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);

  const filterConfig = useMemo<PageFilterConfig>(() => ({
    keys: ['period', 'from', 'to', 'department', 'owner', 'role', 'phase', 'status', 'q'],
    defaults: { period: 'this_week' },
    labels: { role: 'Kanal grubu', q: 'Ara' },
    options: { owner: ownerOptions, role: ROLE_OPTIONS, phase: PHASE_OPTIONS, status: statusOptions.map((v) => ({ value: v, label: v })) },
  }), [ownerOptions, statusOptions]);
  const { values: filters } = useUrlFilters(filterConfig, { allowedDepartments });
  const period = useMemo(() => resolvePeriod({ period: filters.period, from: filters.from, to: filters.to }), [filters.period, filters.from, filters.to]);
  const selectedOwner = resolveOwner(filters.owner, ownerOptions);
  const { from, to } = period;
  const ownerId = selectedOwner?.id ?? '';
  const ownerName = selectedOwner?.name ?? '';
  const { department = '', role = '', phase = '', status = '', q = '' } = filters;

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (ownerId) params.set('owner_id', ownerId);
      if (ownerName) params.set('owner', ownerName);
      if (department) params.set('department', department);
      if (role) params.set('role', role);
      if (channel) params.set('channel', channel);
      if (phase) params.set('phase', phase);
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      const res = await fetch(`/api/reports/weekly-activities?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(json?.message || 'Rapor yüklenemedi.'); setPayload(EMPTY); return; }
      setPayload({ ...EMPTY, ...(json ?? {}) });
      setStatusOptions(json?.filters?.statusOptions ?? []);
      setChannelOptions(json?.filters?.channelOptions ?? []);
    } finally { setLoading(false); }
  }, [from, to, ownerId, ownerName, department, role, channel, phase, status, q]);

  useEffect(() => { void load(); }, [load]);

  const k = payload.kpis;
  const kpis = [
    { label: 'Toplam Aktivite', value: k.totalActivities },
    { label: 'Aktif Kişi', value: k.activePeople },
    { label: 'Görüşülen Firma', value: k.distinctCustomers },
    { label: 'Telefon', value: k.phone },
    { label: 'Yüz Yüze', value: k.faceToFace },
    { label: 'Online', value: k.online },
    { label: 'Teknik Ziyaret', value: k.technicalVisit },
    { label: 'Teknik Online', value: k.technicalOnline },
    { label: 'POM', value: k.pom ?? 0 },
    { label: 'En Yoğun Kişi', value: k.topPerformer },
    { label: 'En Yoğun Firma', value: k.topCustomer },
  ];


  return (
    <Page>
      <PageHeader
        title="Haftalık Aktiviteler"
        meta={`${dt(from)} – ${dt(to)} · ${payload.list.length.toLocaleString('tr-TR')} kayıt`}
        actions={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor' : 'Yenile'}</Button>}
      />
      {msg && <Notice>{msg}</Notice>}
      <FilterBar
        config={filterConfig}
        allowedDepartments={allowedDepartments}
        showScope={false}
        actions={(
          <StackField label="Kanal">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Tümü</option>
              {channelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </StackField>
        )}
      />
      <ScopeLabel
        mode="period"
        period={period.label}
        department={department ? DEPARTMENT_LABELS[department] : undefined}
        owner={selectedOwner?.name}
      />
      <KpiStrip items={kpis} />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'person' && <DataTable rows={payload.byPerson} columns={personCols} csvName="haftalik-kisi" loading={loading} />}
      {tab === 'customer' && <DataTable rows={payload.byCustomer} columns={customerCols} csvName="haftalik-firma" loading={loading} />}
      {tab === 'day' && <DataTable rows={payload.byDay} columns={dayCols} csvName="haftalik-gun" loading={loading} />}
      {tab === 'detail' && <DataTable rows={payload.list} columns={detailCols} csvName="haftalik-detay" loading={loading} tall />}
    </Page>
  );
}
