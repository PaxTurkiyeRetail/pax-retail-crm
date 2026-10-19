'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, DataTable, FilterGrid, Input, KpiStrip, Notice, Page, PageHeader, Section, Select, StackField, type Column, type Tone } from '@/components/ui';

type ReportRow = {
  musteri: string;
  sektor: string;
  entegrasyon_tipi: string;
  mevcut_faz: string;
  son_aksiyon: string;
  sorumlu: string;
  risk_durumu: string;
  sonraki_adim: string;
  bekleyen_taraf: string;
  kunye_durumu?: string;
  sla_state?: string;
};

type Totals = {
  toplam_musteri: number;
  hamwe_kunye_var: number;
  hamwe_kunye_eksik: number;
  hamwe_kunye_yok: number;
  sla_geciken: number;
  sla_bugun: number;
  sla_planli: number;
  sla_tarihsiz: number;
};

type Highlights = {
  owners: Array<{ label: string; value: number }>;
  waiting: Array<{ label: string; value: number }>;
};

const EMPTY_TOTALS: Totals = { toplam_musteri: 0, hamwe_kunye_var: 0, hamwe_kunye_eksik: 0, hamwe_kunye_yok: 0, sla_geciken: 0, sla_bugun: 0, sla_planli: 0, sla_tarihsiz: 0 };
const EMPTY_HIGHLIGHTS: Highlights = { owners: [], waiting: [] };

const SLA: Record<string, { label: string; tone: Tone }> = {
  overdue: { label: 'Geciken', tone: 'danger' },
  today: { label: 'Bugün', tone: 'warn' },
  upcoming: { label: 'Planlı', tone: 'accent' },
  completed: { label: 'Tamamlanan', tone: 'ok' },
  unscheduled: { label: 'Tarihsiz', tone: 'neutral' },
};
const sla = (s?: string) => SLA[s || 'unscheduled'] ?? SLA.unscheduled;
const kunye = (v?: string) => (v === 'Var' ? 'Tamam' : (v ?? '-'));

type Row = ReportRow & { no: number };

const COLUMNS: Column<Row>[] = [
  { key: 'no', label: 'No', num: true, value: (r) => r.no },
  { key: 'musteri', label: 'Müşteri', value: (r) => r.musteri, cellClass: () => 'font-medium text-text' },
  { key: 'sektor', label: 'Sektör', value: (r) => r.sektor },
  { key: 'entegrasyon_tipi', label: 'Entegrasyon Tipi', value: (r) => r.entegrasyon_tipi },
  { key: 'mevcut_faz', label: 'Mevcut Faz', value: (r) => r.mevcut_faz },
  { key: 'son_aksiyon', label: 'Son Aksiyon', value: (r) => r.son_aksiyon },
  { key: 'sorumlu', label: 'Sorumlu', value: (r) => r.sorumlu },
  { key: 'sonraki_adim', label: 'Sonraki Adım', value: (r) => r.sonraki_adim },
  { key: 'bekleyen_taraf', label: 'Bekleyen Taraf', value: (r) => r.bekleyen_taraf },
  { key: 'sla', label: 'SLA', value: (r) => sla(r.sla_state).label, render: (r) => <Badge tone={sla(r.sla_state).tone}>{sla(r.sla_state).label}</Badge> },
  { key: 'kunye', label: 'Künye', value: (r) => kunye(r.kunye_durumu) },
];

