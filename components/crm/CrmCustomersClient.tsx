'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Filter,
  Layers3,
  Plus,
  Search,
  Target,
  Users,
} from 'lucide-react';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';
import { presentKunyeStatus } from '@/lib/kunye';

type CrmRow = {
  musteri_id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  kasa_firmasi?: string | null;
  kunye_durumu?: string | null;
};

type Me = { email: string; full_name: string | null; role: string };
type AllowedUser = { email: string; full_name: string | null; role: string; is_active: boolean };
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
  phaseOptions: string[];
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const KUNYE_OPTIONS = [
  { value: 'Tamam', label: 'Tamam' },
  { value: 'Eksik', label: 'Eksik' },
  { value: 'Yok', label: 'Yok' },
] as const;

const SECTOR_PRESET_OPTIONS = [
  'Elektronik & Beyaz Eşya',
  'Ev & Yaşam / Yapı Market',
  'FMCG Dağıtım Kanalları',
  'Gıda Perakendesi',
  'Hazır Giyim',
  'Lojistik & Kargo',
  'Yeme-İçme',
];

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
  phaseOptions: [],
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

function statusTone(status?: string | null) {
  if (status === 'Var' || status === 'Tamam') {
    return { background: '#ecfdf3', color: '#166534', border: '1px solid #bbf7d0' };
  }
  if (status === 'Eksik') {
    return { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
  }
  return { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' };
}

function uniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr')
  );
}

function parsePhaseNo(label: string) {
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function sumPhaseRange(items: SummaryItem[], min: number, max: number) {
  return items.reduce((acc, item) => {
    const phaseNo = parsePhaseNo(item.label);
    if (phaseNo && phaseNo >= min && phaseNo <= max) return acc + item.value;
    return acc;
  }, 0);
}

function buildPhaseBuckets(items: SummaryItem[]): PhaseBucket[] {
  return [
    {
      key: 'lead',
      label: 'Lead',
      range: 'Faz 1-4',
      value: sumPhaseRange(items, 1, 4),
      filterValue: '1-4',
      tone: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)',
    },
    {
      key: 'contact',
      label: 'Contact',
      range: 'Faz 5-9',
      value: sumPhaseRange(items, 5, 9),
      filterValue: '5-9',
      tone: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
    },
    {
      key: 'opportunity',
      label: 'Opportunity',
      range: 'Faz 10-14',
      value: sumPhaseRange(items, 10, 14),
      filterValue: '10-14',
      tone: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    },
    {
      key: 'pilot',
      label: 'Pilot',
      range: 'Faz 15-23',
      value: sumPhaseRange(items, 15, 23),
      filterValue: '15-23',
      tone: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',
    },
    {
      key: 'rollout',
      label: 'Rollout',
      range: 'Faz 24-25',
      value: sumPhaseRange(items, 24, 25),
      filterValue: '24-25',
      tone: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    },
  ];
}

