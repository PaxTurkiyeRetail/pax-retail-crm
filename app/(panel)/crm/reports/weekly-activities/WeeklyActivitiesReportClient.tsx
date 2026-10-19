'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { Button, DataTable, FilterGrid, Input, KpiStrip, Notice, Page, PageHeader, Select, StackField, Tabs, type Column } from '@/components/ui';

type Kpis = {
  totalActivities: number; activePeople: number; distinctCustomers: number;
  phone: number; faceToFace: number; online: number;
  technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number;
  salesActivities: number; technicalActivities: number;
  topPerformer: string; topCustomer: string;
};

type FilterBag = {
  from: string; to: string;
  ownerOptions: string[]; responsibleOptions: string[]; customerOptions: string[];
  channelOptions: string[]; phaseOptions: string[]; waitingOptions: string[]; statusOptions: string[];
};

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
  filters: { from: '', to: '', ownerOptions: [], responsibleOptions: [], customerOptions: [], channelOptions: [], phaseOptions: [], waitingOptions: [], statusOptions: [] },
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

function thisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(end) };
}

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

export default function WeeklyActivitiesReportPage() {
  const defaults = useMemo(() => thisWeekRange(), []);
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('person');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [owner, setOwner] = useState('');
  const [responsible, setResponsible] = useState('');
  const [customer, setCustomer] = useState('');
  const [channel, setChannel] = useState('');
  const [phase, setPhase] = useState('');
  const [waiting, setWaiting] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (owner) params.set('owner', owner);
      if (responsible) params.set('responsible', responsible);
      if (customer) params.set('customer', customer);
      if (channel) params.set('channel', channel);
      if (phase) params.set('phase', phase.replace('FAZ ', ''));
      if (waiting) params.set('waiting', waiting);
      if (status) params.set('status', status);
      const res = await fetch(`/api/reports/weekly-activities?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(json?.message || 'Rapor yüklenemedi.'); setPayload(EMPTY); return; }
      setPayload({ ...EMPTY, ...(json ?? {}) });
    } finally { setLoading(false); }
  }, [from, to, owner, responsible, customer, channel, phase, waiting, status]);

  useEffect(() => { void load(); }, [load]);

  const clearFilters = () => {
    setFrom(defaults.from); setTo(defaults.to);
    setOwner(''); setResponsible(''); setCustomer('');
    setChannel(''); setPhase(''); setWaiting(''); setStatus('');
  };

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

  const f = payload.filters;
  const sel = (label: string, v: string, set: (s: string) => void, list: string[]) => (
    <StackField label={label}>
      <Select value={v} onChange={(e) => set(e.target.value)}>
        <option value="">Tümü</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    </StackField>
  );

  return (
    <Page>
      <PageHeader
        title="Haftalık Aktiviteler"
        meta={`${dt(from)} – ${dt(to)}`}
        actions={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor' : 'Yenile'}</Button>}
      />
      {msg && <Notice>{msg}</Notice>}
      <FilterGrid
        footer={<><span>{payload.list.length} kayıt</span><Button variant="ghost" size="sm" onClick={clearFilters}>Filtreleri temizle</Button></>}
      >
        <StackField label="Başlangıç"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></StackField>
        <StackField label="Bitiş"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></StackField>
        {sel('Kişi', owner, setOwner, f.ownerOptions)}
        {sel('Sorumlu', responsible, setResponsible, f.responsibleOptions)}
        {sel('Firma', customer, setCustomer, f.customerOptions)}
        {sel('Kanal', channel, setChannel, f.channelOptions)}
        {sel('Faz', phase, setPhase, f.phaseOptions)}
        {sel('Bekleyen', waiting, setWaiting, f.waitingOptions)}
        {sel('Durum', status, setStatus, f.statusOptions)}
      </FilterGrid>
      <KpiStrip items={kpis} />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'person' && <DataTable rows={payload.byPerson} columns={personCols} csvName="haftalik-kisi" loading={loading} />}
      {tab === 'customer' && <DataTable rows={payload.byCustomer} columns={customerCols} csvName="haftalik-firma" loading={loading} />}
      {tab === 'day' && <DataTable rows={payload.byDay} columns={dayCols} csvName="haftalik-gun" loading={loading} />}
      {tab === 'detail' && <DataTable rows={payload.list} columns={detailCols} csvName="haftalik-detay" loading={loading} tall />}
    </Page>
  );
}
