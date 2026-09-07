'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
// Inline SVG icons — no lucide dependency
const _svg = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
type IconProps = { size?: number; strokeWidth?: number; style?: CSSProperties };
function Building2({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/></svg>; }
function ChevronDown({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><polyline points="6 9 12 15 18 9"/></svg>; }
function Filter({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>; }
function Layers3({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>; }
function Plus({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function Search({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function Target({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function Users({ size = 16, strokeWidth = 1.75, style }: IconProps) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg} strokeWidth={strokeWidth} style={style}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
import { uniqueOptions, parsePhaseNo, sumPhaseRange } from '@/lib/utils';
import CustomersHero from '@/components/crm/CustomersHero';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';
import { isBusinessPartnerSector } from '@/lib/report-only-customers';
import { presentKunyeStatus } from '@/lib/kunye';
import { customerStatusTone, deriveCustomerSegmentation, managementTypeTone } from '@/lib/customer-segmentation';
import { appToast } from '@/lib/app-toast';
import { normalizePageSize, PAGE_SIZE_OPTIONS } from '@/lib/ui-pagination';

type CrmRow = {
  musteri_id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  son_kalinan_faz_no?: number | null;
  son_kalinan_faz_adi?: string | null;
  son_kalinan_faz_durumu?: string | null;
  son_kalinan_faz_tarihi?: string | null;
  kasa_firmasi?: string | null;
  kunye_durumu?: string | null;
  report_only?: boolean;
  owner_user_id?: string | null;
  satis_olasiligi?: string | null;
  customer_type?: string | null;
  pipeline_policy?: string | null;
  is_kolu?: string | null;
};

type Me = { id: string; email: string; full_name: string | null; role: string; permissions?: string[] };
type AllowedUser = { id: string; email: string; full_name: string | null; role: string; is_active: boolean };
type CatalogOption = { label: string; value: string };
type OrganizationRelation = { role_key: 'customer' | 'business_partner'; subtype: string | null; is_active: boolean };
type ModalMode = 'create' | 'edit';
type SummaryItem = { label: string; value: number };
type StatsPayload = {
  total: number;
  sectors: number;
  kasaFirmasi: number;
  accounts: number;
  kunyeVar: number;
  kunyeYok: number;
  kunyeEksik: number;
  entegrasyonYapisi: number;
  byPhase: SummaryItem[];
  byOwner: SummaryItem[];
  bySector: SummaryItem[];
};
type FilterOptions = {
  ownerOptions: string[];
  sectorOptions: string[];
  integrationOptions: string[];
  kasaOptions: string[];
  phaseOptions: string[];
  sectorCatalogOptions: CatalogOption[];
  integrationCatalogOptions: CatalogOption[];
  salesProbabilityOptions: CatalogOption[];
  customerTypeOptions: CatalogOption[];
  pipelinePolicyOptions: CatalogOption[];
  isKoluOptions: CatalogOption[];
  verticalSectorValues: string[];
  defaultPageSize: number;
};
type PhaseBucket = { key: string; label: string; range: string; value: number; tone: string; filterValue: string };
type FilterToken = { key: string; label: string; onClear: () => void };
type ActionModeKey = 'all' | 'missing-kunye' | 'no-owner' | 'lead' | 'opportunity' | 'pilot' | 'rollout' | 'integration';

type ActionMode = {
  key: ActionModeKey;
  title: string;
  description: string;
  iconLabel: string;
  metric: (stats: StatsPayload) => number;
};

const KUNYE_OPTIONS = [
  { value: 'Tamam', label: 'Tamam' },
  { value: 'Eksik', label: 'Eksik' },
  { value: 'Yok', label: 'Yok' },
] as const;

const EMPTY_STATS: StatsPayload = {
  total: 0,
  sectors: 0,
  kasaFirmasi: 0,
  accounts: 0,
  kunyeVar: 0,
  kunyeYok: 0,
  kunyeEksik: 0,
  entegrasyonYapisi: 0,
  byPhase: [],
  byOwner: [],
  bySector: [],
};

const EMPTY_OPTIONS: FilterOptions = {
  ownerOptions: [],
  sectorOptions: [],
  integrationOptions: [],
  kasaOptions: [],
  phaseOptions: [],
  sectorCatalogOptions: [],
  integrationCatalogOptions: [],
  salesProbabilityOptions: [],
  customerTypeOptions: [],
  pipelinePolicyOptions: [],
  isKoluOptions: [],
  verticalSectorValues: [],
  defaultPageSize: 25,
};

const ACTION_MODES: ActionMode[] = [
  {
    key: 'all',
    title: 'Tüm portföy',
    description: 'Tam müşteri görünümü',
    iconLabel: '•',
    metric: (stats) => stats.total,
  },
  {
    key: 'missing-kunye',
    title: 'Künye aksiyonu',
    description: 'Eksik veya yok bilgiler',
    iconLabel: '•',
    metric: (stats) => stats.kunyeEksik + stats.kunyeYok,
  },
  {
    key: 'lead',
    title: 'Yeni lead alanı',
    description: 'Faz 1-4 hızlı temas',
    iconLabel: '•',
    metric: (stats) => sumPhaseRange(stats.byPhase, 1, 4),
  },
  {
    key: 'opportunity',
    title: 'Opportunity takibi',
    description: 'Faz 10-14 aktif satış',
    iconLabel: '•',
    metric: (stats) => sumPhaseRange(stats.byPhase, 10, 14),
  },
  {
    key: 'pilot',
    title: 'Pilot izleme',
    description: 'Faz 15-23 yakın yönetim',
    iconLabel: '•',
    metric: (stats) => sumPhaseRange(stats.byPhase, 15, 23),
  },
  {
    key: 'rollout',
    title: 'Rollout odak',
    description: 'Faz 24-25 canlıya geçiş',
    iconLabel: '•',
    metric: (stats) => sumPhaseRange(stats.byPhase, 24, 25),
  },
];

// Rozet renkleri globals.css'teki chip token'larından gelir: her iki temada
// tanımlı oldukları için koyu temada da kendi zemininde okunur kalırlar
// (sabit açık renkler koyu ekranda "çıkartma" gibi duruyordu).
function statusTone(status?: string | null) {
  if (status === 'Var' || status === 'Tamam') {
    return { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', border: '1px solid var(--chip-green-bd)' };
  }
  if (status === 'Eksik') {
    return { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', border: '1px solid var(--chip-gold-bd)' };
  }
  return { background: 'var(--chip-gray-bg)', color: 'var(--chip-gray-color)', border: '1px solid var(--chip-gray-bd)' };
}

function ownerOptionKey(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function normalizeOwnerOption(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  const key = ownerOptionKey(raw);
  return raw;
}

function uniqueOwnerOptions(values: Array<string | null | undefined>): string[] {
  const map = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeOwnerOption(value);
    if (!normalized) continue;
    const key = ownerOptionKey(normalized);
    if (!map.has(key)) map.set(key, normalized);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'tr'));
}


function buildPhaseBuckets(items: SummaryItem[]): PhaseBucket[] {
  return [
    {
      key: 'lead',
      label: 'Fırsat İlk Temas',
      range: 'Faz 1-4',
      value: sumPhaseRange(items, 1, 4),
      filterValue: '1-4',
      tone: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)',
    },
    {
      key: 'contact',
      label: 'Analiz + Sunumlar',
      range: 'Faz 5-9',
      value: sumPhaseRange(items, 5, 9),
      filterValue: '5-9',
      tone: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
    },
    {
      key: 'opportunity',
      label: 'Business',
      range: 'Faz 10-14',
      value: sumPhaseRange(items, 10, 14),
      filterValue: '10-14',
      tone: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    },
    {
      key: 'pilot',
      label: 'Operasyon',
      range: 'Faz 15-23',
      value: sumPhaseRange(items, 15, 23),
      filterValue: '15-23',
      tone: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',
    },
    {
      key: 'rollout',
      label: 'Yayılım',
      range: 'Faz 24-25',
      value: sumPhaseRange(items, 24, 25),
      filterValue: '24-25',
      tone: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    },
  ];
}

function getPhaseMeta(phaseNo: number | null | undefined) {
  if (phaseNo != null && phaseNo >= 1 && phaseNo <= 4) {
    return { label: 'Fırsat İlk Temas', style: { background: 'var(--chip-violet-bg)', color: 'var(--chip-violet-color)', border: '1px solid var(--chip-violet-bd)' } };
  }
  if (phaseNo != null && phaseNo >= 5 && phaseNo <= 9) {
    return { label: 'Analiz + Sunumlar', style: { background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)', border: '1px solid var(--chip-indigo-bd)' } };
  }
  if (phaseNo != null && phaseNo >= 10 && phaseNo <= 14) {
    return { label: 'Business', style: { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', border: '1px solid var(--chip-gold-bd)' } };
  }
  if (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) {
    return { label: 'Operasyon', style: { background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', border: '1px solid var(--chip-red-bd)' } };
  }
  if (phaseNo != null && phaseNo >= 24 && phaseNo <= 25) {
    return { label: 'Yayılım', style: { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', border: '1px solid var(--chip-green-bd)' } };
  }
  return { label: 'Faz Yok', style: { background: 'var(--chip-gray-bg)', color: 'var(--chip-gray-color)', border: '1px solid var(--chip-gray-bd)' } };
}

function buildPhaseSearchAliases(phaseNo: number | null | undefined, phaseName: string | null | undefined) {
  const meta = getPhaseMeta(phaseNo);
  return [meta.label, phaseName ?? '', phaseNo != null ? `Faz ${phaseNo}` : '', 'Yazılım'].filter(Boolean).join(' ');
}

function getDisplayedPhase(row: CrmRow) {
  if (row.son_kalinan_faz_no != null) {
    return {
      phaseNo: row.son_kalinan_faz_no,
      phaseName: row.son_kalinan_faz_adi ?? row.aktif_faz_adi ?? null,
      phaseStatus: row.son_kalinan_faz_durumu ?? null,
      isLastStayed: true,
    };
  }

  return {
    phaseNo: row.aktif_faz_no,
    phaseName: row.aktif_faz_adi ?? null,
    phaseStatus: null,
    isLastStayed: false,
  };
}

export default function CrmCustomersClient() {
  const [rows, setRows] = useState<CrmRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [allowed, setAllowed] = useState<AllowedUser[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_OPTIONS);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);

  // Dashboard'daki "Aksiyon Gerekli" bağlantıları listeyi ?q=<firma> ile açar;
  // arama kutusu ilk yüklemede bu değerle dolu gelir.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initialQ = new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
    if (initialQ) {
      setQ(initialQ);
      setDebouncedQ(initialQ);
    }
  }, []);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsPayload>(EMPTY_STATS);
  const [showSectorSummary, setShowSectorSummary] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actionMode, setActionMode] = useState<ActionModeKey>('all');

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>('create');
  const [busySave, setBusySave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [musteri, setMusteri] = useState('');
  const [sektor, setSektor] = useState('');
  const [sorumlu, setSorumlu] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [entegrasyonTipi, setEntegrasyonTipi] = useState('');
  const [satisOlasiligi, setSatisOlasiligi] = useState('');
  const [customerType, setCustomerType] = useState('standard');
  const [hasCustomerRole, setHasCustomerRole] = useState(true);
  const [hasBusinessPartnerRole, setHasBusinessPartnerRole] = useState(false);
  const [partnerSubtype, setPartnerSubtype] = useState('Entegrasyon Firması');
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);
  const [isKolu, setIsKolu] = useState('Retail');
  const [pipelinePolicy, setPipelinePolicy] = useState('phase_required');

  const [ownerFilter, setOwnerFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState('');
  const [kasaFilter, setKasaFilter] = useState('');
  const [kunyeFilter, setKunyeFilter] = useState('');
  const [fazFilter, setFazFilter] = useState('');

  const displayMeName = useMemo(() => (me?.full_name ?? '').trim(), [me?.full_name]);
  const canAssignCustomers = Boolean(me?.permissions?.includes('customer.assign'));
  const canManageClassification = Boolean(me?.permissions?.includes('customer.classification.manage'));
  const canCreateCustomers = Boolean(me?.permissions?.includes('customer.create'));
  const canUpdateAnyCustomer = Boolean(me?.permissions?.includes('customer.update.any'));
  const canUpdateOwnCustomer = Boolean(me?.permissions?.includes('customer.update.own'));
  const ownerDirectoryOptions = canAssignCustomers ? allowed : allowed.filter((user) => user.id === me?.id);

  const canEditCustomer = (row: CrmRow) => canUpdateAnyCustomer
    || (canUpdateOwnCustomer && Boolean(me?.id) && row.owner_user_id === me?.id);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, ownerFilter, sectorFilter, integrationFilter, kasaFilter, kunyeFilter, fazFilter, pageSize]);

  useEffect(() => {
    if (actionMode === 'all') return;

    if (actionMode === 'missing-kunye') {
      setKunyeFilter('Eksik');
      setFazFilter('');
      return;
    }

    if (actionMode === 'lead') {
      setFazFilter('1-4');
      setKunyeFilter('');
      return;
    }

    if (actionMode === 'opportunity') {
      setFazFilter('10-14');
      setKunyeFilter('');
      return;
    }

    if (actionMode === 'pilot') {
      setFazFilter('15-23');
      setKunyeFilter('');
      return;
    }

    if (actionMode === 'rollout') {
      setFazFilter('24-25');
      setKunyeFilter('');
      return;
    }
  }, [actionMode]);

  async function loadBaseData() {
    const [meRes, usersRes, optionsRes] = await Promise.all([
      fetch('/api/me', { cache: 'no-store' }),
      fetch('/api/allowed-users-lite', { cache: 'no-store' }),
      fetch('/api/crm/options', { cache: 'no-store' }),
    ]);

    if (!meRes.ok) {
      location.href = '/login';
      return;
    }

    const meJson = await meRes.json().catch(() => ({}));
    setMe(meJson.me ?? null);

    if (usersRes.ok) {
      const usersJson = await usersRes.json().catch(() => ({}));
      setAllowed((usersJson.users ?? []).filter((x: AllowedUser) => (x.full_name ?? '').trim().length > 0));
    }

    if (optionsRes.ok) {
      const optionsJson = await optionsRes.json().catch(() => ({}));
      setFilterOptions({ ...EMPTY_OPTIONS, ...(optionsJson ?? {}) });
      setPageSize(normalizePageSize(optionsJson.defaultPageSize));
    }
  }

  async function loadStats() {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (ownerFilter) params.set('owner', ownerFilter);
    if (sectorFilter) params.set('sector', sectorFilter);
    if (integrationFilter) params.set('integration', integrationFilter);
    if (kasaFilter) params.set('kasa_firmasi', kasaFilter);
    if (kunyeFilter) params.set('kunye_status', kunyeFilter);
    if (fazFilter) params.set('faz_no', fazFilter);

    const statsRes = await fetch(`/api/crm/stats?${params.toString()}`, { cache: 'no-store' });
    if (statsRes.ok) {
      const statsJson = await statsRes.json().catch(() => ({}));
      setStats({ ...EMPTY_STATS, ...(statsJson ?? {}) });
    }
  }

  async function loadRows(nextPage = page) {
    setMsg(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
      if (debouncedQ) params.set('q', debouncedQ);
      if (ownerFilter) params.set('owner', ownerFilter);
      if (sectorFilter) params.set('sector', sectorFilter);
      if (integrationFilter) params.set('integration', integrationFilter);
      if (kasaFilter) params.set('kasa_firmasi', kasaFilter);
      if (kunyeFilter) params.set('kunye_status', kunyeFilter);
      if (fazFilter) params.set('faz_no', fazFilter);

      params.set('include_report_only', '1');

      const listRes = await fetch(`/api/crm/list?${params.toString()}`, { cache: 'no-store' });
      const listJson = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        setMsg(listJson?.message || 'Bu ekrana erişim yetkin yok.');
        setRows([]);
        setTotal(0);
      } else {
        setRows(listJson.rows ?? []);
        setTotal(Number(listJson.total ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    void Promise.all([loadStats(), loadRows(page)]);
  }, [page, debouncedQ, ownerFilter, sectorFilter, integrationFilter, kasaFilter, kunyeFilter, fazFilter, pageSize]);

  const ownerOptions = useMemo(
    () => uniqueOwnerOptions([...filterOptions.ownerOptions, HAVUZ_ACCOUNT_NAME]),
    [filterOptions.ownerOptions]
  );

  const sectorOptions = useMemo(
    () =>
      uniqueOptions([
        ...filterOptions.sectorCatalogOptions.map((item) => item.value),
        ...filterOptions.sectorOptions,
        ...rows.map((r) => r.sektor),
        ...stats.bySector.map((r) => r.label),
      ]),
    [filterOptions.sectorCatalogOptions, filterOptions.sectorOptions, rows, stats.bySector]
  );

  const integrationOptions = useMemo(
    () => uniqueOptions([...filterOptions.integrationCatalogOptions.map((item) => item.value), ...filterOptions.integrationOptions, ...rows.map((r) => r.entegrasyon_tipi)]),
    [filterOptions.integrationCatalogOptions, filterOptions.integrationOptions, rows]
  );
  const sectorFormOptions = useMemo(
    () => uniqueOptions([...filterOptions.sectorCatalogOptions.map((item) => item.value), sektor]),
    [filterOptions.sectorCatalogOptions, sektor],
  );
  const integrationFormOptions = useMemo(
    () => uniqueOptions([...filterOptions.integrationCatalogOptions.map((item) => item.value), entegrasyonTipi]),
    [filterOptions.integrationCatalogOptions, entegrasyonTipi],
  );

  const kasaOptions = useMemo(
    () => uniqueOptions([...filterOptions.kasaOptions, ...rows.map((r) => r.kasa_firmasi)]),
    [filterOptions.kasaOptions, rows]
  );

  const visibleRows = rows;

  const visibleTotal = visibleRows.length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const phaseBuckets = useMemo(() => buildPhaseBuckets(stats.byPhase), [stats.byPhase]);
  const maxPhaseBucket = Math.max(1, ...phaseBuckets.map((item) => item.value));
  const topOwners = (stats.byOwner.length ? stats.byOwner : [{ label: 'Kayıt yok', value: 0 }]).slice(0, 6);
  const topSectors = (stats.bySector.length ? stats.bySector : [{ label: 'Tanımsız', value: 0 }]).slice(0, 7);
  const riskCount = stats.kunyeEksik + stats.kunyeYok;
  const sectorMax = Math.max(1, ...topSectors.map((item) => item.value));
  const ownerMax = Math.max(1, ...topOwners.map((item) => item.value));
  const havuzOwner = topOwners.find((item) => item.label === HAVUZ_ACCOUNT_NAME) ?? null;
  const fieldOwners = topOwners.filter((item) => item.label !== HAVUZ_ACCOUNT_NAME);
  const visibleOwnerBars = fieldOwners.length ? fieldOwners : topOwners;
  const fieldOwnerMax = Math.max(1, ...visibleOwnerBars.map((item) => item.value));
  const completionRate = stats.total ? Math.round((stats.kunyeVar / Math.max(1, stats.total)) * 100) : 0;
  const riskRate = stats.total ? Math.round((riskCount / Math.max(1, stats.total)) * 100) : 0;
  const top3SectorShare = stats.total
    ? Math.round((topSectors.slice(0, 3).reduce((sum, item) => sum + item.value, 0) / Math.max(1, stats.total)) * 100)
    : 0;
  const accountShare = stats.total && visibleOwnerBars[0]?.value
    ? Math.round((visibleOwnerBars[0].value / Math.max(1, stats.total)) * 100)
    : 0;
  const fieldAccountCount = Math.max(0, fieldOwners.length);
  const kunyeDonutStyle = {
    background: `conic-gradient(#22c55e 0% ${completionRate}%, #f59e0b ${completionRate}% ${Math.min(100, completionRate + (stats.total ? Math.round((stats.kunyeEksik / Math.max(1, stats.total)) * 100) : 0))}%, #64748b ${Math.min(100, completionRate + (stats.total ? Math.round((stats.kunyeEksik / Math.max(1, stats.total)) * 100) : 0))}% 100%)`,
  } as React.CSSProperties;
  const accountSegments = visibleOwnerBars.length
    ? (() => {
        const totalFieldOwners = visibleOwnerBars.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8', '#bfdbfe'];
        let start = 0;
        const parts = visibleOwnerBars.map((item, index) => {
          const pct = Math.round((item.value / Math.max(1, totalFieldOwners)) * 100);
          const end = Math.min(100, start + pct);
          const part = `${colors[index % colors.length]} ${start}% ${end}%`;
          start = end;
          return part;
        });
        if (start < 100) parts.push(`#cbd5e1 ${start}% 100%`);
        return parts.join(', ');
      })()
    : '#cbd5e1 0% 100%';
  const accountDonutStyle = {
    background: `conic-gradient(${accountSegments})`,
  } as React.CSSProperties;
  const kasaMap = rows.reduce<Record<string, number>>((acc, row) => {
    const key = (row.kasa_firmasi ?? '').trim() || 'Tanımsız';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const kasaBreakdown = Object.entries(kasaMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const kasaTotal = kasaBreakdown.reduce((sum, item) => sum + item.value, 0);
  const kasaSegments = kasaBreakdown.length
    ? (() => {
        const colors = ['#5eead4', '#38bdf8', '#818cf8', '#cbd5e1'];
        let start = 0;
        const parts = kasaBreakdown.map((item, index) => {
          const pct = Math.round((item.value / Math.max(1, kasaTotal)) * 100);
          const end = Math.min(100, start + pct);
          const part = `${colors[index % colors.length]} ${start}% ${end}%`;
          start = end;
          return part;
        });
        if (start < 100) parts.push(`#334155 ${start}% 100%`);
        return parts.join(', ');
      })()
    : '#334155 0% 100%';
  const kasaDonutStyle = {
    background: `conic-gradient(${kasaSegments})`,
  } as React.CSSProperties;
  const topKasa = kasaBreakdown[0] ?? null;
  const actionCards = ACTION_MODES.map((item) => ({ ...item, value: item.metric(stats) }));
  const currentAction = actionCards.find((item) => item.key === actionMode) ?? actionCards[0];

  const activeFilterTokens = useMemo<FilterToken[]>(() => {
    const tokens: FilterToken[] = [];
    if (actionMode !== 'all') {
      tokens.push({
        key: 'action-mode',
        label: `Aksiyon modu: ${currentAction.title}`,
        onClear: () => setActionMode('all'),
      });
    }
    if (debouncedQ) tokens.push({ key: 'q', label: `Arama: ${debouncedQ}`, onClear: () => setQ('') });
    if (ownerFilter) tokens.push({ key: 'owner', label: `Sorumlu: ${ownerFilter}`, onClear: () => setOwnerFilter('') });
    if (kunyeFilter) tokens.push({ key: 'kunye', label: `Künye: ${kunyeFilter}`, onClear: () => setKunyeFilter('') });
    if (fazFilter) tokens.push({ key: 'phase', label: `Faz: ${fazFilter}`, onClear: () => setFazFilter('') });
    if (sectorFilter) tokens.push({ key: 'sector', label: `Sektör: ${sectorFilter}`, onClear: () => setSectorFilter('') });
    if (kasaFilter) tokens.push({ key: 'kasa', label: `Kasa Firması: ${kasaFilter}`, onClear: () => setKasaFilter('') });
    if (integrationFilter) {
      tokens.push({
        key: 'integration',
        label: `Entegrasyon: ${integrationFilter}`,
        onClear: () => setIntegrationFilter(''),
      });
    }
    return tokens;
  }, [actionMode, currentAction.title, debouncedQ, ownerFilter, kunyeFilter, fazFilter, sectorFilter, kasaFilter, integrationFilter]);

  const resetForm = () => {
    setEditingId(null);
    setMusteri('');
    setSektor('');
    setSorumlu(displayMeName || HAVUZ_ACCOUNT_NAME);
    setOwnerUserId(me?.id ?? '');
    setEntegrasyonTipi('');
    setSatisOlasiligi('');
    setCustomerType('standard');
    setHasCustomerRole(true);
    setHasBusinessPartnerRole(false);
    setPartnerSubtype('Entegrasyon Firması');
    setIsKolu('Retail');
    setPipelinePolicy('phase_required');
  };

  const openCreate = () => {
    if (!canCreateCustomers) return;
    setMode('create');
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: CrmRow) => {
    if (!canEditCustomer(row)) return;
    setMode('edit');
    setEditingId(row.musteri_id);
    setMusteri(row.musteri ?? '');
    setSektor(row.sektor ?? '');
    setSorumlu(row.sorumlu ?? displayMeName ?? HAVUZ_ACCOUNT_NAME);
    setOwnerUserId(row.owner_user_id ?? '');
    setEntegrasyonTipi(row.entegrasyon_tipi ?? '');
    setSatisOlasiligi(row.satis_olasiligi ?? '');
    setCustomerType(row.customer_type ?? 'standard');
    setHasCustomerRole(row.customer_type !== 'business_partner');
    setHasBusinessPartnerRole(row.customer_type === 'business_partner');
    setPartnerSubtype('Entegrasyon Firması');
    setIsKolu(row.is_kolu ?? 'Retail');
    setPipelinePolicy(row.pipeline_policy ?? 'phase_required');
    setMsg(null);
    setOpen(true);
    if (canManageClassification) {
      setRelationshipsLoading(true);
      void fetch(`/api/crm/relationships?customer_id=${encodeURIComponent(row.musteri_id)}`, { cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'Firma ilişkileri yüklenemedi.');
          const relations = (data.rows ?? []) as OrganizationRelation[];
          const customerRelation = relations.find((item) => item.role_key === 'customer');
          const partnerRelation = relations.find((item) => item.role_key === 'business_partner');
          setHasCustomerRole(Boolean(customerRelation?.is_active));
          setHasBusinessPartnerRole(Boolean(partnerRelation?.is_active));
          setPartnerSubtype(partnerRelation?.subtype || 'Entegrasyon Firması');
        })
        .catch((error) => setMsg(error instanceof Error ? error.message : 'Firma ilişkileri yüklenemedi.'))
        .finally(() => setRelationshipsLoading(false));
    }
  };

  async function saveCustomer() {
    setMsg(null);
    if (!musteri.trim()) return setMsg('Müşteri adı zorunlu.');
    if (!sorumlu.trim()) return setMsg('Sorumlu seçmek zorunlu.');
    if (canManageClassification && !hasCustomerRole && !hasBusinessPartnerRole) {
      return setMsg('Firma en az bir role sahip olmalıdır: Müşteri veya İş Ortağı.');
    }

    setBusySave(true);
    try {
      const url = mode === 'create' ? '/api/crm/create' : '/api/crm/update';
      const body: Record<string, unknown> = {
        musteri: musteri.trim(),
        sektor: sektor.trim() || null,
        sorumlu: sorumlu.trim(),
        owner_user_id: ownerUserId || null,
        entegrasyon_tipi: entegrasyonTipi.trim() || null,
        satis_olasiligi: satisOlasiligi.trim() || null,
        customer_type: canManageClassification
          ? (pipelinePolicy === 'phase_optional' ? 'report_only' : (hasBusinessPartnerRole && !hasCustomerRole ? 'business_partner' : 'standard'))
          : customerType,
        pipeline_policy: pipelinePolicy,
        is_kolu: isKolu,
      };
      if (mode === 'edit') body.musteriId = editingId;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage = j?.message || 'Kayıt sırasında hata oluştu.';
        setMsg(errorMessage);
        appToast.error('Kayıt başarısız', errorMessage);
        return;
      }

      const customerId = mode === 'create' ? String(j?.id ?? '') : String(editingId ?? '');
      if (canManageClassification && customerId) {
        const relationshipRes = await fetch('/api/crm/relationships', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customer_id: customerId,
            customer: hasCustomerRole,
            business_partner: hasBusinessPartnerRole,
            partner_subtype: hasBusinessPartnerRole ? partnerSubtype : null,
          }),
        });
        const relationshipJson = await relationshipRes.json().catch(() => ({}));
        if (!relationshipRes.ok) {
          if (mode === 'create') {
            setMode('edit');
            setEditingId(customerId);
          }
          throw new Error(relationshipJson?.message || 'Firma bilgileri kaydedildi ancak firma rolleri kaydedilemedi.');
        }
      }

      setOpen(false);
      resetForm();
      await Promise.all([loadRows(1), loadStats()]);
      setPage(1);
      const successMessage = mode === 'create' ? 'Müşteri eklendi.' : (j?.message ?? 'Müşteri güncelleme talebi işlendi.');
      setMsg(successMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kayıt sırasında hata oluştu.';
      setMsg(errorMessage);
      appToast.error('Kayıt başarısız', errorMessage);
    } finally {
      setBusySave(false);
    }
  }

  function clearFilters() {
    setActionMode('all');
    setQ('');
    setOwnerFilter('');
    setSectorFilter('');
    setIntegrationFilter('');
    setKasaFilter('');
    setKunyeFilter('');
    setFazFilter('');
  }

  function applyPhaseBucket(filterValue: string, actionKey: ActionModeKey) {
    setActionMode(actionKey);
    setFazFilter(filterValue);
    setPage(1);
  }

  return (
    <main className="customers-page">
      <style jsx>{`
        .customers-page { display: grid; gap: 18px; }
        .pax-hero {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 30px;
          padding: 24px;
          color: white;
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 28%),
            radial-gradient(circle at bottom left, rgba(255,255,255,0.08), transparent 24%),
            linear-gradient(135deg, #07111f 0%, #0f2354 42%, #2563eb 100%);
          box-shadow: 0 28px 50px rgba(37,99,235,0.18);
        }
        .hero::after {
          content: '';
          position: absolute;
          inset: auto -90px -110px auto;
          width: 280px;
          height: 280px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
        }
        .hero-copy {
          position: relative; z-index: 1; display: flex; justify-content: flex-end; align-items: center;
        }
        .eyebrow {
          display: inline-flex; align-items: center; gap: 8px; width: fit-content; padding: 8px 12px;
          border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: .03em;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.14);
        }
        .hero-title {
          margin: 0; font-size: clamp(26px, 3vw, 36px); line-height: 1.03;
          letter-spacing: -0.04em; font-weight: 900;
        }
        .hero-sub { margin: 0; max-width: 720px; color: rgba(255,255,255,0.84); font-size: 14px; line-height: 1.65; }
        .hero-tools { display: flex; flex-wrap: wrap; gap: 10px; }
        .hero-metrics { position: relative; z-index: 1; display: grid; gap: 12px; align-content: start; }
        .hero-summary {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;
        }
        .executive-card {
          padding: 18px; border-radius: 24px; background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(12px); display: grid; gap: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
          min-height: 310px;
          overflow: hidden;
        }
        .executive-card.is-risk { background: linear-gradient(180deg, rgba(255,247,237,.16) 0%, rgba(255,255,255,.10) 100%); border-color: rgba(254,215,170,.48); }
        .executive-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
        }
        .executive-kicker {
          font-size: 11px; color: rgba(255,255,255,.7); text-transform: uppercase; letter-spacing: .08em; font-weight: 900;
        }
        .executive-value { font-size: 38px; line-height: 1; font-weight: 900; letter-spacing: -0.04em; }
        .executive-sub { font-size: 12px; line-height: 1.55; color: rgba(255,255,255,.76); margin-top: 6px; }
        .executive-main {
          display: grid; grid-template-columns: minmax(0, 1fr) 116px; gap: 16px; align-items: center;
          min-width: 0;
        }
        .donut-wrap { display: grid; gap: 10px; justify-items: center; min-width: 0; }
        .donut {
          width: 96px; height: 96px; border-radius: 999px; position: relative;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
        }
        .donut::after {
          content: ''; position: absolute; inset: 16px; border-radius: 999px; background: rgba(15,23,42,.92);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        .donut-center {
          position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; text-align: center; padding: 0 10px;
        }
        .donut-center > div { display: grid; justify-items: center; gap: 4px; max-width: 62px; width: 100%; }
        .donut-center strong { font-size: 17px; line-height: 1; font-weight: 900; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .donut-center span { font-size: 9px; line-height: 1.05; color: rgba(255,255,255,.74); text-transform: uppercase; letter-spacing: .04em; text-align: center; word-break: keep-all; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .split-stats { display: grid; gap: 8px; min-width: 0; }
        .split-row {
          display: grid; grid-template-columns: 10px minmax(56px, 1fr) minmax(24px, auto); gap: 10px; align-items: center;
          font-size: 12px; color: rgba(255,255,255,.84);
          min-width: 0;
        }
        .split-row span:not(.split-dot) { min-width: 0; }
        .split-row strong { justify-self: end; white-space: nowrap; }
        .split-dot { width: 8px; height: 8px; border-radius: 999px; }
        .split-bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
        .split-bar span { display:block; height:100%; border-radius:inherit; background: rgba(255,255,255,.82); }
        .donut-secondary {
          display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 14px; align-items: center;
          min-height: 88px; padding: 12px; border-radius: 18px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.10);
        }
        .donut-secondary-info { display: grid; gap: 8px; min-width: 0; }
        .donut-secondary-kicker { font-size: 11px; color: rgba(255,255,255,.72); text-transform: uppercase; letter-spacing: .06em; font-weight: 800; }
        .donut-secondary-title { font-size: 18px; line-height: 1.1; font-weight: 900; }
        .donut-secondary-note { font-size: 12px; line-height: 1.45; color: rgba(255,255,255,.76); }
        .legend-list { display: grid; gap: 6px; }
        .legend-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 12px; color: rgba(255,255,255,.86); }
        .legend-row strong { white-space: nowrap; }
        .sector-bars, .owner-bars { display: grid; gap: 10px; }
        .bar-row {
          display: grid; grid-template-columns: minmax(104px, 132px) minmax(0, 1fr) auto; gap: 10px; align-items: center;
          font-size: 12px; color: rgba(255,255,255,.9);
        }
        .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
        .bar-track { height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
        .bar-track span { display:block; height:100%; border-radius:inherit; background: linear-gradient(90deg, rgba(191,219,254,.95), rgba(255,255,255,.75)); }
        .bar-value { font-size: 12px; font-weight: 900; color: #fff; }
        .owner-layout { display: grid; grid-template-columns: minmax(0, 1fr) 132px; gap: 16px; align-items: center; }
        .hero-metric {
          padding: 18px; border-radius: 24px; background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(12px); display: grid; gap: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
        }
        .hero-metric.is-risk {
          background: linear-gradient(180deg, rgba(255,247,237,.18) 0%, rgba(255,255,255,.10) 100%);
          border-color: rgba(254,215,170,.48);
        }
        .hero-metric-label {
          font-size: 12px; color: rgba(255,255,255,0.72);
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          text-transform: uppercase; letter-spacing: .05em; font-weight: 800;
        }
        .hero-metric-value { font-size: 34px; line-height: 1; font-weight: 900; letter-spacing: -0.04em; }
        .hero-metric-note { font-size: 12px; color: rgba(255,255,255,0.76); line-height: 1.55; }
        .hero-progress { height: 8px; border-radius: 999px; background: rgba(255,255,255,.16); overflow: hidden; }
        .hero-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, rgba(255,255,255,.95), rgba(191,219,254,.72)); }
        .hero-detail-list { display: grid; gap: 8px; }
        .hero-detail-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-size: 12px; color: rgba(255,255,255,.84); padding-top: 8px; border-top: 1px solid rgba(255,255,255,.10);
        }
        .hero-detail-row strong { font-size: 13px; color: white; }
        .hero-inline-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .hero-meta-pill {
          display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px;
          border-radius: 999px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.12);
          font-size: 12px; color: rgba(255,255,255,.88); font-weight: 800;
        }
        .hero-focus {
          padding: 18px; border-radius: 24px; background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.14); display: grid; gap: 10px;
        }
        .hero-focus-kicker { font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,0.72); }
        .hero-focus-title { font-size: 22px; line-height: 1.05; font-weight: 900; letter-spacing: -0.03em; }
        .hero-focus-sub { font-size: 13px; color: rgba(255,255,255,0.76); line-height: 1.55; }
        .hero-focus-bar { height: 10px; border-radius: 999px; background: rgba(255,255,255,0.16); overflow: hidden; }
        .hero-focus-bar span {
          display: block; height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, rgba(255,255,255,0.94), rgba(191,219,254,0.72));
        }

        /* TEMA KURALI: renkler globals.css token'larından gelir, token'lar da
           yalnızca <html data-theme> ile değişir. Bu ekran koyu temada gerçekten
           koyu görünür — "beyaz kartı zorla ayakta tutmak" satır/yazı renklerinin
           birbirinden kopmasına yol açıyordu (koyu satır + koyu yazı hatası).
           Vurgu renkleri iki temada ayrı tanımlanır: */
        .customers-page {
          --cc-accent: #2563eb;
          --cc-primary-a: #0f172a;
          --cc-primary-b: #1e293b;
        }
        :global([data-theme="dark"]) .customers-page {
          --cc-accent: #93b4fd;
          --cc-primary-a: #4f46e5;
          --cc-primary-b: #6366f1;
        }
        .surface {
          border: 1px solid var(--border); background: var(--surface); color: var(--text);
          border-radius: 24px; padding: 18px; box-shadow: var(--shadow-sm);
        }
        .surface-tight { padding: 14px; }
        .section-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; margin-bottom: 16px;
        }
        .section-kicker {
          font-size: 12px; font-weight: 900; letter-spacing: .03em; text-transform: uppercase;
          color: var(--cc-accent); margin-bottom: 6px;
        }
        .section-title { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; }
        .section-note { margin-top: 4px; color: var(--text-3); font-size: 13px; line-height: 1.5; }

        .primary, .secondary, .ghost, .phase-segment, .action-card {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 42px; border-radius: 14px; padding: 0 14px; font-weight: 800;
          cursor: pointer; transition: .18s ease; text-decoration: none;
        }
        .primary { border: 1px solid var(--cc-primary-a); background: linear-gradient(135deg,var(--cc-primary-a) 0%,var(--cc-primary-b) 100%); color: #fff; }
        .secondary { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: #fff; }
        .ghost { border: 1px solid var(--border); background: var(--surface-2); color: var(--text); }

        .command-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(290px, 0.95fr); gap: 18px; }
        .action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .action-card {
          align-items: flex-start; justify-content: flex-start; flex-direction: column;
          min-height: 132px; padding: 16px; border: 1px solid var(--border); background: var(--surface);
          color: var(--text);
        }
        .action-card:hover { transform: translateY(-1px); box-shadow: 0 14px 26px rgba(15,23,42,0.06); }
        .action-card.active { border-color: var(--cc-accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
        .action-card-top { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .action-icon {
          width: 40px; height: 40px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
          background: var(--chip-indigo-bg); color: var(--chip-indigo-color); border: 1px solid var(--chip-indigo-bd);
        }
        .action-value { font-size: 28px; line-height: 1; font-weight: 900; color: var(--text); letter-spacing: -0.03em; }
        .action-title { font-size: 15px; font-weight: 900; color: var(--text); }
        .action-desc { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--text-3); }

        .search-shell { display: grid; grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(180px, 1fr)); gap: 12px; }
        /* align-content: start — komşu alanda açıklama satırı olsa bile select uzamaz. */
        .field { display: grid; gap: 8px; align-content: start; }
        .field-label { font-size: 12px; font-weight: 900; color: var(--text-2); }
        .input, .select {
          width: 100%; min-height: 46px; border-radius: 14px; border: 1px solid var(--border);
          padding: 0 14px; background: var(--surface); color: var(--text); outline: none;
        }
        .search-input {
          display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px;
          border-radius: 14px; border: 1px solid var(--border); background: var(--surface);
        }
        .search-input input { flex: 1; min-width: 0; border: none; outline: none; padding: 0; background: transparent; }

        .phase-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
        .phase-segment {
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          min-height: 120px;
          padding: 16px;
          border: 1px solid var(--border);
          background: var(--surface);
          text-align: left;
        }
        .phase-segment.active { outline: 2px solid var(--accent-soft); border-color: var(--accent-border); }
        .phase-segment-head {
          width: 100%;
          display: block;
          margin-bottom: 14px;
          text-align: left;
        }
        .phase-segment-head > div { width: 100%; min-width: 0; text-align: left; }
        .phase-segment-name {
          display: block;
          min-height: 20px;
          margin: 0;
          padding: 0;
          font-size: 15px;
          font-weight: 900;
          line-height: 20px;
          color: var(--text);
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .phase-segment-range {
          display: block;
          margin: 2px 0 0;
          padding: 0;
          font-size: 12px;
          line-height: 16px;
          color: var(--text-3);
          text-align: left;
        }
        .phase-segment-value { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: var(--text); line-height: 1; }
        .phase-progress { margin-top: auto; width: 100%; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--text) 12%, transparent); overflow: hidden; }
        .phase-progress span {
          display: block; height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--surface)));
        }

        .advanced-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
        .result-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 14px 16px; border-radius: 18px; background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .result-copy { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .result-metric { display: grid; gap: 2px; }
        .result-metric strong { font-size: 26px; line-height: 1; letter-spacing: -0.03em; }
        .result-metric span { font-size: 12px; color: var(--text-3); }
        .token-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .token {
          display: inline-flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 12px;
          border-radius: 999px; background: var(--chip-indigo-bg); border: 1px solid var(--chip-indigo-bd); color: var(--chip-indigo-color);
          font-size: 12px; font-weight: 800;
        }
        .token button { border: none; background: transparent; color: inherit; cursor: pointer; font-weight: 900; }

        .insight-column { display: grid; gap: 14px; }
        .insight-banner {
          display: grid; gap: 14px; padding: 16px; border-radius: 22px;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: white;
          border: 1px solid rgba(15,23,42,0.08);
        }
        .insight-banner-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .insight-banner strong { font-size: 24px; line-height: 1; letter-spacing: -0.03em; }
        .insight-note { color: rgba(255,255,255,0.74); font-size: 12px; line-height: 1.55; }
        .list-card { display: grid; gap: 12px; }
        .mini-list, .sector-grid { display: grid; gap: 10px; }
        .mini-item, .sector-item {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center;
          padding: 12px 14px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border);
        }
        .mini-label, .sector-label { font-size: 13px; font-weight: 700; color: var(--text); }
        .mini-value {
          min-width: 36px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
          padding: 0 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border);
          font-size: 12px; font-weight: 900; color: var(--text);
        }
        .sector-value { font-size: 12px; font-weight: 900; color: var(--cc-accent); }

        .table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 18px; }
        /* Tablo kaba sığar: sabit 980px taban genişliği kaldırıldı, uzun hücreler satır kırar
           (yakınlaştırılmış tarayıcıda 'İşlem' kolonu kesiliyordu). overflow:auto yalnız yedek. */
        table { width: 100%; min-width: 0; border-collapse: collapse; background: var(--surface); table-layout: auto; }
        th {
          text-align: left; padding: 12px 10px; font-size: 11px; letter-spacing: .04em;
          text-transform: uppercase; color: var(--text-3); background: var(--surface-2); border-bottom: 1px solid var(--border);
        }
        td { padding: 12px 10px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; color: var(--text-2); }
        td.ct-cell { max-width: 180px; white-space: normal; overflow-wrap: anywhere; color: var(--text-2); font-weight: 600; line-height: 1.3; }
        tbody tr:nth-child(even) { background: color-mix(in srgb, var(--text) 4%, transparent); }
        .name { color: var(--text); font-weight: 900; text-decoration: none; }
        .name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pill.phase-pill { min-height: 28px; padding: 5px 10px; white-space: normal; text-align: center; line-height: 1.2; max-width: 100%; }
        .muted { color: var(--text-3); font-size: 12px; margin-top: 6px; }
        .pill {
          display: inline-flex; align-items: center; justify-content: center; min-height: 30px;
          padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap;
        }
        .phase-column, .kunye-column { width: 140px; text-align: center; }
        .phase-pill, .kunye-pill { min-width: 108px; min-height: 32px; justify-content: center; }
        .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .link-btn {
          display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 12px;
          border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text);
          font-size: 12px; font-weight: 900; text-decoration: none; cursor: pointer;
        }
        .phase-column { text-align: center; }
        .pager {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          flex-wrap: wrap; margin-top: 14px;
        }
        .pager-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .message {
          font-size: 13px; color: var(--chip-red-color); background: var(--chip-red-bg);
          padding: 12px 14px; border-radius: 14px; border: 1px solid var(--chip-red-bd);
        }

        .modal {
          position: fixed; inset: 0; background: rgba(15,23,42,.42); display: grid;
          place-items: center; padding: 20px; z-index: 100; backdrop-filter: blur(4px);
        }
        .modal-box {
          width: min(720px, 100%); display: grid; gap: 18px; border-radius: 24px; padding: 22px;
          background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: 0 32px 60px rgba(15,23,42,.28);
        }
        .title { font-size: 24px; line-height: 1.1; font-weight: 900; letter-spacing: -0.03em; color: var(--text); }
        .sub { margin-top: 8px; color: var(--text-3); font-size: 13px; line-height: 1.55; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .label { font-size: 12px; font-weight: 900; color: var(--text-2); }
        .tooltip-anchor { position: relative; }
        .tooltip-anchor::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          bottom: calc(100% + 10px);
          transform: translateX(-50%) translateY(4px);
          width: max-content;
          max-width: min(260px, calc(100vw - 48px));
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15,23,42,0.96);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
          box-shadow: 0 18px 40px rgba(15,23,42,.28);
          opacity: 0;
          pointer-events: none;
          transition: .18s ease;
          z-index: 40;
          white-space: normal;
          text-align: left;
        }
        .tooltip-anchor::before {
          content: '';
          position: absolute;
          left: 50%;
          bottom: calc(100% + 4px);
          transform: translateX(-50%) translateY(4px);
          border: 6px solid transparent;
          border-top-color: rgba(15,23,42,0.96);
          opacity: 0;
          pointer-events: none;
          transition: .18s ease;
          z-index: 39;
        }
        .tooltip-anchor:hover::after,
        .tooltip-anchor:hover::before {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        @media (max-width: 1200px) {
          .pax-hero, .command-grid, .search-shell { grid-template-columns: 1fr; }
          .action-grid, .advanced-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .phase-strip, .grid, .hero-summary, .action-grid, .advanced-grid { grid-template-columns: 1fr; }
          .donut-secondary, .owner-layout, .executive-main { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .pax-hero, .surface, .modal-box { padding: 16px; border-radius: 20px; }
        }
      `}</style>

      <CustomersHero
        stats={stats}
        completionRate={completionRate}
        kunyeDonutStyle={kunyeDonutStyle}
        kasaDonutStyle={kasaDonutStyle}
        accountDonutStyle={accountDonutStyle}
        kasaBreakdown={kasaBreakdown}
        topSectors={topSectors}
        sectorMax={sectorMax}
        visibleOwnerBars={visibleOwnerBars}
        fieldOwnerMax={fieldOwnerMax}
        fieldAccountCount={fieldAccountCount}
      />

            <section className="surface">
        <div className="search-shell">
          <label className="field">
            <span className="field-label">Arama</span>
            <div className="search-input">
              <Search size={16} strokeWidth={1.7} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, sektör, account, faz veya entegrasyon ara" />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Müşteri sorumlusu</span>
            <select className="select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">Tüm sorumlular</option>
              {ownerOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Künye durumu</span>
            <select className="select" value={kunyeFilter} onChange={(e) => setKunyeFilter(e.target.value)}>
              <option value="">Tüm durumlar</option>
              {KUNYE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Faz / aralık</span>
            <select className="select" value={fazFilter} onChange={(e) => setFazFilter(e.target.value)}>
              <option value="">Tüm fazlar</option>
              <option value="1-4">Faz 1-4</option>
              <option value="5-9">Faz 5-9</option>
              <option value="10-14">Faz 10-14</option>
              <option value="15-23">Faz 15-23</option>
              <option value="24-25">Faz 24-25</option>
              {filterOptions.phaseOptions.map((name) => (
                <option key={name} value={name.replace('FAZ ', '')}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="section-note" style={{ marginBottom: 10 }}>
            Faz kartları artık sadece görünüm değil; tıklandığında doğrudan o pipeline katmanına filtre uygular.
          </div>
          <div className="phase-strip">
            {phaseBuckets.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`phase-segment ${fazFilter === item.filterValue ? 'active' : ''}`}
                style={{ background: item.tone }}
                onClick={() => applyPhaseBucket(item.filterValue, item.key as ActionModeKey)}
              >
                <div className="phase-segment-head">
                  <div>
                    <div className="phase-segment-name">{item.label}</div>
                    <div className="phase-segment-range">{item.range}</div>
                  </div>
                </div>
                <div className="phase-segment-value">{item.value}</div>
                <div className="phase-progress">
                  <span style={{ width: `${(item.value / maxPhaseBucket) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="ghost" onClick={() => setShowAdvanced((prev) => !prev)}>
            <Filter size={16} strokeWidth={1.7} /> Gelişmiş filtreler
            <ChevronDown size={16} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>

        {showAdvanced ? (
          <div className="advanced-grid" style={{ marginTop: 14 }}>
            <label className="field">
              <span className="field-label">Sektör</span>
              <select className="select" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                <option value="">Tüm sektörler</option>
                {sectorOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Entegrasyon yapısı</span>
              <select className="select" value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value)}>
                <option value="">Tüm entegrasyonlar</option>
                {integrationOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Kasa firması</span>
              <select className="select" value={kasaFilter} onChange={(e) => setKasaFilter(e.target.value)}>
                <option value="">Tüm kasa firmaları</option>
                {kasaOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Sayfa boyutu</span>
              <select className="select" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} / sayfa</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span className="field-label">Görünüm özeti</span>
              <div className="select" style={{ display: 'flex', alignItems: 'center', fontWeight: 800 }}>
                {visibleTotal} görünen · Toplam {total} · Sayfa {currentPage}/{totalPages}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {activeFilterTokens.length ? (
        <section className="result-bar">
          <div className="result-copy">
            <div className="result-metric">
              <strong>{visibleTotal}</strong>
              <span>Görünen müşteri</span>
            </div>
            <div className="section-note">Şu an görünüm, aksiyon modu ve filtrelerin birleşiminden oluşuyor. Toplam havuz: {total}</div>
          </div>
          <div className="token-row">
            {activeFilterTokens.map((item) => (
              <span className="token" key={item.key}>
                {item.label}
                <button type="button" onClick={item.onClear}>×</button>
              </span>
            ))}
            <button type="button" onClick={clearFilters} style={{ minHeight: 36, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-2)', fontWeight: 800, cursor: 'pointer' }}>
              Tüm filtreleri temizle
            </button>
          </div>
        </section>
      ) : null}

      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="section-head">
          <div>
            <div className="section-kicker">Execution Layer</div>
            <div className="section-title">Müşteri listesi</div>
          </div>
          {canCreateCustomers ? <button className="primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={1.7} /> Müşteri ekle
          </button> : null}
        </div>

        <div className="table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Müşteri Adı</th>
                <th className="phase-column">Faz</th>
                <th>Sektör</th>
                <th>Account</th>
                <th>Kasa Firması</th>
                <th className="kunye-column">Künye</th>
                <th>Entegrasyon</th>
                <th style={{ width: 120 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.musteri_id}>
                  <td>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <Link
                        className="name"
                        href={`/crm/${r.musteri_id}`}
                        title="Müşteri detayına git"
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: "var(--accent, #4f46e5)",
                          textDecoration: "underline",
                          textDecorationColor: "color-mix(in srgb, currentColor 35%, transparent)",
                          textUnderlineOffset: 3,
                        }}
                      >
                        {r.musteri}
                      </Link>
                      {(() => {
                        const segmentation = deriveCustomerSegmentation(r.aktif_faz_no);
                        const firmaTone = customerStatusTone(segmentation.firmaDurumu);
                        const yonetimTone = managementTypeTone(segmentation.yonetimTipi);
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span className="pill" style={{ background: firmaTone.bg, color: firmaTone.color, border: `1px solid ${firmaTone.border}` }}>
                              {segmentation.firmaDurumu}
                            </span>
                            <span className="pill" style={{ background: yonetimTone.bg, color: yonetimTone.color, border: `1px solid ${yonetimTone.border}` }}>
                              {segmentation.yonetimTipi}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="phase-column">
                    {(() => {
                      const displayedPhase = getDisplayedPhase(r);
                      if (r.report_only) return <span className="pill" style={{ background: 'var(--chip-gray-bg)', color: 'var(--chip-gray-color)', border: '1px solid var(--chip-gray-bd)' }}>Rapor Müşterisi</span>;
                      if (displayedPhase.phaseNo == null) return null;
                      const phaseMeta = getPhaseMeta(displayedPhase.phaseNo);
                      return (
                        <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                          <span className="pill phase-pill" style={phaseMeta.style}>
                            {phaseMeta.label} · Faz {displayedPhase.phaseNo}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="ct-cell" title={r.sektor ?? undefined}>{r.sektor ?? '-'}</td>
                  <td className="ct-cell" title={r.sorumlu ?? undefined}>{r.sorumlu ?? '-'}</td>
                  <td className="ct-cell" title={r.kasa_firmasi ?? undefined}>{r.kasa_firmasi ?? '-'}</td>
                  <td className="kunye-column">
                    {r.report_only ? (
                      <span className="pill kunye-pill" style={{ background: 'var(--chip-gray-bg)', color: 'var(--chip-gray-color)', border: '1px solid var(--chip-gray-bd)' }}>
                        Kapsam Dışı
                      </span>
                    ) : (
                      <span className="pill kunye-pill" style={statusTone(r.kunye_durumu)}>
                        {presentKunyeStatus(r.kunye_durumu)}
                      </span>
                    )}
                  </td>
                  <td className="ct-cell">{r.entegrasyon_tipi ?? '-'}</td>
                  <td>
                    {canEditCustomer(r) ? <button type="button" className="ghost" onClick={() => openEdit(r)}>Düzenle</button> : null}
                  </td>
                </tr>
              ))}
              {!loading && !visibleRows.length ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 18 }}>Kayıt bulunamadı.</td></tr>
              ) : null}
              {loading ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 18 }}>Yükleniyor...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <div className="section-note">Görünen {visibleTotal} müşteri · Toplam havuz {total} · Sayfa {currentPage} / {totalPages}</div>
          <div className="pager-buttons">
            <button className="ghost" disabled={currentPage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button>
            <button className="ghost" disabled={currentPage >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
      </section>

      {open ? (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="title">{mode === 'create' ? 'Müşteri ekle' : 'Müşteriyi düzenle'}</div>
              <div className="sub">
                Müşteri adı, sektör, sorumlu ve entegrasyon bilgileri bu ekrandan düzenlenir.
                Kaydettiğinde değişiklikler doğrudan müşteri kaydına işlenir.
              </div>
            </div>

            <div className="grid">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Müşteri adı</span>
                <input className="input" value={musteri} onChange={(e) => setMusteri(e.target.value)} />
              </label>

              <label className="field">
                <span className="label">Sektör</span>
                <select
                  className="select"
                  value={sektor}
                  onChange={(e) => {
                    const nextSektor = e.target.value;
                    setSektor(nextSektor);
                    // Vertical alt sektörü seçildiyse İş Kolu otomatik Vertical önerilir
                    // (kullanıcı isterse değiştirir). Diğer sektörler İş Kolu'na dokunmaz.
                    if (filterOptions.verticalSectorValues.includes(nextSektor)) setIsKolu('Vertical');
                    // Eski İŞ ORTAĞI sektör seçimi, firma rolünü önerir. Müşteri
                    // rolünü kaldırmaz; aynı firma iki rolü birlikte taşıyabilir.
                    if (isBusinessPartnerSector(nextSektor)) setHasBusinessPartnerRole(true);
                  }}
                >
                  <option value="">Seçiniz</option>
                  {sectorFormOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">İş Kolu</span>
                <select className="select" value={isKolu} onChange={(e) => setIsKolu(e.target.value)}>
                  {(filterOptions.isKoluOptions.length ? filterOptions.isKoluOptions : [{ label: 'Retail', value: 'Retail' }]).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Sorumlusu</span>
                <select
                  className="select"
                  value={ownerUserId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextOwner = ownerDirectoryOptions.find((user) => user.id === nextId);
                    setOwnerUserId(nextId);
                    setSorumlu(nextOwner ? String(nextOwner.full_name ?? nextOwner.email) : HAVUZ_ACCOUNT_NAME);
                  }}
                  disabled={!canAssignCustomers}
                >
                  {canAssignCustomers ? <option value="">Havuz / Atanmamış</option> : null}
                  {ownerDirectoryOptions.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Entegrasyon</span>
                <select className="select" value={entegrasyonTipi} onChange={(e) => setEntegrasyonTipi(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {integrationFormOptions.map((name) => (
                    <option key={name || 'empty'} value={name}>{name || 'Seçiniz'}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Satış Olasılığı</span>
                <select className="select" value={satisOlasiligi} onChange={(e) => setSatisOlasiligi(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {filterOptions.salesProbabilityOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              {canManageClassification ? (
                <>
                  <fieldset className="field" disabled={relationshipsLoading} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, margin: 0 }}>
                    <legend className="label" style={{ padding: '0 6px' }}>Firma Rolleri</legend>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800 }}>
                        <input type="checkbox" checked={hasCustomerRole} onChange={(e) => setHasCustomerRole(e.target.checked)} /> Müşteri
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800 }}>
                        <input type="checkbox" checked={hasBusinessPartnerRole} onChange={(e) => setHasBusinessPartnerRole(e.target.checked)} /> İş Ortağı
                      </label>
                      <small className="muted">İkisini birlikte seçebilirsin; müşteri ve iş ortağı fazları ayrı ilerler.</small>
                    </div>
                  </fieldset>
                  {hasBusinessPartnerRole ? (
                    <label className="field">
                      <span className="label">İş Ortağı Türü</span>
                      <select className="select" value={partnerSubtype} onChange={(e) => setPartnerSubtype(e.target.value)}>
                        <option value="Entegrasyon Firması">Entegrasyon Firması</option>
                        <option value="Donanım Firması">Donanım Firması</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="field">
                    <span className="label">Faz Takip Kuralı</span>
                    <select className="select" value={pipelinePolicy} onChange={(e) => setPipelinePolicy(e.target.value)}>
                      {filterOptions.pipelinePolicyOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.value === 'phase_required' ? 'Faz Takibi Zorunlu' : item.value === 'phase_optional' ? 'Yalnız Aktivite / Faz Takibi Yok' : item.label}
                        </option>
                      ))}
                    </select>
                    <small className="muted">Faz takibi yok seçilirse aktivite girilebilir; faz, durum ve bekleyen taraf zorunlu olmaz.</small>
                  </label>
                </>
              ) : null}
            </div>

            {msg ? <div className="message">{msg}</div> : null}

            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setOpen(false)}>Kapat</button>
              <button className="primary" onClick={saveCustomer} disabled={busySave}>
                {busySave ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
