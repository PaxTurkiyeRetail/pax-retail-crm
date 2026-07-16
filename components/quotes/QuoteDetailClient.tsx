'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  items: Array<{
    id: string;
    product_id?: string | null;
    product_name_snapshot: string;
    product_code_snapshot: string;
    product_type: string;
    category: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    formatted_total_price: string;
    formatted_unit_price: string;
    billing_period: string;
    is_recurring: boolean;
  }>;
};

type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  product_type: 'device' | 'bundle' | 'recurring' | 'peripheral';
  is_recurring: boolean;
  billing_period: 'one_time' | 'monthly';
  description: string;
};

type Rule = { product_id: string; min_qty: number; max_qty: number | null; unit_price: number };
type EditItem = { uid: string; product_id: string; quantity: number };

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function resolveProductId(item: QuoteDetail['items'][number], products: Product[]) {
  const explicit = String(item.product_id ?? '').trim();
  if (explicit) return explicit;

  const byCode = products.find((product) => product.code === item.product_code_snapshot);
  if (byCode) return byCode.id;

  const byName = products.find((product) => product.name === item.product_name_snapshot);
  return byName?.id ?? '';
}

export default function QuoteDetailClient({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [closingReason, setClosingReason] = useState('won');
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [probabilities, setProbabilities] = useState<number[]>([10, 30, 60, 90]);
  const [editTitle, setEditTitle] = useState('');
  const [editProbability, setEditProbability] = useState(60);
  const [editNote, setEditNote] = useState('');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/quotes/detail?quoteId=${quoteId}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-store' },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(json?.message || 'Teklif bulunamadı.');
    else setQuote(json.quote ?? null);
    setLoading(false);
  };

  const loadOptions = async () => {
    const res = await fetch('/api/quotes/options', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setProducts(json.products ?? []);
      setRules(json.rules ?? []);
      setProbabilities(json.probabilities ?? [10, 30, 60, 90]);
    }
  };

  useEffect(() => { void load(); }, [quoteId]);
  useEffect(() => { void loadOptions(); }, []);

  useEffect(() => {
    if (!quote) return;
    setEditTitle(quote.opportunity_title ?? '');
    setEditProbability(Number(quote.probability ?? 60));
    setEditNote(quote.note ?? '');
    setEditItems(
      (quote.items ?? []).map((item) => ({
        uid: item.id || randomId(),
        product_id: resolveProductId(item, products),
        quantity: Number(item.quantity ?? 1) || 1,
      }))
    );
  }, [quote, products]);

  const health = useMemo(() => {
    if (!quote) return 'on_track';
    const today = new Date().toISOString().slice(0, 10);
    if (quote.follow_up_date && quote.follow_up_date < today && quote.status !== 'closed') return 'overdue';
    if (quote.valid_until && quote.valid_until < today && quote.status === 'sent') return 'expired';
    return 'on_track';
  }, [quote]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const rulesByProduct = useMemo(() => {
    const map = new Map<string, Rule[]>();
    rules.forEach((rule) => {
      const list = map.get(rule.product_id) ?? [];
      list.push(rule);
      map.set(rule.product_id, list);
    });
    return map;
  }, [rules]);

  const resolvedEditItems = useMemo(() => editItems.map((item) => {
    const product = productMap.get(item.product_id) ?? null;
    const productRules = rulesByProduct.get(item.product_id) ?? [];
    const rule = productRules.find((r) => item.quantity >= r.min_qty && (r.max_qty == null || item.quantity <= r.max_qty)) ?? null;
    return {
      ...item,
      product,
      rule,
      rule_label: rule ? `${rule.min_qty}${rule.max_qty ? `-${rule.max_qty}` : '+'}` : '-',
      unit_price: rule?.unit_price ?? 0,
      total_price: (rule?.unit_price ?? 0) * item.quantity,
    };
  }), [editItems, productMap, rulesByProduct]);

  const editTotals = useMemo(() => {
    let totalDevices = 0;
    let totalAmount = 0;
    let monthlyAmount = 0;
    resolvedEditItems.forEach((item) => {
      if (item.product?.product_type === 'device' || !item.product?.is_recurring) totalDevices += item.quantity;
      if (item.product?.is_recurring) monthlyAmount += item.total_price;
      else totalAmount += item.total_price;
    });
    return { totalDevices, totalAmount, monthlyAmount };
  }, [resolvedEditItems]);

  const editValid = Boolean(editTitle.trim() && editItems.length && editItems.every((item) => item.product_id && item.quantity > 0));

  async function updateStatus(status: 'sent' | 'closed') {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/quotes/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ quote_id: quoteId, status, closed_reason: status === 'closed' ? closingReason : null }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(json?.message || 'Durum güncellenemedi.');
      setBusy(false);
      return;
    }

    await load();
    router.refresh();
    setBusy(false);
  }

  async function saveEdit() {
    if (!editValid || busy) return;
    setBusy(true);
    setMsg(null);

    const res = await fetch('/api/quotes/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        quote_id: quoteId,
        opportunity_title: editTitle,
        probability: editProbability,
        note: editNote,
        items: editItems.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity) })),
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(json?.message || 'Teklif güncellenemedi.');
      setBusy(false);
      return;
    }

    setEditMode(false);
    await load();
    router.refresh();
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
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Cihaz</div><div className="pax-hero-stat-value">{quote.total_device_count ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Olasılık</div><div className="pax-hero-stat-value">%{quote.probability ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Satır</div><div className="pax-hero-stat-value">{quote.items?.length ?? 0}</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <Link href={`/api/quotes/${quote.id}/pdf`} target="_blank" style={{ ...ghostLink, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>PAX Teklif İndir</Link>
          <button disabled={busy || quote.status === 'closed'} onClick={() => setEditMode((value) => !value)} style={{ ...ghostButton, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>{editMode ? 'Düzenlemeyi Kapat' : 'Düzenle'}</button>
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

      {editMode ? (
        <section style={surface}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Teklifi Düzenle</div>
              <div style={{ color: 'var(--text-3)', marginTop: 4 }}>Ürün, adet, olasılık ve notları burada güncelleyebilirsin.</div>
            </div>
            <button disabled={!editValid || busy} onClick={() => void saveEdit()} style={primaryButton}>{busy ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</button>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Senaryo Başlığı</label>
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Olasılık</label>
                <select value={editProbability} onChange={(event) => setEditProbability(Number(event.target.value))} style={{ ...inputStyle, width: '100%' }}>
                  {probabilities.map((value) => <option key={value} value={value}>%{value}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>İç Not</label>
              <input value={editNote} onChange={(event) => setEditNote(event.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Teklif Satırları</strong>
                <button type="button" onClick={() => setEditItems((current) => [...current, { uid: randomId(), product_id: '', quantity: 1 }])} style={ghostButton}>+ Satır Ekle</button>
              </div>

              {resolvedEditItems.map((item, index) => (
                <div key={item.uid} style={{ display: 'grid', gridTemplateColumns: '2fr 130px 110px 130px auto', gap: 10, alignItems: 'end', border: '1px solid var(--border)', borderRadius: 16, padding: 12 }}>
                  <div>
                    <label style={labelStyle}>Ürün</label>
                    <select value={item.product_id} onChange={(event) => setEditItems((current) => current.map((row) => row.uid === item.uid ? { ...row, product_id: event.target.value } : row))} style={{ ...inputStyle, width: '100%' }}>
                      <option value="">Ürün seç...</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                    {item.product ? <div style={{ marginTop: 5, color: 'var(--text-3)', fontSize: 12 }}>{item.product.category} · {item.product.description}</div> : null}
                  </div>
                  <div>
                    <label style={labelStyle}>Adet</label>
                    <input type="number" min={1} value={item.quantity} onChange={(event) => setEditItems((current) => current.map((row) => row.uid === item.uid ? { ...row, quantity: Math.max(1, Number(event.target.value || 1)) } : row))} style={{ ...inputStyle, width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Barem</label>
                    <div style={readonlyBox}>{item.rule_label}</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Toplam</label>
                    <div style={readonlyBox}>{money(item.total_price)}{item.product?.is_recurring ? ' / ay' : ''}</div>
                  </div>
                  <button type="button" disabled={editItems.length <= 1} onClick={() => setEditItems((current) => current.filter((row) => row.uid !== item.uid))} style={{ ...ghostButton, color: '#991b1b' }}>Sil</button>
                  <div style={{ gridColumn: '1 / -1', color: 'var(--text-3)', fontSize: 12 }}>Satır {index + 1} · Birim fiyat: {money(item.unit_price)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <KpiCard label="Toplam cihaz" value={String(editTotals.totalDevices)} />
              <KpiCard label="Teklif tutarı" value={money(editTotals.totalAmount)} />
              <KpiCard label="Aylık hizmet" value={`${money(editTotals.monthlyAmount)} / ay`} />
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <div style={surfaceCard}><div style={miniTitle}>Durum</div><div style={{ ...bigValue, color: 'var(--text)' }}>{quote.status.toUpperCase()}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>{quote.closed_reason || 'Açık'}</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Probability</div><div style={bigValue}>%{quote.probability}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Weighted pipeline için kullanılır</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Toplam Cihaz</div><div style={bigValue}>{quote.total_device_count}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Recurring hariç</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Toplam Tutar</div><div style={bigValue}>{quote.formatted_total_amount}</div><div style={{ marginTop: 8, color: 'var(--text-3)' }}>Donanım {quote.formatted_hardware_amount} · Aylık {quote.formatted_monthly_amount}</div></div>
        <div style={surfaceCard}><div style={miniTitle}>Takip</div><div style={bigValue}>{formatDate(quote.follow_up_date)}</div><div style={{ marginTop: 8, color: health === 'overdue' ? 'var(--chip-red-color)' : 'var(--text-3)' }}>{health === 'overdue' ? 'Follow-up gecikti' : 'SLA aktif'}</div></div>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return <div style={surfaceCard}><div style={miniTitle}>{label}</div><div style={bigValue}>{value}</div></div>;
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const surfaceCard: CSSProperties = { ...surface, padding: 18 };
const miniTitle: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)' };
const bigValue: CSSProperties = { marginTop: 10, fontSize: 28, fontWeight: 900, color: '#312e81' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, border: '1px solid #4f46e5', background: '#4f46e5', color: 'var(--surface)', fontWeight: 800, cursor: 'pointer' };
const ghostButton: CSSProperties = { minHeight: 42, padding: '0 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' };
const ghostLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, textDecoration: 'none' };
const inputStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: '1px solid #cbd5e1', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase' };
const readonlyBox: CSSProperties = { minHeight: 42, display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid var(--border)', padding: '0 12px', background: 'var(--surface-2)', fontWeight: 800 };
const tableHead: CSSProperties = { textAlign: 'left', padding: '0 12px 10px', color: 'var(--text-3)', fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '14px 12px', verticalAlign: 'top', color: 'var(--text)' };
