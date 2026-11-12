'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';
import { rentalPeriodLabel } from '@/lib/quotes/line-pricing';
import { useEffect, useMemo, useState } from 'react';
import { FilterBar, ScopeLabel } from '@/components/filters/FilterBar';
import { useUrlFilters } from '@/lib/filters/use-url-filters';
import { resolvePeriod } from '@/lib/filters/period';
import type { FilterOption, PageFilterConfig } from '@/lib/filters/schema';
import { DEPARTMENT_LABELS, type Department } from '@/lib/departments';
import { resolveOwner } from '@/lib/reports/owner-filter';
import { formatDate } from '@/lib/utils';
import { useConfiguredPageSize } from '@/components/hooks/useConfiguredPageSize';
import { PAGE_SIZE_OPTIONS } from '@/lib/ui-pagination';

type QuoteRow = {
  id: string;
  quote_no: string;
  opportunity_title: string | null;
  proposal_date: string;
  valid_until: string;
  follow_up_date: string;
  probability: number;
  status: 'draft' | 'sent' | 'closed';
  closed_reason: string | null;
  owner_name: string | null;
  total_device_count: number;
  total_amount: number;
  weighted_amount: number;
  summary: string;
  health_state: 'on_track' | 'approaching' | 'overdue' | 'expired';
  loss_reason_key: string | null;
  /** Satışa dönüştüyse satış kaydı (güncel adet/tutar burada; teklif değişmez). */
  sale: { id: string; device_count: number; amount: number; status: 'active' | 'cancelled'; sale_date: string } | null;
  /** Kiralama satırı içeren teklif (08.09): rozet + dönem. */
  rental?: { lines: number; all: boolean; start: string | null; end: string | null } | null;
  customer: { musteri: string; sektor: string | null; sorumlu: string | null } | null;
};

type Kpis = {
  total_quotes: number;
  sent_quotes: number;
  closed_quotes: number;
  won_quotes: number;
  draft_quotes: number;
  overdue_followups: number;
  expiring_soon: number;
  total_devices: number;
  total_amount: number;
  weighted_amount: number;
  /** Satış kaydı özeti (crm_sales). */
  sale_quotes: number;
  cancelled_sales: number;
  sale_amount: number;
  sale_devices: number;
  conversion_pct: number | null;
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}


function healthLabel(state: QuoteRow['health_state']) {
  if (state === 'overdue') return 'Gecikti';
  if (state === 'approaching') return 'Yaklaşıyor';
  if (state === 'expired') return 'Süresi doldu';
  return 'Normal';
}

/**
 * Teklif durum rengi (Sinan, 07.09): satışa döndüyse YEŞİL, beklemedeyse TURUNCU,
 * süresi dolduysa/kaybedildiyse KIRMIZI, taslak nötr.
 */
function quoteState(row: QuoteRow): { key: 'sale' | 'waiting' | 'expired' | 'lost' | 'draft' | 'cancelled'; label: string } {
  if (row.status === 'closed' && row.closed_reason === 'won') {
    if (row.sale && row.sale.status === 'cancelled') return { key: 'cancelled', label: 'Satış iptal' };
    return { key: 'sale', label: 'Satışa döndü' };
  }
  if (row.status === 'closed') {
    if (row.closed_reason === 'expired') return { key: 'expired', label: 'Süresi doldu' };
    return { key: 'lost', label: row.closed_reason === 'no_interest' ? 'İlgilenmiyor' : 'Kaybedildi' };
  }
  if (row.status === 'draft') return { key: 'draft', label: 'Taslak' };
  if (row.health_state === 'expired' || row.health_state === 'overdue') return { key: 'expired', label: row.health_state === 'expired' ? 'Süresi doldu' : 'Takip gecikti' };
  return { key: 'waiting', label: 'Beklemede' };
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'draft', label: 'Taslak' },
  { value: 'sent', label: 'Gönderildi' },
  { value: 'closed', label: 'Kapatıldı' },
];

