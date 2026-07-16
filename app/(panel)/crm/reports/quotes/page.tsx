'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Summary = {
  totalQuotes: number;
  activeQuotes: number;
  closedQuotes: number;
  wonQuotes: number;
  lostQuotes: number;
  draftQuotes: number;
  overdueFollowups: number;
  expiringSoon: number;
  totalDevices: number;
  totalAmount: number;
  weightedAmount: number;
  wonRevenue: number;
  avgQuoteAmount: number;
  avgWonAmount: number;
  avgSalesCycleDays: number;
  winRate: number;
};

type SimpleRow = { label: string; value: number };

type OwnerRow = {
  owner: string;
  total: number;
  active: number;
  won: number;
  lost: number;
  draft: number;
  totalAmount: number;
  weightedAmount: number;
  winRate: number;
};

type CustomerRow = {
  customer: string;
  sector: string;
  total: number;
  won: number;
  revenue: number;
  devices: number;
};

type MonthlyRow = {
  month: string;
  total: number;
  active: number;
  won: number;
  lost: number;
  revenue: number;
  weighted: number;
};

type Payload = {
  ownerOptions: string[];
  summary: Summary;
  statusSummary: SimpleRow[];
  closeReasonSummary: SimpleRow[];
  agingBuckets: SimpleRow[];
  probabilityBands: SimpleRow[];
  ownerPerformance: OwnerRow[];
  topCustomers: CustomerRow[];
  monthlyTrend: MonthlyRow[];
  message?: string;
};

