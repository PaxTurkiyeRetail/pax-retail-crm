'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

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
  customer: { musteri: string; sektor: string | null; sorumlu: string | null } | null;
};

type Kpis = {
  total_quotes: number;
  sent_quotes: number;
  closed_quotes: number;
  overdue_followups: number;
  expiring_soon: number;
  total_devices: number;
  total_amount: number;
  weighted_amount: number;
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

function statusLabel(state: QuoteRow['status']) {
  if (state === 'sent') return 'Gönderildi';
  if (state === 'closed') return 'Kapatıldı';
  return 'Taslak';
}

export default function QuotePortfolioClient() {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
      if (owner) params.set('owner', owner);

      try {
        const [listRes, statsRes] = await Promise.all([
          fetch(`/api/quotes/list?${params.toString()}`, { cache: 'no-store' }),
          fetch('/api/quotes/stats', { cache: 'no-store' }),
        ]);
        const listJson = await listRes.json().catch(() => ({}));
        const statsJson = await statsRes.json().catch(() => ({}));
        if (!listRes.ok) {
          setMsg(listJson?.message || 'Teklifler alınamadı.');
          setRows([]);
        } else {
          setRows(listJson.rows ?? []);
          setTotal(Number(listJson.total ?? 0));
          setOwnerOptions(Array.isArray(listJson.ownerOptions) ? listJson.ownerOptions : []);
          setOnboarding(Boolean(listJson.onboardingNeeded || statsJson.onboardingNeeded));
        }
        if (statsRes.ok) setKpis(statsJson.kpis ?? null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [q, status, owner, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, status, owner, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const cards = [
    { label: 'Toplam Teklif', value: kpis?.total_quotes ?? 0, hint: 'Portföydeki tüm kayıtlar' },
    { label: 'Aktif Teklif', value: kpis?.sent_quotes ?? 0, hint: 'Müşteriyle paylaşılmış açık kayıt' },
    { label: 'Riskli Takip', value: kpis?.overdue_followups ?? 0, hint: 'Takip tarihi geçmiş' },
    { label: 'Yaklaşan Bitiş', value: kpis?.expiring_soon ?? 0, hint: '3 gün içinde süresi dolacak' },
    { label: 'Toplam Cihaz', value: kpis?.total_devices ?? 0, hint: 'Tekrarlayan ürünler hariç adet' },
    { label: 'Ağırlıklı Potansiyel', value: money(kpis?.weighted_amount ?? 0), hint: 'Olasılığa göre ağırlıklandırılmış' },
  ];

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Teklif Yönetimi</span>
        <h1 className="pax-hero-title">Teklif Portföyü</h1>
        <p className="pax-hero-description">Kimde hangi teklif var, kaç cihaz teklif edilmiş, hangi takip tarihi yaklaşıyor tek ekranda görün.</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Toplam Teklif</div><div className="pax-hero-stat-value">{kpis?.total_quotes ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Aktif Teklif</div><div className="pax-hero-stat-value">{kpis?.sent_quotes ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Kazanılan</div><div className="pax-hero-stat-value">{kpis?.won_quotes ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Taslak</div><div className="pax-hero-stat-value">{kpis?.draft_quotes ?? 0}</div></div>
        </div>
      </div>
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link href="/crm/quotes/catalog" style={ghostButton}>Ürün & Fiyat Yönetimi</Link>
          <Link href="/crm/quotes/new" style={primaryButton}>Yeni Teklif Oluştur</Link>
        </div>

        {onboarding ? (
          <div style={{ ...surface, borderStyle: 'dashed', borderColor: 'var(--chip-indigo-bd)', background: 'var(--chip-indigo-bg)' }}>
            <strong>Teklif modülü için veritabanı kurulumu bekleniyor.</strong>
            <div style={{ marginTop: 6, color: '#4338ca' }}>Önce <code>sql/quote_module_setup.sql</code> dosyasını PostgreSQL SQL Editor’da çalıştırın.</div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          {cards.map((card) => (
            <div key={card.label} style={surfaceCard}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{card.label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>{card.value}</div>
              <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 13 }}>{card.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={surface}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr auto' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, teklif no, model veya satışçı ara" style={inputStyle} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="sent">Gönderildi</option>
            <option value="closed">Kapatıldı</option>
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
            <option value="">Tüm Satışçılar</option>
            {ownerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} style={inputStyle}>
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / sayfa</option>)}
          </select>
          <button onClick={() => { setQ(''); setStatus(''); setOwner(''); setPage(1); }} style={ghostButton}>Temizle</button>
        </div>
      </section>

      <section style={surface}>
        {msg ? <div style={{ color: 'var(--chip-red-color)', marginBottom: 12 }}>{msg}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Toplam {total} kayıt · Sayfa {currentPage}/{totalPages}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={ghostButton} disabled={currentPage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button>
            <button type="button" style={ghostButton} disabled={currentPage >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr>
                {['Teklif', 'Müşteri', 'Satışçı', 'Olasılık', 'Cihaz / Tutar', 'Geçerlilik', 'Takip', 'Risk', 'Durum'].map((head) => (
                  <th key={head} style={tableHead}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && !rows.length ? (
                <tr><td colSpan={9} style={{ padding: 20, color: 'var(--text-3)' }}>Kayıt bulunamadı.</td></tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tableCell}>
                    <Link href={`/crm/quotes/${row.id}`} style={{ color: 'var(--text)', fontWeight: 800, textDecoration: 'none' }}>{row.quote_no}</Link>
                    <div style={{ marginTop: 4, color: 'var(--text-2)', fontSize: 13 }}>{row.opportunity_title || row.summary || 'Ticari teklif'}</div>
                  </td>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 700 }}>{row.customer?.musteri || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{row.customer?.sektor || '-'}</div>
                  </td>
                  <td style={tableCell}>{row.owner_name || '-'}</td>
                  <td style={tableCell}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${row.probability}%`, height: '100%', background: '#4f46e5' }} /></div>
                      <div style={{ fontWeight: 800, color: '#312e81' }}>%{row.probability}</div>
                    </div>
                  </td>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 800 }}>{row.total_device_count} cihaz</div>
                    <div style={{ marginTop: 4, color: 'var(--text)' }}>{money(row.total_amount)}</div>
                  </td>
                  <td style={tableCell}>{formatDate(row.valid_until)}</td>
                  <td style={tableCell}>{formatDate(row.follow_up_date)}</td>
                  <td style={tableCell}><span style={{ ...pillBase, ...(riskPill[row.health_state] ?? riskPill.on_track) }}>{healthLabel(row.health_state)}</span></td>
                  <td style={tableCell}><span style={{ ...pillBase, ...(statusPill[row.status] ?? statusPill.draft) }}>{statusLabel(row.status)}{row.closed_reason ? ` · ${row.closed_reason}` : ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const surfaceCard: CSSProperties = { ...surface, padding: 18 };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, background: '#4f46e5', color: 'var(--surface)', textDecoration: 'none', fontWeight: 800 };
const ghostButton: CSSProperties = { minHeight: 42, padding: '0 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const inputStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: '1px solid #cbd5e1', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14 };
const tableHead: CSSProperties = { textAlign: 'left', padding: '0 12px 10px', color: 'var(--text-3)', fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '14px 12px', verticalAlign: 'top', color: 'var(--text)' };
const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 10px', borderRadius: 999, fontWeight: 800, fontSize: 12, border: '1px solid transparent' };
const riskPill: Record<string, CSSProperties> = {
  on_track: { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: '#a7f3d0' },
  approaching: { background: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' },
  overdue: { background: '#fef2f2', color: 'var(--chip-red-color)', borderColor: '#fecaca' },
  expired: { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: '#cbd5e1' },
};
const statusPill: Record<string, CSSProperties> = {
  draft: { background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)', borderColor: 'var(--chip-indigo-bd)' },
  sent: { background: 'var(--chip-indigo-bg)', color: '#4338ca', borderColor: 'var(--chip-indigo-bd)' },
  closed: { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: '#cbd5e1' },
};
