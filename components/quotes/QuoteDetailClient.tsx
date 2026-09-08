'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { priceLine, rentalPeriodLabel, sumLineTotals, type SaleType } from '@/lib/quotes/line-pricing';
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
    /** Kiralama satırı (08.09): tarihli, aylık kira bedeli elle. */
    sale_type?: 'sale' | 'rental' | null;
    rental_start_date?: string | null;
    rental_end_date?: string | null;
    rental_monthly_price?: number | null;
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
type EditItem = {
  uid: string; product_id: string; quantity: number;
  sale_type: SaleType; rental_start_date: string; rental_end_date: string; rental_monthly_price: string;
};
const emptyEditLine = (): EditItem => ({ uid: randomId(), product_id: '', quantity: 1, sale_type: 'sale', rental_start_date: '', rental_end_date: '', rental_monthly_price: '' });
function isoPlusMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

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
  // Kapatma penceresi (07.09): Türkçe, iki net yol — Satışa Dönüştür / Kaybedildi.
  const [closeMode, setCloseMode] = useState<null | 'won' | 'lost'>(null);
  const [closedReasonKind, setClosedReasonKind] = useState<'lost' | 'expired' | 'no_interest'>('lost');
  const [lossReasonKey, setLossReasonKey] = useState('');
  const [lossReasons, setLossReasons] = useState<Array<{ key: string; label: string }>>([]);
  const [closeNote, setCloseNote] = useState('');
  const [movePhase, setMovePhase] = useState(true);
  const [saleInfo, setSaleInfo] = useState<{ saleId: string | null; phaseMoved: boolean } | null>(null);
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
      setLossReasons((json.lossReasons ?? []) as Array<{ key: string; label: string }>);
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
        sale_type: item.sale_type === 'rental' ? 'rental' as SaleType : 'sale' as SaleType,
        rental_start_date: String(item.rental_start_date ?? '').slice(0, 10),
        rental_end_date: String(item.rental_end_date ?? '').slice(0, 10),
        rental_monthly_price: item.rental_monthly_price == null ? '' : String(item.rental_monthly_price),
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

  // Fiyatlama sunucuyla aynı modülden (lib/quotes/line-pricing.ts).
  const resolvedEditItems = useMemo(() => editItems.map((item) => {
    const product = productMap.get(item.product_id) ?? null;
    const priced = priceLine({
      product_id: item.product_id, quantity: item.quantity, sale_type: item.sale_type,
      rental_start_date: item.rental_start_date || null, rental_end_date: item.rental_end_date || null,
      rental_monthly_price: item.rental_monthly_price === '' ? null : Number(item.rental_monthly_price),
    }, rulesByProduct.get(item.product_id) ?? []);
    return { ...item, product, priced, rule: priced.rule, rule_label: priced.rule_label, unit_price: priced.unit_price, total_price: priced.total_price };
  }), [editItems, productMap, rulesByProduct]);

  const editTotals = useMemo(() => {
    const t = sumLineTotals(resolvedEditItems.map((item) => ({ quantity: item.quantity, product: item.product, priced: item.priced })));
    return { totalDevices: t.totalDevices, totalAmount: t.totalAmount, monthlyAmount: t.monthlyAmount, rentalAmount: t.rentalAmount };
  }, [resolvedEditItems]);

  const patchEditLine = (uid: string, patch: Partial<EditItem>) => setEditItems((current) => current.map((row) => row.uid === uid ? { ...row, ...patch } : row));
  const toggleEditSaleType = (uid: string, next: SaleType) => setEditItems((current) => current.map((row) => {
    if (row.uid !== uid) return row;
    if (next === 'rental') return { ...row, sale_type: 'rental', rental_start_date: row.rental_start_date || new Date().toISOString().slice(0, 10), rental_end_date: row.rental_end_date || isoPlusMonths(12) };
    return { ...row, sale_type: 'sale' };
  }));

  const editValid = Boolean(editTitle.trim() && resolvedEditItems.length && resolvedEditItems.every((item) => item.product_id && item.quantity > 0 && item.priced.priced));

  async function updateStatus(status: 'sent' | 'closed', options?: { closedReason?: string; lossReasonKey?: string; note?: string; movePhase?: boolean }) {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/quotes/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        quote_id: quoteId,
        status,
        closed_reason: status === 'closed' ? (options?.closedReason ?? 'won') : null,
        loss_reason_key: options?.lossReasonKey ?? null,
        close_note: options?.note ?? null,
        move_to_order_phase: options?.movePhase ?? false,
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(json?.message || 'Durum güncellenemedi.');
      setBusy(false);
      return;
    }

    if (status === 'closed' && (options?.closedReason ?? 'won') === 'won') {
      setSaleInfo({ saleId: json?.sale_id ?? null, phaseMoved: Boolean(json?.phase_moved) });
    }
    setCloseMode(null);
    setCloseNote('');
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
        items: editItems.map((item) => ({
          product_id: item.product_id, quantity: Number(item.quantity), sale_type: item.sale_type,
          rental_start_date: item.sale_type === 'rental' ? item.rental_start_date || null : null,
          rental_end_date: item.sale_type === 'rental' ? item.rental_end_date || null : null,
          rental_monthly_price: item.sale_type === 'rental' && item.rental_monthly_price !== '' ? Number(item.rental_monthly_price) : null,
        })),
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
            <>
              <button
                disabled={busy}
                onClick={() => { setCloseMode('won'); setCloseNote(''); setMovePhase(true); }}
                style={{ ...primaryButton, background: '#059669', color: 'white', border: 'none' }}
              >✓ Satışa Dönüştür</button>
              <button
                disabled={busy}
                onClick={() => { setCloseMode('lost'); setCloseNote(''); setClosedReasonKind('lost'); setLossReasonKey(''); }}
                style={{ ...ghostButton, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
              >Kaybedildi / Kapat</button>
            </>
          ) : null}
        </div>
      </div>

      {msg ? <div style={{ ...surface, color: 'var(--chip-red-color)' }}>{msg}</div> : null}

      {saleInfo ? (
        <div style={{ ...surface, borderColor: 'var(--chip-green-bd)', background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', fontWeight: 700 }}>
          Teklif satışa dönüştürüldü.{saleInfo.phaseMoved ? ' Müşteri Sipariş fazına taşındı.' : ''}{' '}
          <Link href="/crm/sales" style={{ color: 'inherit', textDecoration: 'underline' }}>Satışlar ekranından</Link> cihaz adedini ve tutarı güncelleyebilirsin; teklif belgesi değişmez.
        </div>
      ) : null}

      {closeMode === 'won' ? (
        <div style={modalBackdrop} onClick={() => setCloseMode(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Satışa Dönüştür</h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 12px', fontSize: 13 }}>
              {quote.quote_no} · {quote.customer?.musteri || '-'} · {quote.total_device_count ?? 0} cihaz ·{' '}
              ${Number(quote.total_amount ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
              <br />
              Teklif kazanıldı olarak kapanır ve <b>Satışlar</b> ekranında düzenlenebilir bir satış kaydı açılır.
              Ciro raporları bu satıştan beslenir; teklif belgesi olduğu gibi kalır.
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <input type="checkbox" checked={movePhase} onChange={(e) => setMovePhase(e.target.checked)} style={{ marginTop: 3 }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>
                Müşteriyi <b>Sipariş</b> fazına taşı (faz 15)
                <small style={{ display: 'block', color: 'var(--text-3)', fontWeight: 600 }}>
                  Aktivite kaydı olarak yazılır; müşteri daha ileri bir fazdaysa dokunulmaz.
                </small>
              </span>
            </label>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>Not (opsiyonel)</span>
              <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 76, padding: 10 }} placeholder="Sipariş / sözleşme bilgisi, teslim planı…" />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCloseMode(null)} style={ghostButton} disabled={busy}>Vazgeç</button>
              <button
                onClick={() => void updateStatus('closed', { closedReason: 'won', note: closeNote, movePhase })}
                style={{ ...primaryButton, background: '#059669', color: 'white', border: 'none' }}
                disabled={busy}
              >{busy ? 'İşleniyor…' : 'Satışa Dönüştür'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {closeMode === 'lost' ? (
        <div style={modalBackdrop} onClick={() => setCloseMode(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Teklifi Kapat</h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 12px', fontSize: 13 }}>
              {quote.quote_no} · {quote.customer?.musteri || '-'} — kayıp nedeni ve kısa açıklama zorunlu; kayıp analizi bu kırılımdan çıkıyor.
            </p>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>Kapanış Türü *</span>
              <select value={closedReasonKind} onChange={(e) => setClosedReasonKind(e.target.value as 'lost' | 'expired' | 'no_interest')} style={inputStyle}>
                <option value="lost">Kaybedildi</option>
                <option value="expired">Süresi doldu</option>
                <option value="no_interest">İlgilenmiyor</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>Kayıp Nedeni *</span>
              <select value={lossReasonKey} onChange={(e) => setLossReasonKey(e.target.value)} style={inputStyle}>
                <option value="">Seçiniz…</option>
                {lossReasons.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-2)' }}>Açıklama *</span>
              <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 76, padding: 10 }} placeholder="Ne oldu? (rakip fiyatı, bütçe kalmadı, karar ertelendi…)" />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCloseMode(null)} style={ghostButton} disabled={busy}>Vazgeç</button>
              <button
                onClick={() => void updateStatus('closed', { closedReason: closedReasonKind, lossReasonKey, note: closeNote })}
                style={primaryButton}
                disabled={busy || !lossReasonKey || !closeNote.trim()}
              >{busy ? 'İşleniyor…' : 'Teklifi Kapat'}</button>
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="quote-detail-head-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
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
                <button type="button" onClick={() => setEditItems((current) => [...current, emptyEditLine()])} style={ghostButton}>+ Satır Ekle</button>
              </div>

              {resolvedEditItems.map((item, index) => (
                <div key={item.uid} className="quote-detail-line-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 130px 110px 130px auto', gap: 10, alignItems: 'end', border: '1px solid var(--border)', borderRadius: 16, padding: 12 }}>
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
                    <input type="number" min={1} value={item.quantity} onChange={(event) => patchEditLine(item.uid, { quantity: Math.max(1, Number(event.target.value || 1)) })} style={{ ...inputStyle, width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{item.sale_type === 'rental' ? 'Dönem' : 'Barem'}</label>
                    <div style={readonlyBox}>{item.rule_label}</div>
                  </div>
                  <div>
                    <label style={labelStyle}>{item.sale_type === 'rental' ? 'Sözleşme' : 'Toplam'}</label>
                    <div style={readonlyBox}>{money(item.total_price)}{item.sale_type !== 'rental' && item.product?.is_recurring ? ' / ay' : ''}</div>
                  </div>
                  <button type="button" disabled={editItems.length <= 1} onClick={() => setEditItems((current) => current.filter((row) => row.uid !== item.uid))} style={{ ...ghostButton, color: '#991b1b' }}>Sil</button>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Satır {index + 1} · {item.sale_type === 'rental' ? `Aylık birim kira: ${money(item.unit_price)} · aylık ${money(item.priced.monthly_total)}` : `Birim fiyat: ${money(item.unit_price)}`}{item.priced.problem ? <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {item.priced.problem}</span> : null}</div>
                    <div role="radiogroup" aria-label="Satış tipi" style={{ display: 'inline-flex', padding: 3, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      {(['sale', 'rental'] as SaleType[]).map((kind) => (
                        <button key={kind} type="button" role="radio" aria-checked={item.sale_type === kind} onClick={() => toggleEditSaleType(item.uid, kind)} disabled={kind === 'rental' && Boolean(item.product?.is_recurring)}
                          style={{ minHeight: 28, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', background: item.sale_type === kind ? (kind === 'rental' ? '#b45309' : '#4338ca') : 'transparent', color: item.sale_type === kind ? '#fff' : 'var(--text-2)', opacity: kind === 'rental' && item.product?.is_recurring ? 0.5 : 1 }}>
                          {kind === 'sale' ? 'Satış' : 'Kiralama'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {item.sale_type === 'rental' ? (
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: 10, borderRadius: 12, border: '1px solid var(--chip-gold-bd)', background: 'var(--chip-gold-bg)' }}>
                      <div><label style={labelStyle}>Başlangıç</label><input type="date" value={item.rental_start_date} onChange={(event) => patchEditLine(item.uid, { rental_start_date: event.target.value })} style={{ ...inputStyle, width: '100%' }} /></div>
                      <div><label style={labelStyle}>Bitiş</label><input type="date" min={item.rental_start_date || undefined} value={item.rental_end_date} onChange={(event) => patchEditLine(item.uid, { rental_end_date: event.target.value })} style={{ ...inputStyle, width: '100%' }} /></div>
                      <div><label style={labelStyle}>Aylık birim kira (USD)</label><input type="number" min={0} step="0.01" value={item.rental_monthly_price} onChange={(event) => patchEditLine(item.uid, { rental_monthly_price: event.target.value })} placeholder="cihaz başı / ay" style={{ ...inputStyle, width: '100%' }} /></div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <KpiCard label="Toplam cihaz" value={String(editTotals.totalDevices)} />
              <KpiCard label="Teklif tutarı" value={money(editTotals.totalAmount)} />
              {editTotals.rentalAmount > 0 ? <KpiCard label="Kiralama sözleşme değeri" value={money(editTotals.rentalAmount)} /> : null}
              <KpiCard label="Aylık hizmet + kira" value={`${money(editTotals.monthlyAmount)} / ay`} />
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

      <section className="quote-detail-meta-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
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
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {item.product_name_snapshot}
                  {item.sale_type === 'rental' ? <span style={rentalPill}>Kiralama</span> : null}
                </div>
                {item.sale_type === 'rental' ? (
                  <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{item.quantity} adet · {item.formatted_unit_price} / ay / cihaz · {rentalPeriodLabel(item.rental_start_date, item.rental_end_date)} · sözleşme {item.formatted_total_price}</div>
                ) : (
                  <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{item.quantity} adet · {item.formatted_unit_price} / birim · {item.formatted_total_price}{item.is_recurring ? ' / ay' : ''}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={surface}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Satır detayları</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{['Ürün', 'Satış Tipi', 'Kategori', 'Adet', 'Birim', 'Toplam'].map((head) => <th key={head} style={tableHead}>{head}</th>)}</tr></thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tableCell}><div style={{ fontWeight: 800 }}>{item.product_name_snapshot}</div><div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 12 }}>{item.product_code_snapshot} · {item.product_type}</div></td>
                  <td style={tableCell}>
                    {item.sale_type === 'rental' ? (
                      <div><span style={rentalPill}>Kiralama</span><div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 12 }}>{rentalPeriodLabel(item.rental_start_date, item.rental_end_date)}</div></div>
                    ) : (item.is_recurring ? 'Aylık hizmet' : 'Satış')}
                  </td>
                  <td style={tableCell}>{item.category}</td>
                  <td style={tableCell}>{item.quantity}</td>
                  <td style={tableCell}>{item.formatted_unit_price}{item.sale_type === 'rental' ? ' / ay' : ''}</td>
                  <td style={tableCell}>{item.formatted_total_price}{item.sale_type !== 'rental' && item.is_recurring ? ' / ay' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const rentalPill: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', border: '1px solid var(--chip-gold-bd)' };

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-3)' }}>{label}</span><strong style={{ color: 'var(--text)', textAlign: 'right' }}>{value}</strong></div>;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return <div style={surfaceCard}><div style={miniTitle}>{label}</div><div style={bigValue}>{value}</div></div>;
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 };
const modalCard: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 18, boxShadow: 'var(--shadow)', width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto' };
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