const EMPTY: Payload = {
  ownerOptions: [],
  summary: {
    totalQuotes: 0,
    activeQuotes: 0,
    closedQuotes: 0,
    wonQuotes: 0,
    lostQuotes: 0,
    draftQuotes: 0,
    overdueFollowups: 0,
    expiringSoon: 0,
    totalDevices: 0,
    totalAmount: 0,
    weightedAmount: 0,
    wonRevenue: 0,
    avgQuoteAmount: 0,
    avgWonAmount: 0,
    avgSalesCycleDays: 0,
    winRate: 0,
  },
  statusSummary: [],
  closeReasonSummary: [],
  agingBuckets: [],
  probabilityBands: [],
  ownerPerformance: [],
  topCustomers: [],
  monthlyTrend: [],
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function pct(value: number) {
  return `%${Number(value || 0).toFixed(1)}`;
}

export default function QuoteReportsPage() {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (owner) params.set('owner', owner);
      const res = await fetch(`/api/reports/quotes?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json?.message || 'Teklif raporu yüklenemedi.');
        setPayload(EMPTY);
        return;
      }
      setPayload({ ...EMPTY, ...json, summary: { ...EMPTY.summary, ...(json.summary ?? {}) } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [q, status, owner]);

  const summaryCards = useMemo(() => ([
    { label: 'Toplam Teklif', value: payload.summary.totalQuotes, hint: 'Seçili filtrelerdeki tüm teklif' },
    { label: 'Aktif Pipeline', value: payload.summary.activeQuotes, hint: 'Gönderilmiş ve açık kayıt' },
    { label: 'Kazanılan', value: payload.summary.wonQuotes, hint: `Win rate ${pct(payload.summary.winRate)}` },
    { label: 'Kaybedilen', value: payload.summary.lostQuotes, hint: 'Lost / expired / ilgi yok' },
    { label: 'Taslak', value: payload.summary.draftQuotes, hint: 'Hazırlık aşamasında' },
    { label: 'Toplam Cihaz', value: payload.summary.totalDevices, hint: 'Tekliflenen toplam adet' },
    { label: 'Toplam Tutar', value: money(payload.summary.totalAmount), hint: 'Brüt portföy büyüklüğü' },
    { label: 'Ağırlıklı Pipeline', value: money(payload.summary.weightedAmount), hint: 'Olasılıkla ağırlıklandırılmış' },
    { label: 'Won Revenue', value: money(payload.summary.wonRevenue), hint: 'Kazanılan teklif cirosu' },
    { label: 'Ort. Teklif', value: money(payload.summary.avgQuoteAmount), hint: 'Kayıt başı ortalama' },
    { label: 'Ort. Won Tutarı', value: money(payload.summary.avgWonAmount), hint: 'Kazanılan kayıt başı' },
    { label: 'Ort. Satış Süresi', value: `${Math.round(payload.summary.avgSalesCycleDays)} gün`, hint: 'Proposal → close' },
  ]), [payload.summary]);

  return (
    <main className="pax-page-container" style={{ display: 'grid', gap: 18 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Rapor Merkezi · Teklifler</span>
        <h1 className="pax-hero-title">Teklif KPI & Rapor Dashboard</h1>
        <p className="pax-hero-description">Teklif portföyünü yönetim bakışıyla izleyin: pipeline, kapanış kalitesi, satışçı performansı, müşteri yoğunluğu ve aylık trendler tek ekranda.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/crm/quotes" style={buttonGhost}>Teklif Portföyüne Dön</Link>
          <button onClick={load} style={buttonPrimary} disabled={loading}>{loading ? 'Yükleniyor...' : '↻ Yenile'}</button>
        </div>
      </div>

      <section style={surface}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr auto' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, teklif no, satışçı veya durum ara" style={inputStyle} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="sent">Aktif / Gönderildi</option>
            <option value="closed">Kapatılmış</option>
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
            <option value="">Tüm Satışçılar</option>
            {payload.ownerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button onClick={() => { setQ(''); setStatus(''); setOwner(''); }} style={buttonGhost}>Temizle</button>
        </div>
      </section>

      {message ? <div style={{ ...surface, color: '#b91c1c' }}>{message}</div> : null}

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={surfaceCard}>
            <div style={cardLabel}>{card.label}</div>
            <div style={cardValue}>{card.value}</div>
            <div style={cardHint}>{card.hint}</div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <MiniSummary title="Durum Dağılımı" rows={payload.statusSummary} />
        <MiniSummary title="Kapanış Nedenleri" rows={payload.closeReasonSummary} />
        <MiniSummary title="Takip Yaşlandırma" rows={payload.agingBuckets} />
        <MiniSummary title="Olasılık Bantları" rows={payload.probabilityBands} />
      </section>

      <section style={surface}>
        <SectionTitle title="Satışçı Performansı" subtitle="Hacim, aktif pipeline, kazanım, kayıp ve ağırlıklı potansiyel görünümü" />
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Satışçı', 'Toplam', 'Aktif', 'Won', 'Lost', 'Taslak', 'Win Rate', 'Toplam Tutar', 'Ağırlıklı Pipeline'].map((h) => <th key={h} style={tableHead}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payload.ownerPerformance.map((row) => (
                <tr key={row.owner} style={tableRow}>
                  <td style={tableCellStrong}>{row.owner}</td>
                  <td style={tableCell}>{row.total}</td>
                  <td style={tableCell}>{row.active}</td>
                  <td style={tableCell}>{row.won}</td>
                  <td style={tableCell}>{row.lost}</td>
                  <td style={tableCell}>{row.draft}</td>
                  <td style={tableCell}>{pct(row.winRate)}</td>
                  <td style={tableCell}>{money(row.totalAmount)}</td>
                  <td style={tableCell}>{money(row.weightedAmount)}</td>
                </tr>
              ))}
              {!payload.ownerPerformance.length ? <tr><td colSpan={9} style={emptyCell}>Kayıt yok.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: '1.2fr 1fr' }}>
        <div style={surface}>
          <SectionTitle title="Aylık Trend" subtitle="Son 12 ayda teklif akışı ve kazanılan ciro" />
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Ay', 'Toplam', 'Aktif', 'Won', 'Lost', 'Won Revenue', 'Ağırlıklı'].map((h) => <th key={h} style={tableHead}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {payload.monthlyTrend.map((row) => (
                  <tr key={row.month} style={tableRow}>
                    <td style={tableCellStrong}>{row.month}</td>
                    <td style={tableCell}>{row.total}</td>
                    <td style={tableCell}>{row.active}</td>
                    <td style={tableCell}>{row.won}</td>
                    <td style={tableCell}>{row.lost}</td>
                    <td style={tableCell}>{money(row.revenue)}</td>
                    <td style={tableCell}>{money(row.weighted)}</td>
                  </tr>
                ))}
                {!payload.monthlyTrend.length ? <tr><td colSpan={7} style={emptyCell}>Trend verisi yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={surface}>
          <SectionTitle title="Öne Çıkan Müşteriler" subtitle="Kazanılan ciroya göre ilk 10 müşteri" />
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Müşteri', 'Sektör', 'Teklif', 'Won', 'Cihaz', 'Revenue'].map((h) => <th key={h} style={tableHead}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {payload.topCustomers.map((row) => (
                  <tr key={`${row.customer}-${row.sector}`} style={tableRow}>
                    <td style={tableCellStrong}>{row.customer}</td>
                    <td style={tableCell}>{row.sector}</td>
                    <td style={tableCell}>{row.total}</td>
                    <td style={tableCell}>{row.won}</td>
                    <td style={tableCell}>{row.devices}</td>
                    <td style={tableCell}>{money(row.revenue)}</td>
                  </tr>
                ))}
                {!payload.topCustomers.length ? <tr><td colSpan={6} style={emptyCell}>Müşteri görünümü yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniSummary({ title, rows }: { title: string; rows: SimpleRow[] }) {
  return (
    <div style={surface}>
      <SectionTitle title={title} />
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-2)' }}>{row.label}</span>
            <strong style={{ fontSize: 18 }}>{row.value}</strong>
          </div>
        ))}
        {!rows.length ? <div style={{ color: 'var(--text-3)' }}>Veri yok.</div> : null}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{subtitle}</div> : null}
    </div>
  );
}

const surface: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  borderRadius: 20,
  padding: 16,
};

const surfaceCard: React.CSSProperties = {
  ...surface,
  padding: 18,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#fff',
  padding: '12px 14px',
  outline: 'none',
};

const buttonPrimary: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: 'linear-gradient(135deg,#4338ca,#6366f1)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

const buttonGhost: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#fff',
  color: 'var(--text)',
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
};

const cardValue: React.CSSProperties = {
  marginTop: 10,
  fontSize: 28,
  fontWeight: 900,
  color: 'var(--text)',
};

const cardHint: React.CSSProperties = {
  marginTop: 8,
  color: 'var(--text-3)',
  fontSize: 13,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 720,
};

const tableHead: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  borderBottom: '1px solid var(--border)',
};

const tableRow: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
};

const tableCell: React.CSSProperties = {
  padding: '12px',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
};

const tableCellStrong: React.CSSProperties = {
  ...tableCell,
  fontWeight: 800,
};

const emptyCell: React.CSSProperties = {
  padding: 16,
  color: 'var(--text-3)',
};