export default function QuotePortfolioClient({ ownerOptions, allowedDepartments }: { ownerOptions: FilterOption[]; allowedDepartments: Department[] | null }) {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  // Filtreler URL'de. Dönem seçilmezse tüm teklifler (anlık portföy); seçilirse teklif tarihi aralığı.
  const filterConfig = useMemo<PageFilterConfig>(() => ({
    keys: ownerOptions.length ? ['period', 'from', 'to', 'department', 'owner', 'status', 'q'] : ['period', 'from', 'to', 'department', 'status', 'q'],
    labels: { q: 'Ara' },
    options: { owner: ownerOptions, status: STATUS_OPTIONS },
  }), [ownerOptions]);
  const { values: filters } = useUrlFilters(filterConfig, { allowedDepartments });
  const period = filters.period ? resolvePeriod({ period: filters.period, from: filters.from, to: filters.to }) : null;
  const selectedOwner = resolveOwner(filters.owner, ownerOptions);
  const q = filters.q ?? '';
  const status = filters.status ?? '';
  const department = filters.department ?? '';
  const ownerId = selectedOwner?.id ?? '';
  const ownerName = selectedOwner?.name ?? '';
  const periodFrom = period?.from ?? '';
  const periodTo = period?.to ?? '';
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useConfiguredPageSize();
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMsg(null);
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (ownerId) params.set('owner_id', ownerId);
      if (ownerName) params.set('owner', ownerName);
      if (department) params.set('department', department);
      if (periodFrom) params.set('from', periodFrom);
      if (periodTo) params.set('to', periodTo);

      try {
        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/quotes/list?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/quotes/stats?${params.toString()}`, { cache: 'no-store' }),
        ]);
        const listJson = await listRes.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        if (!listRes.ok) {
          setMsg(listJson?.message || 'Teklifler alınamadı.');
          setRows([]);
        } else {
          setRows(listJson.rows ?? []);
          setTotal(Number(listJson.total ?? 0));
          setOnboarding(Boolean(listJson.onboardingNeeded || statsJson.onboardingNeeded));
        }
        if (statsRes.ok) setKpis(statsJson.kpis ?? null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [q, status, ownerId, ownerName, department, periodFrom, periodTo, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, status, ownerId, ownerName, department, periodFrom, periodTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const cards = [
    { label: 'Toplam Teklif', value: kpis?.total_quotes ?? 0, hint: 'Portföydeki tüm kayıtlar' },
    { label: 'Aktif Teklif', value: kpis?.sent_quotes ?? 0, hint: 'Müşteriyle paylaşılmış açık kayıt' },
    { label: 'Riskli Takip', value: kpis?.overdue_followups ?? 0, hint: 'Takip tarihi geçmiş' },
    { label: 'Yaklaşan Bitiş', value: kpis?.expiring_soon ?? 0, hint: '3 gün içinde süresi dolacak' },
    { label: 'Toplam Cihaz', value: kpis?.total_devices ?? 0, hint: 'Tekrarlayan ürünler hariç adet' },
    { label: 'Ağırlıklı Potansiyel', value: money(kpis?.weighted_amount ?? 0), hint: 'Olasılığa göre ağırlıklandırılmış' },
    { label: 'Satış Cirosu', value: money(kpis?.sale_amount ?? 0), hint: `${kpis?.sale_devices ?? 0} cihaz · aktif satış kayıtları` },
    { label: 'Teklif → Satış', value: kpis?.conversion_pct == null ? '—' : `%${kpis.conversion_pct}`, hint: kpis?.cancelled_sales ? `${kpis.cancelled_sales} satış iptal edildi` : 'Kapanan tekliflerin dönüşüm oranı' },
  ];

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <div className="pax-hero" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span className="pax-hero-eyebrow">Teklif Yönetimi</span>
          <h1 className="pax-hero-title">Teklif Portföyü</h1>
          <p className="pax-hero-description">Kimde hangi teklif var, kaç cihaz teklif edilmiş, hangi takip tarihi yaklaşıyor tek ekranda görün.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/crm/quotes/catalog" style={heroGhost}>Ürün ve fiyatlar</Link>
          <Link href="/crm/quotes/new" style={heroPrimary}>+ Yeni teklif</Link>
        </div>
      </div>
      <section style={{ display: 'grid', gap: 10 }}>
        {onboarding ? (
          <div style={{ ...surface, borderStyle: 'dashed', borderColor: 'var(--chip-indigo-bd)', background: 'var(--chip-indigo-bg)' }}>
            <strong>Teklif modülü için veritabanı kurulumu bekleniyor.</strong>
            <div style={{ marginTop: 6, color: '#4338ca' }}>Önce <code>sql/quote_module_setup.sql</code> dosyasını PostgreSQL SQL Editor’da çalıştırın.</div>
          </div>
        ) : null}

        <ScopeLabel
          mode={period ? 'period' : 'snapshot'}
          period={period?.label}
          department={department ? DEPARTMENT_LABELS[department] : undefined}
          owner={selectedOwner?.name}
        />
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          {cards.map((card) => (
            <div key={card.label} style={surfaceCard}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.label}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
              <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.35 }}>{card.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={surface}>
        <FilterBar
          config={filterConfig}
          allowedDepartments={allowedDepartments}
          showScope={false}
        />
      </section>

      <section style={surface}>
        {msg ? <div style={{ color: 'var(--chip-red-color)', marginBottom: 12 }}>{msg}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--text)' }}>
            Teklifler <span style={countBadge}>{total.toLocaleString('tr-TR')}</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Sayfa {currentPage} / {totalPages}</span>
            <select aria-label="Sayfa boyutu" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} style={inputStyle}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} / sayfa</option>)}
            </select>
            <button type="button" style={ghostButton} disabled={currentPage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button>
            <button type="button" style={ghostButton} disabled={currentPage >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                {['Teklif', 'Müşteri', 'Satışçı', 'Olasılık', 'Cihaz / Tutar', 'Geçerlilik', 'Takip', 'Durum'].map((head) => (
                  <th key={head} style={tableHead}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && !rows.length ? (
                <tr><td colSpan={8} style={{ padding: 20, color: 'var(--text-3)' }}>Kayıt bulunamadı.</td></tr>
              ) : null}
              {rows.map((row) => {
                const state = quoteState(row);
                return (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)', background: quoteStateRow[state.key] ?? 'transparent' }}>
                  <td style={{ ...tableCell, boxShadow: `inset 3px 0 0 ${quoteStateAccent[state.key] ?? 'transparent'}` }}>
                    <Link href={`/crm/quotes/${row.id}`} style={{ color: 'var(--text)', fontWeight: 800, textDecoration: 'none' }}>{row.quote_no}</Link>
                    <div style={subLine}>{row.opportunity_title || row.summary || 'Ticari teklif'}</div>
                  </td>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 700 }}>{row.customer?.musteri || '—'}</div>
                    {row.customer?.sektor ? <div style={subLine}>{row.customer.sektor}</div> : null}
                  </td>
                  <td style={tableCell}>{row.owner_name || '—'}</td>
                  <td style={tableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: '0 0 54px', height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${row.probability}%`, height: '100%', borderRadius: 999, background: row.probability >= 70 ? '#16a34a' : row.probability >= 40 ? '#d97706' : 'var(--chip-indigo-color)' }} /></div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>%{row.probability}</div>
                    </div>
                  </td>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(row.total_amount)}</div>
                    <div style={subLine}>{row.total_device_count.toLocaleString('tr-TR')} cihaz</div>
                    {row.rental ? (
                      <div style={{ marginTop: 6 }} title={`${row.rental.lines} kiralama satırı`}>
                        <span style={{ ...pillBase, minHeight: 22, fontSize: 11, background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', borderColor: 'var(--chip-gold-bd)' }}>{row.rental.all ? 'Kiralama' : 'Satış + Kiralama'}</span>
                        {row.rental.start && row.rental.end ? <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{rentalPeriodLabel(row.rental.start, row.rental.end)}</div> : null}
                      </div>
                    ) : null}
                    {row.sale && row.sale.status === 'active' && (row.sale.device_count !== row.total_device_count || Math.round(row.sale.amount) !== Math.round(row.total_amount)) ? (
                      <div style={{ marginTop: 4, color: 'var(--chip-green-color)', fontSize: 12, fontWeight: 700 }}>
                        satış: {row.sale.device_count} cihaz · {money(row.sale.amount)}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...tableCell, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDate(row.valid_until)}</td>
                  <td style={{ ...tableCell, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatDate(row.follow_up_date)}
                    {row.health_state !== 'on_track' ? (
                      <div style={{ marginTop: 4 }}><span style={{ ...pillBase, minHeight: 20, fontSize: 10.5, ...(riskPill[row.health_state] ?? riskPill.on_track) }}>{healthLabel(row.health_state)}</span></div>
                    ) : null}
                  </td>
                  <td style={tableCell}>
                    <span style={{ ...pillBase, ...(quoteStatePill[state.key] ?? quoteStatePill.draft) }}>{state.label}</span>
                    {state.key === 'sale' ? (
                      <Link href="/crm/sales" title="Satışlar ekranında aç" style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--chip-green-color)', textDecoration: 'none' }}>Satış →</Link>
                    ) : null}
                    {row.loss_reason_key && (state.key === 'lost' || state.key === 'expired') ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{lossLabel(row.loss_reason_key)}</div>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const surfaceCard: CSSProperties = { ...surface, padding: '12px 14px', borderRadius: 16 };
const subLine: CSSProperties = { marginTop: 2, color: 'var(--text-3)', fontSize: 12 };
const countBadge: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0, padding: '3px 9px', borderRadius: 999, background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)' };
const heroGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.10)', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13 };
const heroPrimary: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 16px', borderRadius: 12, background: '#fff', color: '#0b2456', textDecoration: 'none', fontWeight: 700, fontSize: 13, boxShadow: '0 8px 18px rgba(0,0,0,.18)' };
const ghostButton: CSSProperties = { minHeight: 34, padding: '0 12px', borderRadius: 10, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const inputStyle: CSSProperties = { minHeight: 34, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 };
const tableHead: CSSProperties = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-2)', fontWeight: 700, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '9px 12px', verticalAlign: 'middle', color: 'var(--text)', fontSize: 13 };
const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 10px', borderRadius: 999, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', border: '1px solid transparent' };
const riskPill: Record<string, CSSProperties> = {
  on_track: { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: '#a7f3d0' },
  approaching: { background: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' },
  overdue: { background: '#fef2f2', color: 'var(--chip-red-color)', borderColor: '#fecaca' },
  expired: { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: '#cbd5e1' },
};
/** Kayıp nedeni anahtarı → okunur etiket (Liste Yönetimleri'ndeki varsayılanlar). */
function lossLabel(key: string) {
  const map: Record<string, string> = {
    price: 'Fiyat', competitor: 'Rakip kazandı', no_budget: 'Bütçe yok / ertelendi', timing: 'Zamanlama',
    technical: 'Teknik uyumsuzluk', no_decision: 'Karar alınmadı', integration: 'Entegrasyon engeli', other: 'Diğer',
  };
  return map[key] ?? key;
}

/** Satır zemini/aksanı: satışa döndü yeşil · beklemede turuncu · süresi doldu / kayıp kırmızı (07.09 isteği). */
const quoteStateRow: Record<string, string> = {
  sale: 'color-mix(in srgb, var(--chip-green-bg) 45%, transparent)', waiting: 'transparent', expired: 'color-mix(in srgb, var(--chip-red-bg) 45%, transparent)',
  lost: 'transparent', cancelled: 'transparent', draft: 'transparent',
};
const quoteStateAccent: Record<string, string> = {
  sale: 'var(--chip-green-color)', waiting: '#d97706', expired: 'var(--chip-red-color)',
  lost: 'var(--chip-red-color)', cancelled: 'var(--border)', draft: 'var(--chip-indigo-color)',
};

const quoteStatePill: Record<string, CSSProperties> = {
  sale: { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: 'var(--chip-green-bd)' },
  waiting: { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', borderColor: 'var(--chip-gold-bd)' },
  expired: { background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', borderColor: 'var(--chip-red-bd)' },
  lost: { background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', borderColor: 'var(--chip-red-bd)' },
  cancelled: { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' },
  draft: { background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)', borderColor: 'var(--chip-indigo-bd)' },
};

