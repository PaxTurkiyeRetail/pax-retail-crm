'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

type QuoteDetail = {
  id: string;
  quote_no: string;
  proposal_date: string;
  valid_until: string;
  follow_up_date: string;
  status: 'draft' | 'sent' | 'closed';
  closed_reason: string | null;
  probability: number;
  opportunity_title: string | null;
  owner_name: string | null;
  total_amount: number;
  total_device_count: number;
  monthly_amount: number;
  hardware_amount: number;
  formatted_total_amount: string;
  formatted_hardware_amount: string;
  formatted_monthly_amount: string;
  note: string | null;
  customer: { id: string; musteri: string; sektor: string | null; sorumlu: string | null; entegrasyon_tipi: string | null } | null;
  items: Array<{ id: string; product_name_snapshot: string; product_code_snapshot: string; product_type: string; category: string; quantity: number; unit_price: number; total_price: number; formatted_total_price: string; formatted_unit_price: string; billing_period: string; is_recurring: boolean }>;
};


export default function QuoteDetailClient({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [closingReason, setClosingReason] = useState('won');
  const [busy, setBusy] = useState(false);

  const health = useMemo(() => {
    if (!quote) return 'on_track';
    const today = new Date().toISOString().slice(0, 10);
    if (quote.follow_up_date && quote.follow_up_date < today && quote.status !== 'closed') return 'overdue';
    if (quote.valid_until && quote.valid_until < today && quote.status === 'sent') return 'expired';
    return 'on_track';
  }, [quote]);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/quotes/detail?quoteId=${quoteId}`, { next: { revalidate: 60 } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(json?.message || 'Teklif bulunamadı.');
    else setQuote(json.quote ?? null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [quoteId]);

  async function updateStatus(status: 'sent' | 'closed') {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/quotes/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quote_id: quoteId, status, closed_reason: status === 'closed' ? closingReason : null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(json?.message || 'Durum güncellenemedi.');
    await load();
    setBusy(false);
  }

  if (loading) return <div style={surface}>Yükleniyor...</div>;
  if (!quote) return <div style={surface}>{msg || 'Kayıt bulunamadı.'}</div>;

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Teklif Detayı</span>
        <h1 className="pax-hero-title">{quote.quote_no}</h1>
        <p className="pax-hero-description">{quote.opportunity_title || 'Teklif kaydı'} · {quote.customer?.musteri || '-'}</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Durum</div><div className="pax-hero-stat-value" style={{ fontSize: 16, paddingTop: 8 }}>{quote.status}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Cihaz</div><div className="pax-hero-stat-value">{quote.total_devices ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Olasılık</div><div className="pax-hero-stat-value">%{quote.probability ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Satır</div><div className="pax-hero-stat-value">{quote.items?.length ?? 0}</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <Link href={`/crm/quotes/${quote.id}/print`} target="_blank" style={{ ...ghostLink, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Print / PDF</Link>
          {quote.status === 'draft' ? <button disabled={busy} onClick={() => void updateStatus('sent')} style={{ ...primaryButton, background: 'white', color: '#1e3a8a', border: 'none' }}>{busy ? 'İşleniyor...' : 'Sent yap + aktivite aç'}</button> : null}
          {quote.status !== 'closed' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={closingReason} onChange={(e) => setClosingReason(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 10 }}>
                <option value="won">won</option>
                <option value="lost">lost</option>
                <option value="expired">expired</option>
                <option value="no_interest">no_interest</option>
              </select>
              <button disabled={busy} onClick={() => void updateStatus('closed')} style={{ ...ghostButton, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Close</button>
            </div>
          ) : null}
        </div>
      </div>

      {msg ? <div style={{ ...surface, color: 'var(--chip-red-color)' }}>{msg}</div> : null}

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <div style={surfaceCard}><div style={miniTitle}>Durum</div><div style={{ ...bigValue, color: 'var(--text)' }}>{quote.status.toUpperCase()}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>{quote.closed_reason || 'Açık'}</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Probability</div><div style={bigValue}>%{quote.probability}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Weighted pipeline için kullanılır</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Toplam Cihaz</div><div style={bigValue}>{quote.total_device_count}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Recurring hariç</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Toplam Tutar</div><div style={bigValue}>{quote.formatted_total_amount}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Donanım {quote.formatted_hardware_amount} · Aylık {quote.formatted_monthly_amount}</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Takip</div><div style={bigValue}>{formatDate(quote.follow_up_date)}</div><div style={{ marginTop: 8, color: health === 'overdue' ? 'var(--chip-red-color)' : 'var(--text-3)' }}>{health === 'overdue' ? 'Follow‑up gecikti' : 'SLA aktif'}</div></div>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div style={surface}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Müşteri ve teklif meta</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <MetaRow label="Müşteri" value={quote.customer?.musteri || '-'} />
            <MetaRow label="Sektör" value={quote.customer?.sektor || '-'} />
            <MetaRow label="Sorumlu" value={quote.customer?.sorumlu || '-'} />
            <MetaRow label="Entegrasyon" value={quote.customer?.entegrasyon_tipi || '-'} />
            <MetaRow label="Teklif tarihi" value={formatDate(quote.proposal_date)} />
            <MetaRow label="Geçerlilik" value={formatDate(quote.valid_until)} />
            <MetaRow label="Satışçı" value={quote.owner_name || '-'} />
            <MetaRow label="İç not" value={quote.note || '-'} />
          </div>
        </div>
        <div style={surface}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Ürün özeti</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {quote.items.map((item) => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 12 }}>
                <div style={{ fontWeight: 800 }}>{item.product_name_snapshot}</div>
                <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{item.quantity} adet · {item.formatted_unit_price} / birim · {item.formatted_total_price}{item.is_recurring ? ' / ay' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={surface}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Satır detayları</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{['Ürün', 'Tip', 'Kategori', 'Adet', 'Birim', 'Toplam'].map((head) => <th key={head} style={tableHead}>{head}</th>)}</tr></thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tableCell}><div style={{ fontWeight: 800 }}>{item.product_name_snapshot}</div><div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 12 }}>{item.product_code_snapshot}</div></td>
                  <td style={tableCell}>{item.product_type}</td>
                  <td style={tableCell}>{item.category}</td>
                  <td style={tableCell}>{item.quantity}</td>
                  <td style={tableCell}>{item.formatted_unit_price}</td>
                  <td style={tableCell}>{item.formatted_total_price}{item.is_recurring ? ' / ay' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-3)' }}>{label}</span><strong style={{ color: 'var(--text)', textAlign: 'right' }}>{value}</strong></div>;
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const surfaceCard: CSSProperties = { ...surface, padding: 18 };
const miniTitle: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)' };
const bigValue: CSSProperties = { marginTop: 10, fontSize: 28, fontWeight: 900, color: '#312e81' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, border: '1px solid #4f46e5', background: '#4f46e5', color: 'var(--surface)', fontWeight: 800, cursor: 'pointer' };
const ghostButton: CSSProperties = { minHeight: 42, padding: '0 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' };
const ghostLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, textDecoration: 'none' };
const inputStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: '1px solid #cbd5e1', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)' };
const tableHead: CSSProperties = { textAlign: 'left', padding: '0 12px 10px', color: 'var(--text-3)', fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '14px 12px', verticalAlign: 'top', color: 'var(--text)' };