function MiniList({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  return (
    <Section title={title} count={items.length}>
      <dl className="m-0 divide-y divide-border text-[13px]">
        {items.map((i) => (
          <div key={i.label} className="flex justify-between gap-3 py-1.5">
            <dt className="truncate text-text-2">{i.label}</dt>
            <dd className="m-0 font-medium text-text tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export default function ManagementReportPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [highlights, setHighlights] = useState<Highlights>(EMPTY_HIGHLIGHTS);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [waitingFilter, setWaitingFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [kunyeFilter, setKunyeFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/reports/management', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(payload?.message || 'Rapor yüklenemedi');
        setRows([]);
        return;
      }
      setRows(payload.rows ?? []);
      setTotals({ ...EMPTY_TOTALS, ...(payload.totals ?? {}) });
      setHighlights({ ...EMPTY_HIGHLIGHTS, ...(payload.highlights ?? {}) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const needle = q.trim().toLocaleLowerCase('tr');
    if (needle) {
      const haystack = [row.musteri, row.sektor, row.entegrasyon_tipi, row.sorumlu, row.son_aksiyon, row.sonraki_adim, row.bekleyen_taraf].join(' ').toLocaleLowerCase('tr');
      if (!haystack.includes(needle)) return false;
    }
    if (ownerFilter && row.sorumlu !== ownerFilter) return false;
    if (waitingFilter && row.bekleyen_taraf !== waitingFilter) return false;
    if (slaFilter && (row.sla_state ?? 'unscheduled') !== slaFilter) return false;
    if (kunyeFilter && kunye(row.kunye_durumu) !== kunyeFilter) return false;
    return true;
  }), [rows, q, ownerFilter, waitingFilter, slaFilter, kunyeFilter]);

  const mapped = useMemo<Row[]>(() => filteredRows.map((row, index) => ({ no: index + 1, ...row })), [filteredRows]);
  const completionRate = totals.toplam_musteri ? Math.round((totals.hamwe_kunye_var / totals.toplam_musteri) * 100) : 0;
  const overdueRate = totals.toplam_musteri ? Math.round((totals.sla_geciken / totals.toplam_musteri) * 100) : 0;

  const kpis = [
    { label: 'Toplam Portföy', value: totals.toplam_musteri, sub: 'İzlenen müşteri' },
    { label: 'Künye Tamamlanma', value: `%${completionRate}`, sub: `${totals.hamwe_kunye_var} müşteri tam` },
    { label: 'Geciken SLA', value: totals.sla_geciken, sub: `%${overdueRate} portföy` },
    { label: 'Bugün Aksiyon', value: totals.sla_bugun, sub: 'Aynı gün takip' },
    { label: 'Planlı Takip', value: totals.sla_planli, sub: 'İleri tarihli' },
    { label: 'Tarihsiz İş', value: totals.sla_tarihsiz, sub: 'Planlama gerekli' },
  ];

  const clearFilters = () => {
    setQ('');
    setOwnerFilter('');
    setWaitingFilter('');
    setSlaFilter('');
    setKunyeFilter('');
  };

  return (
    <Page>
      <PageHeader
        title="Yönetim Özeti"
        meta="Sorumlu sahipliği, bekleyen taraf ve SLA-künye sağlığı"
        actions={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor' : 'Yenile'}</Button>}
      />
      {msg && <Notice>{msg}</Notice>}
      <KpiStrip items={kpis} />
      <div className="grid gap-5 md:grid-cols-2">
        <MiniList title="Portföy Sahipliği" items={highlights.owners} />
        <MiniList title="Bekleyen Taraf" items={highlights.waiting} />
      </div>
      <FilterGrid
        footer={<><span>{filteredRows.length} müşteri</span><Button variant="ghost" size="sm" onClick={clearFilters}>Filtreleri temizle</Button></>}
      >
        <StackField label="Arama"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, sektör, sorumlu, aksiyon" /></StackField>
        <StackField label="Sorumlu">
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">Tümü</option>
            {highlights.owners.map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
          </Select>
        </StackField>
        <StackField label="Bekleyen Taraf">
          <Select value={waitingFilter} onChange={(e) => setWaitingFilter(e.target.value)}>
            <option value="">Tümü</option>
            {highlights.waiting.map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
          </Select>
        </StackField>
        <StackField label="SLA">
          <Select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)}>
            <option value="">Tümü</option>
            {Object.entries(SLA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </StackField>
        <StackField label="Künye">
          <Select value={kunyeFilter} onChange={(e) => setKunyeFilter(e.target.value)}>
            <option value="">Tümü</option>
            <option value="Tamam">Tamam</option>
            <option value="Eksik">Eksik</option>
            <option value="Yok">Yok</option>
          </Select>
        </StackField>
      </FilterGrid>
      <DataTable rows={mapped} columns={COLUMNS} csvName="yonetim-ozeti" loading={loading} emptyText="Kayıt yok." tall />
    </Page>
  );
}
