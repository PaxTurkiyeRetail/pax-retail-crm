'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
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

function statusTone(status?: string | null) {
    if (status === 'Var') {
        return {
            background: '#ecfdf3',
            color: '#166534',
            border: '1px solid #bbf7d0',
        };
    }
    if (status === 'Eksik') {
        return {
            background: '#fff7ed',
            color: '#9a3412',
            border: '1px solid #fed7aa',
        };
    }
    return {
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #e2e8f0',
    };
}

function uniqueOptions(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((item) => String(item ?? '').trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b, 'tr'));
}

export default function CrmDashboardClient() {
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
        const meValue = meJson.me ?? null;
        setMe(meValue);

        if (usersRes.ok) {
            const usersJson = await usersRes.json().catch(() => ({}));
            setAllowed(
                (usersJson.users ?? []).filter(
                    (x: AllowedUser) => (x.full_name ?? '').trim().length > 0
                )
            );
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

        const statsRes = await fetch(`/api/crm/stats?${params.toString()}`, {
            cache: 'no-store',
        });

        if (statsRes.ok) {
            const statsJson = await statsRes.json().catch(() => ({}));
            setStats({ ...EMPTY_STATS, ...(statsJson ?? {}) });
        }
    }

    async function loadRows(nextPage = page) {
        setMsg(null);
        setLoading(true);

        try {
            const params = new URLSearchParams({
                page: String(nextPage),
                pageSize: String(pageSize),
            });

            if (debouncedQ) params.set('q', debouncedQ);
            if (ownerFilter) params.set('owner', ownerFilter);
            if (sectorFilter) params.set('sector', sectorFilter);
            if (integrationFilter) params.set('integration', integrationFilter);
            if (kunyeFilter) params.set('kunye_status', kunyeFilter);
            if (fazFilter) params.set('faz_no', fazFilter);

            const listRes = await fetch(`/api/crm/list?${params.toString()}`, {
                cache: 'no-store',
            });
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
        () =>
            uniqueOptions([
                ...filterOptions.ownerOptions,
                ...allowed.map((u) => u.full_name),
                HAVUZ_ACCOUNT_NAME,
            ]),
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
        () =>
            uniqueOptions([
                ...filterOptions.integrationOptions,
                ...rows.map((r) => r.entegrasyon_tipi),
            ]),
        [filterOptions.integrationOptions, rows]
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);

    const cards = [
        { label: 'Toplam Müşteri', value: stats.total, hint: 'Filtreye göre' },
        { label: 'Künye Tamam', value: stats.kunyeVar, hint: 'Hazır kayıt' },
        { label: 'Künye Eksik', value: stats.kunyeEksik, hint: 'Takip gerekli' },
        { label: 'Künye Yok', value: stats.kunyeYok, hint: 'Giriş bekliyor' },
    ];

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

            if (!res.ok) return setMsg(j?.message || 'Kayıt kaydedilemedi.');

            setOpen(false);
            setMsg(j?.message || 'Kayıt güncellendi.');
            await Promise.all([loadRows(currentPage), loadStats()]);
        } finally {
            setBusySave(false);
        }
    }

    const clearFilters = () => {
        setQ('');
        setOwnerFilter('');
        setSectorFilter('');
        setIntegrationFilter('');
        setKunyeFilter('');
        setFazFilter('');
        setPageSize(20);
    };

    return (
        <main className="crm-page">
            <style jsx>{`
        .crm-page {
          display: grid;
          gap: 16px;
        }

        .hero,
        .surface,
        .card,
        .modal-box {
          border: 1px solid #dbe4ef;
          background: rgba(255, 255, 255, 0.96);
          border-radius: 24px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }

        .hero,
        .surface {
          padding: 18px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: end;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(246, 249, 253, 0.94) 100%
          );
        }

        .eyebrow {
          display: inline-flex;
          min-height: 32px;
          align-items: center;
          padding: 0 12px;
          border-radius: 999px;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
          font-size: 12px;
          font-weight: 900;
        }

        .title {
          margin: 8px 0 0;
          color: #0f172a;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.03;
          font-weight: 950;
        }

        .sub {
          margin-top: 8px;
          color: #64748b;
          font-size: 14px;
          max-width: 780px;
        }

        .primary,
        .secondary,
        .ghost {
          min-height: 42px;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .primary {
          border: 1px solid #7f1d1d;
          background: linear-gradient(180deg, #1f2a44 0%, #111827 100%);
          color: #fff;
        }

        .secondary,
        .ghost {
          border: 1px solid #d7e0ea;
          background: #fff;
          color: #0f172a;
        }

        .dashboard {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
          gap: 16px;
          align-items: stretch;
        }

        .dashboard-grid,
        .filters-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .sector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field-label {
          color: #334155;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .input,
        .select {
          min-height: 42px;
          border-radius: 14px;
          border: 1px solid #cfd8e3;
          background: #fff;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          width: 100%;
        }

        .mini-list {
          display: grid;
          align-items: start;
        }

        .mini-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid #d7e0ea;
          border-radius: 16px;
          margin-top: 10px;
        }

        .mini-label {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .mini-value {
          color: #0f172a;
          font-size: 18px;
          font-weight: 900;
        }

        .card {
          padding: 14px 15px;
        }

        .card.compact {
          padding: 12px 14px;
          border-radius: 18px;
          min-height: 86px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .card-label {
          color: #64748b;
          font-size: 12px;
        }

        .card-value {
          margin-top: 6px;
          color: #0f172a;
          font-size: 22px;
          font-weight: 900;
        }

        .card-hint {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 12px;
        }

        .filter-actions,
        .section-head,
        .actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-actions {
          justify-content: flex-end;
          margin-top: 12px;
        }

        .section-head {
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .section-kicker {
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
        }

        .section-note {
          color: #64748b;
          font-size: 12px;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 920px;
        }

        th {
          text-align: left;
          font-size: 11px;
          color: #64748b;
          font-weight: 900;
          padding: 11px 12px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        td {
          padding: 11px 12px;
          border-bottom: 1px solid #eef2f7;
          font-size: 13px;
          color: #0f172a;
        }

        .name {
          font-weight: 900;
          color: #0f172a;
          text-decoration: none;
        }

        .muted {
          color: #64748b;
          font-size: 12px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .link-btn {
          min-height: 32px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid #d5dee8;
          background: #fff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }

        .pager {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pager-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .message {
          color: #166534;
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
          padding: 11px 13px;
          border-radius: 14px;
          font-size: 13px;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.38);
          display: grid;
          place-items: center;
          padding: 18px;
          z-index: 70;
        }

        .modal-box {
          width: min(640px, 100%);
          padding: 20px;
          display: grid;
          gap: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .label {
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }

        @media (max-width: 1320px) {
          .filters-grid,
          .dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .hero,
          .filters-grid,
          .grid,
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .sector-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

            <section className="hero">
                <div>
                    <span className="eyebrow">Kurumsal CRM</span>
                    <h1 className="title">Müşteri Dashboard</h1>
                    <div className="sub">
                        Kurumsal müşteri portföyünü, künye durumunu ve sorumlu dağılımını tek ekrandan yönetin.
                    </div>
                </div>
                <button className="primary" onClick={openCreate}>
                    + Müşteri Ekle
                </button>
            </section>

            <section className="surface">
                <div className="section-head">
                    <div>
                        <div className="section-kicker">Sektör Dağılımı</div>
                        <div className="section-note">Toplam sektör: {stats.sectors}</div>
                    </div>
                </div>

                <div className="sector-grid">
                    {(stats.bySector.length ? stats.bySector : [{ label: 'Tanımsız', value: 0 }])
                        .slice(0, 12)
                        .map((item) => (
                            <div key={item.label} className="card compact">
                                <div className="card-label">{item.label}</div>
                                <div className="card-value">{item.value}</div>
                            </div>
                        ))}
                </div>
            </section>

            <section className="dashboard">
                <div className="dashboard-grid">
                    {cards.map((item) => (
                        <div key={item.label} className="card">
                            <div className="card-label">{item.label}</div>
                            <div className="card-value">{item.value}</div>
                            <div className="card-hint">{item.hint}</div>
                        </div>
                    ))}
                </div>

                <div className="surface mini-list">
                    <div>
                        <div className="card-label">Accountlar</div>
                        {(stats.byOwner.length ? stats.byOwner : [{ label: 'Kayıt yok', value: 0 }])
                            .slice(0, 6)
                            .map((item) => (
                                <div key={item.label} className="mini-item">
                                    <span className="mini-label">{item.label}</span>
                                    <span className="mini-value">{item.value}</span>
                                </div>
                            ))}
                    </div>
                </div>
            </section>

            <section className="surface">
                <div className="filters-grid">
                    <label className="field">
                        <span className="field-label">Arama</span>
                        <input
                            className="input"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Müşteri, sektör, account, kasa firması veya entegrasyon yapısı"
                        />
                    </label>

                    <label className="field">
                        <span className="field-label">Müşteri Sorumlusu</span>
                        <select
                            className="select"
                            value={ownerFilter}
                            onChange={(e) => setOwnerFilter(e.target.value)}
                        >
                            <option value="">Tüm Sorumlular</option>
                            {ownerOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Sektör</span>
                        <select
                            className="select"
                            value={sectorFilter}
                            onChange={(e) => setSectorFilter(e.target.value)}
                        >
                            <option value="">Tüm Sektörler</option>
                            {sectorOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Entegrasyon Yapısı</span>
                        <select
                            className="select"
                            value={integrationFilter}
                            onChange={(e) => setIntegrationFilter(e.target.value)}
                        >
                            <option value="">Tüm Entegrasyonlar</option>
                            {integrationOptions.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Künye Durumu</span>
                        <select
                            className="select"
                            value={kunyeFilter}
                            onChange={(e) => setKunyeFilter(e.target.value)}
                        >
                            <option value="">Tüm Künye Durumları</option>
                            {['Var', 'Eksik', 'Yok'].map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Faz</span>
                        <select
                            className="select"
                            value={fazFilter}
                            onChange={(e) => setFazFilter(e.target.value)}
                        >
                            <option value="">Tüm Fazlar</option>
                            {filterOptions.phaseOptions.map((name) => (
                                <option key={name} value={name.replace('FAZ ', '')}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Sayfa Boyutu</span>
                        <select
                            className="select"
                            value={String(pageSize)}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size} / sayfa
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field-label">Görünüm</span>
                        <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
                            Filtrelenmiş müşteri sayısı:
                            <strong style={{ marginLeft: 6 }}>{total}</strong>
                        </div>
                    </label>
                </div>

                <div className="filter-actions">
                    <button className="secondary" onClick={clearFilters}>
                        Filtreyi Temizle
                    </button>
                </div>
            </section>

            {msg ? <div className="message">{msg}</div> : null}

            <section className="surface">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                {[
                                    'Müşteri Adı',
                                    'Sektör',
                                    'Account',
                                    'Kasa Firması',
                                    'Künye',
                                    'Entegrasyon Yapısı',
                                    'İşlem',
                                ].map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.musteri_id}>
                                    <td>
                                        <Link className="name" href={`/crm/${r.musteri_id}`}>
                                            {r.musteri}
                                        </Link>
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
                                            {r.kunye_durumu ?? 'Yok'}
                                        </span>
                                    </td>
                                    <td>{r.entegrasyon_tipi ?? '-'}</td>
                                    <td>
                                        <div className="actions">
                                            <Link className="link-btn" href={`/crm/${r.musteri_id}`}>
                                                Detay
                                            </Link>
                                            <button className="link-btn" onClick={() => openEdit(r)}>
                                                Düzenle
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!loading && !rows.length ? (
                                <tr>
                                    <td colSpan={7} className="muted" style={{ padding: 18 }}>
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            ) : null}

                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="muted" style={{ padding: 18 }}>
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                <div className="pager">
                    <div className="actions">
                        <span className="muted">
                            Toplam {total} kayıt · Sayfa {currentPage} / {totalPages}
                        </span>
                    </div>

                    <div className="pager-buttons">
                        <button
                            className="ghost"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Önceki
                        </button>
                        <button
                            className="ghost"
                            disabled={currentPage >= totalPages || loading}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Sonraki
                        </button>
                    </div>
                </div>
            </section>

            {open ? (
                <div className="modal" onClick={() => setOpen(false)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div>
                            <div className="title" style={{ fontSize: 24 }}>
                                {mode === 'create' ? 'Müşteri Ekle' : 'Müşteriyi Düzenle'}
                            </div>
                            <div className="sub">
                                Müşteri oluştururken sorumlu doğrudan seçilir. Düzenleme ekranında sorumlu
                                değişirse, superadmin/admin onayına düşer; diğer alanlar anında kaydolur.
                            </div>
                        </div>

                        <div className="grid">
                            <label className="field" style={{ gridColumn: '1 / -1' }}>
                                <span className="label">Müşteri Adı</span>
                                <input
                                    className="input"
                                    value={musteri}
                                    onChange={(e) => setMusteri(e.target.value)}
                                />
                            </label>

                            <label className="field">
                                <span className="label">Sektör</span>
                                <select
                                    className="select"
                                    value={sektor}
                                    onChange={(e) => setSektor(e.target.value)}
                                >
                                    <option value="">Seçiniz</option>
                                    {SECTOR_PRESET_OPTIONS.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="field">
                                <span className="label">Sorumlusu</span>
                                <select
                                    className="select"
                                    value={sorumlu}
                                    onChange={(e) => setSorumlu(e.target.value)}
                                >
                                    <option value="">Seçiniz</option>
                                    {ownerOptions.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {msg ? <div className="message">{msg}</div> : null}

                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                            <button className="secondary" onClick={() => setOpen(false)}>
                                Kapat
                            </button>
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