export default function CrmCustomersClient() {
  const [rows, setRows] = useState<CrmRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [allowed, setAllowed] = useState<AllowedUser[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_OPTIONS);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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

  const [ownerFilter, setOwnerFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState('');
  const [kunyeFilter, setKunyeFilter] = useState('');
  const [fazFilter, setFazFilter] = useState('');

  const displayMeName = useMemo(() => (me?.full_name ?? '').trim(), [me?.full_name]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, ownerFilter, sectorFilter, integrationFilter, kunyeFilter, fazFilter, pageSize]);

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
    }
  }

  async function loadStats() {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (ownerFilter) params.set('owner', ownerFilter);
    if (sectorFilter) params.set('sector', sectorFilter);
    if (integrationFilter) params.set('integration', integrationFilter);
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
      if (kunyeFilter) params.set('kunye_status', kunyeFilter);
      if (fazFilter) params.set('faz_no', fazFilter);

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
    void loadStats();
  }, [debouncedQ, ownerFilter, sectorFilter, integrationFilter, kunyeFilter, fazFilter]);

  useEffect(() => {
    void loadRows(page);
  }, [page, debouncedQ, ownerFilter, sectorFilter, integrationFilter, kunyeFilter, fazFilter, pageSize]);

  const ownerOptions = useMemo(
    () => uniqueOptions([...filterOptions.ownerOptions, ...allowed.map((u) => u.full_name), HAVUZ_ACCOUNT_NAME]),
    [allowed, filterOptions.ownerOptions]
  );

  const sectorOptions = useMemo(
    () =>
      uniqueOptions([
        ...SECTOR_PRESET_OPTIONS,
        ...filterOptions.sectorOptions,
        ...rows.map((r) => r.sektor),
        ...stats.bySector.map((r) => r.label),
      ]),
    [filterOptions.sectorOptions, rows, stats.bySector]
  );

  const integrationOptions = useMemo(
    () => uniqueOptions([...filterOptions.integrationOptions, ...rows.map((r) => r.entegrasyon_tipi)]),
    [filterOptions.integrationOptions, rows]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const phaseBuckets = useMemo(() => buildPhaseBuckets(stats.byPhase), [stats.byPhase]);
  const maxPhaseBucket = Math.max(1, ...phaseBuckets.map((item) => item.value));
  const topOwners = (stats.byOwner.length ? stats.byOwner : [{ label: 'Kayıt yok', value: 0 }]).slice(0, 6);
  const topSectors = (stats.bySector.length ? stats.bySector : [{ label: 'Tanımsız', value: 0 }]).slice(0, 7);
  const riskCount = stats.kunyeEksik + stats.kunyeYok;
  const sectorMax = Math.max(1, ...topSectors.map((item) => item.value));
  const ownerMax = Math.max(1, ...topOwners.map((item) => item.value));
  const completionRate = stats.total ? Math.round((stats.kunyeVar / Math.max(1, stats.total)) * 100) : 0;
  const riskRate = stats.total ? Math.round((riskCount / Math.max(1, stats.total)) * 100) : 0;
  const top3SectorShare = stats.total
    ? Math.round((topSectors.slice(0, 3).reduce((sum, item) => sum + item.value, 0) / Math.max(1, stats.total)) * 100)
    : 0;
  const accountShare = stats.total && topOwners[0]?.value
    ? Math.round((topOwners[0].value / Math.max(1, stats.total)) * 100)
    : 0;
  const kunyeDonutStyle = {
    background: `conic-gradient(#22c55e 0% ${completionRate}%, #f59e0b ${completionRate}% ${Math.min(100, completionRate + (stats.total ? Math.round((stats.kunyeEksik / Math.max(1, stats.total)) * 100) : 0))}%, #64748b ${Math.min(100, completionRate + (stats.total ? Math.round((stats.kunyeEksik / Math.max(1, stats.total)) * 100) : 0))}% 100%)`,
  } as React.CSSProperties;
  const accountSegments = topOwners.length
    ? (() => {
        const colors = ['#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8', '#0f172a', '#94a3b8'];
        let start = 0;
        const parts = topOwners.map((item, index) => {
          const pct = Math.round((item.value / Math.max(1, stats.total || 1)) * 100);
          const end = Math.min(100, start + pct);
          const part = `${colors[index % colors.length]} ${start}% ${end}%`;
          start = end;
          return part;
        });
        if (start < 100) parts.push(`#e2e8f0 ${start}% 100%`);
        return parts.join(', ');
      })()
    : '#e2e8f0 0% 100%';
  const accountDonutStyle = {
    background: `conic-gradient(${accountSegments})`,
  } as React.CSSProperties;
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
    if (integrationFilter) {
      tokens.push({
        key: 'integration',
        label: `Entegrasyon: ${integrationFilter}`,
        onClear: () => setIntegrationFilter(''),
      });
    }
    return tokens;
  }, [actionMode, currentAction.title, debouncedQ, ownerFilter, kunyeFilter, fazFilter, sectorFilter, integrationFilter]);

  const resetForm = () => {
    setEditingId(null);
    setMusteri('');
    setSektor('');
    setSorumlu(displayMeName || HAVUZ_ACCOUNT_NAME);
  };

  const openCreate = () => {
    setMode('create');
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: CrmRow) => {
    setMode('edit');
    setEditingId(row.musteri_id);
    setMusteri(row.musteri ?? '');
    setSektor(row.sektor ?? '');
    setSorumlu(row.sorumlu ?? displayMeName ?? HAVUZ_ACCOUNT_NAME);
    setMsg(null);
    setOpen(true);
  };

  async function saveCustomer() {
    setMsg(null);
    if (!musteri.trim()) return setMsg('Müşteri adı zorunlu.');
    if (!sorumlu.trim()) return setMsg('Sorumlu seçmek zorunlu.');

    setBusySave(true);
    try {
      const url = mode === 'create' ? '/api/crm/create' : '/api/crm/update';
      const body: Record<string, unknown> = {
        musteri: musteri.trim(),
        sektor: sektor.trim() || null,
        sorumlu: sorumlu.trim(),
      };
      if (mode === 'edit') body.musteriId = editingId;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.message || 'Kayıt sırasında hata oluştu.');
        return;
      }

      setOpen(false);
      resetForm();
      await Promise.all([loadRows(1), loadStats()]);
      setPage(1);
      setMsg(mode === 'create' ? 'Müşteri eklendi.' : (j?.message ?? 'Müşteri güncelleme talebi işlendi.'));
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
        .hero {
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
          display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 14px; align-items: center;
        }
        .donut-wrap { display: grid; gap: 10px; justify-items: center; }
        .donut {
          width: 96px; height: 96px; border-radius: 999px; position: relative;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
        }
        .donut::after {
          content: ''; position: absolute; inset: 16px; border-radius: 999px; background: rgba(15,23,42,.92);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        .donut-center {
          position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; text-align: center;
        }
        .donut-center strong { font-size: 22px; line-height: 1; font-weight: 900; }
        .donut-center span { font-size: 10px; color: rgba(255,255,255,.72); text-transform: uppercase; letter-spacing: .08em; }
        .split-stats { display: grid; gap: 8px; }
        .split-row {
          display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
          font-size: 12px; color: rgba(255,255,255,.84);
        }
        .split-dot { width: 8px; height: 8px; border-radius: 999px; }
        .split-bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
        .split-bar span { display:block; height:100%; border-radius:inherit; background: rgba(255,255,255,.82); }
        .micro-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .micro-card {
          min-height: 72px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.10);
          display: grid; align-content: space-between; gap: 8px;
        }
        .micro-card span { font-size: 11px; color: rgba(255,255,255,.7); text-transform: uppercase; letter-spacing: .06em; font-weight: 800; }
        .micro-card strong { font-size: 20px; line-height: 1; font-weight: 900; }
        .sector-bars, .owner-bars { display: grid; gap: 10px; }
        .bar-row {
          display: grid; grid-template-columns: minmax(104px, 132px) minmax(0, 1fr) auto; gap: 10px; align-items: center;
          font-size: 12px; color: rgba(255,255,255,.9);
        }
        .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
        .bar-track { height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
        .bar-track span { display:block; height:100%; border-radius:inherit; background: linear-gradient(90deg, rgba(191,219,254,.95), rgba(255,255,255,.75)); }
        .bar-value { font-size: 12px; font-weight: 900; color: #fff; }
        .owner-layout { display: grid; grid-template-columns: minmax(0, 1fr) 108px; gap: 14px; align-items: center; }
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

        .surface {
          border: 1px solid #dbe4ef; background: rgba(255,255,255,.96);
          border-radius: 24px; padding: 18px; box-shadow: 0 18px 40px rgba(15,23,42,.05);
        }
        .surface-tight { padding: 14px; }
        .section-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; margin-bottom: 16px;
        }
        .section-kicker {
          font-size: 12px; font-weight: 900; letter-spacing: .03em; text-transform: uppercase;
          color: #2563eb; margin-bottom: 6px;
        }
        .section-title { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; }
        .section-note { margin-top: 4px; color: #64748b; font-size: 13px; line-height: 1.5; }

        .primary, .secondary, .ghost, .phase-segment, .action-card {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 42px; border-radius: 14px; padding: 0 14px; font-weight: 800;
          cursor: pointer; transition: .18s ease; text-decoration: none;
        }
        .primary { border: 1px solid #0f172a; background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color: #fff; }
        .secondary { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.12); color: #fff; }
        .ghost { border: 1px solid #d5dee8; background: #f8fafc; color: #0f172a; }

        .command-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(290px, 0.95fr); gap: 18px; }
        .action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .action-card {
          align-items: flex-start; justify-content: flex-start; flex-direction: column;
          min-height: 132px; padding: 16px; border: 1px solid #e2e8f0; background: #fff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);
        }
        .action-card:hover { transform: translateY(-1px); box-shadow: 0 14px 26px rgba(15,23,42,0.06); }
        .action-card.active { border-color: #1d4ed8; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); }
        .action-card-top { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .action-icon {
          width: 40px; height: 40px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;
          background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe;
        }
        .action-value { font-size: 28px; line-height: 1; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; }
        .action-title { font-size: 15px; font-weight: 900; color: #0f172a; }
        .action-desc { margin-top: 6px; font-size: 12px; line-height: 1.5; color: #64748b; }

        .search-shell { display: grid; grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(180px, 1fr)); gap: 12px; }
        .field { display: grid; gap: 8px; }
        .field-label { font-size: 12px; font-weight: 900; color: #334155; }
        .input, .select {
          width: 100%; min-height: 46px; border-radius: 14px; border: 1px solid #d5dee8;
          padding: 0 14px; background: #fff; color: #0f172a; outline: none;
        }
        .search-input {
          display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 14px;
          border-radius: 14px; border: 1px solid #d5dee8; background: #fff;
        }
        .search-input input { flex: 1; min-width: 0; border: none; outline: none; padding: 0; background: transparent; }

        .phase-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
        .phase-segment {
          flex-direction: column; align-items: flex-start; justify-content: flex-start;
          min-height: 120px; padding: 16px; border: 1px solid #e2e8f0; background: #fff;
        }
        .phase-segment.active { outline: 2px solid rgba(37,99,235,0.18); border-color: #93c5fd; }
        .phase-segment-head {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 8px; margin-bottom: 14px;
        }
        .phase-segment-name { font-size: 15px; font-weight: 900; color: #0f172a; }
        .phase-segment-range { font-size: 12px; color: #64748b; }
        .phase-segment-value { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: #0f172a; line-height: 1; }
        .phase-progress { margin-top: auto; width: 100%; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.65); overflow: hidden; }
        .phase-progress span {
          display: block; height: 100%; border-radius: inherit;
          background: linear-gradient(90deg, rgba(15,23,42,.88), rgba(37,99,235,.72));
        }

        .advanced-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .result-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 14px 16px; border-radius: 18px; background: linear-gradient(180deg, #fbfcff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
        }
        .result-copy { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .result-metric { display: grid; gap: 2px; }
        .result-metric strong { font-size: 26px; line-height: 1; letter-spacing: -0.03em; }
        .result-metric span { font-size: 12px; color: #64748b; }
        .token-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .token {
          display: inline-flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 12px;
          border-radius: 999px; background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3;
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
          padding: 12px 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;
        }
        .mini-label, .sector-label { font-size: 13px; font-weight: 700; color: #0f172a; }
        .mini-value {
          min-width: 36px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
          padding: 0 10px; border-radius: 999px; background: #fff; border: 1px solid #dbe4ef;
          font-size: 12px; font-weight: 900; color: #0f172a;
        }
        .sector-value { font-size: 12px; font-weight: 900; color: #2563eb; }

        .table-wrap { overflow: auto; border: 1px solid #e2e8f0; border-radius: 18px; }
        table { width: 100%; min-width: 980px; border-collapse: collapse; background: white; }
        th {
          text-align: left; padding: 13px 14px; font-size: 11px; letter-spacing: .04em;
          text-transform: uppercase; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
        }
        td { padding: 14px; border-bottom: 1px solid #eef2f7; font-size: 13px; vertical-align: middle; color: #0f172a; }
        .name { color: #0f172a; font-weight: 900; text-decoration: none; }
        .muted { color: #64748b; font-size: 12px; margin-top: 6px; }
        .pill {
          display: inline-flex; align-items: center; justify-content: center; min-height: 30px;
          padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap;
        }
        .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .link-btn {
          display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 12px;
          border-radius: 12px; border: 1px solid #dbe4ef; background: #fff; color: #0f172a;
          font-size: 12px; font-weight: 900; text-decoration: none; cursor: pointer;
        }
        .pager {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          flex-wrap: wrap; margin-top: 14px;
        }
        .pager-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .message {
          font-size: 13px; color: #b91c1c; background: #fff1f2;
          padding: 12px 14px; border-radius: 14px; border: 1px solid #fecdd3;
        }

        .modal {
          position: fixed; inset: 0; background: rgba(15,23,42,.42); display: grid;
          place-items: center; padding: 20px; z-index: 100; backdrop-filter: blur(4px);
        }
        .modal-box {
          width: min(720px, 100%); display: grid; gap: 18px; border-radius: 24px; padding: 22px;
          background: white; border: 1px solid #dbe4ef; box-shadow: 0 32px 60px rgba(15,23,42,.18);
        }
        .title { font-size: 24px; line-height: 1.1; font-weight: 900; letter-spacing: -0.03em; color: #0f172a; }
        .sub { margin-top: 8px; color: #64748b; font-size: 13px; line-height: 1.55; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .label { font-size: 12px; font-weight: 900; color: #334155; }
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
          .hero, .command-grid, .search-shell { grid-template-columns: 1fr; }
          .action-grid, .advanced-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .phase-strip, .grid, .hero-summary, .action-grid, .advanced-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .hero, .surface, .modal-box { padding: 16px; border-radius: 20px; }
        }
      `}</style>

      <section className="hero">
        <div className="hero-copy" />

        <div className="hero-metrics">
          <div className="hero-summary">
            <div className="executive-card">
              <div className="executive-head">
                <div>
                  <div className="executive-kicker">Müşteri Durumu</div>
                  <div className="executive-value">{stats.total}</div>
                  <div className="executive-sub">Toplam portföy ve künye kalitesi tek bakışta görünür.</div>
                </div>
                <Building2 size={18} strokeWidth={1.6} />
              </div>

              <div className="executive-main">
                <div className="split-stats">
                  <div className="split-row tooltip-anchor" data-tip="Künye bilgisi tamam olan müşteri sayısı.">
                    <span className="split-dot" style={{ background: '#22c55e' }} />
                    <span>Tamam</span>
                    <strong>{stats.kunyeVar}</strong>
                  </div>
                  <div className="split-row tooltip-anchor" data-tip="Kısmen dolu, aksiyon gerektiren künye sayısı.">
                    <span className="split-dot" style={{ background: '#f59e0b' }} />
                    <span>Eksik</span>
                    <strong>{stats.kunyeEksik}</strong>
                  </div>
                  <div className="split-row tooltip-anchor" data-tip="Henüz künye bilgisi hiç girilmemiş müşteri sayısı.">
                    <span className="split-dot" style={{ background: '#94a3b8' }} />
                    <span>Yok</span>
                    <strong>{stats.kunyeYok}</strong>
                  </div>
                </div>
                <div className="donut-wrap tooltip-anchor" data-tip="Künye kalite dağılımı: tamam, eksik ve yok kırılımını gösterir.">
                  <div className="donut" style={kunyeDonutStyle}>
                    <div className="donut-center">
                      <div>
                        <strong>{completionRate}%</strong>
                        <span>Tamam</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="micro-cards">
                <div className="micro-card tooltip-anchor" data-tip="Eksik ve yok künye toplamının portföye oranı.">
                  <span>Risk oranı</span>
                  <strong>{riskRate}%</strong>
                </div>
                <div className="micro-card tooltip-anchor" data-tip="Künye bilgisi tamamen dolu müşteri oranı.">
                  <span>Tamamlanma</span>
                  <strong>{completionRate}%</strong>
                </div>
              </div>
            </div>

            <div className="executive-card is-risk">
              <div className="executive-head">
                <div>
                  <div className="executive-kicker">Sektör Dağılımı</div>
                  <div className="executive-value">{stats.sectors}</div>
                  <div className="executive-sub">Portföyün hangi sektörlerde yoğunlaştığını yatay kırılım ile izle.</div>
                </div>
                <Layers3 size={18} strokeWidth={1.6} />
              </div>

              <div className="sector-bars">
                {topSectors.map((item) => (
                  <div key={item.label} className="bar-row tooltip-anchor" data-tip={`${item.label}: ${item.value} müşteri`}>
                    <span className="bar-label">{item.label}</span>
                    <div className="bar-track"><span style={{ width: `${(item.value / sectorMax) * 100}%` }} /></div>
                    <span className="bar-value">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="micro-cards">
                <div className="micro-card tooltip-anchor" data-tip="Portföyde en yüksek müşteri adedine sahip sektör.">
                  <span>En büyük sektör</span>
                  <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{topSectors[0]?.label ?? '-'}</strong>
                </div>
                <div className="micro-card tooltip-anchor" data-tip="İlk üç sektörün toplam portföy içindeki payı.">
                  <span>İlk 3 payı</span>
                  <strong>{top3SectorShare}%</strong>
                </div>
              </div>
            </div>

            <div className="executive-card">
              <div className="executive-head">
                <div>
                  <div className="executive-kicker">Account Yapısı</div>
                  <div className="executive-value">{stats.accounts}</div>
                  <div className="executive-sub">Dağılımı, yükü ve öne çıkan account yapısını aynı kartta gör.</div>
                </div>
                <Users size={18} strokeWidth={1.6} />
              </div>

              <div className="owner-layout">
                <div className="owner-bars">
                  {topOwners.map((item) => (
                    <div key={item.label} className="bar-row tooltip-anchor" data-tip={`${item.label}: ${item.value} müşteri`} style={{ gridTemplateColumns: 'minmax(90px, 124px) minmax(0, 1fr) auto' }}>
                      <span className="bar-label">{item.label}</span>
                      <div className="bar-track"><span style={{ width: `${(item.value / ownerMax) * 100}%` }} /></div>
                      <span className="bar-value">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="donut-wrap tooltip-anchor" data-tip="Account sorumlularına göre müşteri yükü dağılımı.">
                  <div className="donut" style={accountDonutStyle}>
                    <div className="donut-center">
                      <div>
                        <strong>{stats.accounts}</strong>
                        <span>Account</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="micro-cards">
                <div className="micro-card tooltip-anchor" data-tip="En yüksek müşteri yükünü taşıyan account sahibi.">
                  <span>En büyük account</span>
                  <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{topOwners[0]?.label ?? '-'}</strong>
                </div>
                <div className="micro-card tooltip-anchor" data-tip="Lider account sahibinin toplam portföy içindeki payı.">
                  <span>Lider payı</span>
                  <strong>{accountShare}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="search-shell">
          <label className="field">
            <span className="field-label">Arama</span>
            <div className="search-input">
              <Search size={16} strokeWidth={1.7} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, sektör, account veya entegrasyon ara" />
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
                {total} müşteri · Sayfa {currentPage}/{totalPages}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {activeFilterTokens.length ? (
        <section className="result-bar">
          <div className="result-copy">
            <div className="result-metric">
              <strong>{total}</strong>
              <span>Sonuç kümesi</span>
            </div>
            <div className="section-note">Şu an görünüm, aksiyon modu ve filtrelerin birleşiminden oluşuyor.</div>
          </div>
          <div className="token-row">
            {activeFilterTokens.map((item) => (
              <span className="token" key={item.key}>
                {item.label}
                <button type="button" onClick={item.onClear}>×</button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="section-head">
          <div>
            <div className="section-kicker">Execution Layer</div>
            <div className="section-title">Müşteri listesi ve hızlı aksiyonlar</div>
            <div className="section-note">Karar yukarıda verilir, uygulama burada yapılır. Detay ve düzenleme aksiyonu sade tutuldu.</div>
          </div>
          <button className="primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={1.7} /> Müşteri ekle
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Müşteri Adı', 'Sektör', 'Account', 'Kasa Firması', 'Künye', 'Entegrasyon'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.musteri_id}>
                  <td>
                    <Link className="name" href={`/crm/${r.musteri_id}`}>{r.musteri}</Link>
                    <div className="muted">
                      {r.aktif_faz_no != null ? `FAZ ${r.aktif_faz_no}` : 'Faz bilgisi yok'}
                      {r.aktif_faz_adi ? ` · ${r.aktif_faz_adi}` : ''}
                    </div>
                  </td>
                  <td>{r.sektor ?? '-'}</td>
                  <td>{r.sorumlu ?? '-'}</td>
                  <td>{r.kasa_firmasi ?? '-'}</td>
                  <td>
                    <span className="pill" style={statusTone(r.kunye_durumu)}>
                      {presentKunyeStatus(r.kunye_durumu)}
                    </span>
                  </td>
                  <td>{r.entegrasyon_tipi ?? '-'}</td>
                </tr>
              ))}
              {!loading && !rows.length ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 18 }}>Kayıt bulunamadı.</td></tr>
              ) : null}
              {loading ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 18 }}>Yükleniyor...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <div className="section-note">Toplam {total} kayıt · Sayfa {currentPage} / {totalPages}</div>
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
                Müşteri oluştururken sorumlu doğrudan seçilir. Düzenleme ekranında sorumlu değişirse,
                superadmin/admin onayına düşer; diğer alanlar anında kaydolur.
              </div>
            </div>

            <div className="grid">
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Müşteri adı</span>
                <input className="input" value={musteri} onChange={(e) => setMusteri(e.target.value)} />
              </label>

              <label className="field">
                <span className="label">Sektör</span>
                <select className="select" value={sektor} onChange={(e) => setSektor(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {SECTOR_PRESET_OPTIONS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Sorumlusu</span>
                <select className="select" value={sorumlu} onChange={(e) => setSorumlu(e.target.value)}>
                  <option value="">Seçiniz</option>
                  {ownerOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
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
