'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { priceLine, sumLineTotals, type SaleType } from '@/lib/quotes/line-pricing';

type Product = {
  id: string; code: string; name: string; category: string;
  product_type: 'device' | 'bundle' | 'recurring' | 'peripheral';
  is_recurring: boolean; billing_period: 'one_time' | 'monthly'; description: string;
};
type Rule = { product_id: string; min_qty: number; max_qty: number | null; unit_price: number };
type Customer = { id: string; musteri: string; sektor: string | null; sorumlu: string | null };
type QuoteItem = {
  uid: string; product_id: string; quantity: number;
  /** Satış (katalog kademesi) ya da Kiralama (tarihli, aylık kira bedeli elle) — 08.09 satış ekibi isteği. */
  sale_type: SaleType;
  rental_start_date: string;
  rental_end_date: string;
  rental_monthly_price: string;
};
const emptyLine = (): QuoteItem => ({ uid: randomId(), product_id: '', quantity: 1, sale_type: 'sale', rental_start_date: '', rental_end_date: '', rental_monthly_price: '' });
/** Bugün + n ay (kiralama varsayılan dönemi: 12 ay). */
function isoPlusMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function randomId() { return Math.random().toString(36).slice(2, 10); }
function money(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

type Props = {
  /** Hero bölümünü göster (mobile/new quote sayfası için) */
  showHero?: boolean;
};

export default function QuoteBuilder({ showHero = false }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [probabilities, setProbabilities] = useState<number[]>([10, 30, 60, 90]);

  const [customerId, setCustomerId] = useState('');
  const [opportunityTitle, setOpportunityTitle] = useState('');
  const [probability, setProbability] = useState(60);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyLine()]);
  const [saving, setSaving] = useState<'draft' | 'sent' | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/quotes/options', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Opsiyonlar alınamadı');
        setProducts(json.products ?? []);
        setRules(json.rules ?? []);
        setCustomers(json.customers ?? []);
        setProbabilities(json.probabilities ?? [10, 30, 60, 90]);
        setLoaded(true);
      } catch (err: any) { setError(err.message); }
    };
    load();
  }, []);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const rulesByProduct = useMemo(() => {
    const map = new Map<string, Rule[]>();
    rules.forEach(rule => {
      const list = map.get(rule.product_id) ?? [];
      list.push(rule);
      map.set(rule.product_id, list);
    });
    return map;
  }, [rules]);

  // Fiyatlama sunucuyla aynı modülden (lib/quotes/line-pricing.ts): satış = kademe,
  // kiralama = aylık kira × adet × ay.
  const resolvedItems = useMemo(() => items.map(item => {
    const product = productMap.get(item.product_id) ?? null;
    const priced = priceLine({
      product_id: item.product_id, quantity: item.quantity, sale_type: item.sale_type,
      rental_start_date: item.rental_start_date || null, rental_end_date: item.rental_end_date || null,
      rental_monthly_price: item.rental_monthly_price === '' ? null : Number(item.rental_monthly_price),
    }, rulesByProduct.get(item.product_id) ?? []);
    return { ...item, product, priced, rule: priced.rule, rule_label: priced.rule_label, unit_price: priced.unit_price, total_price: priced.total_price };
  }), [items, productMap, rulesByProduct]);

  const totals = useMemo(() => {
    const t = sumLineTotals(resolvedItems.map(item => ({ quantity: item.quantity, product: item.product, priced: item.priced })));
    return { total_devices: t.totalDevices, total_amount: t.totalAmount, monthly_amount: t.monthlyAmount, hardware_amount: t.hardwareAmount, rental_amount: t.rentalAmount };
  }, [resolvedItems]);

  const setLine = (uid: string, patch: Partial<QuoteItem>) => setItems(prev => prev.map(i => i.uid === uid ? { ...i, ...patch } : i));
  const toggleSaleType = (uid: string, next: SaleType) => setItems(prev => prev.map(i => {
    if (i.uid !== uid) return i;
    if (next === 'rental') {
      return { ...i, sale_type: 'rental', rental_start_date: i.rental_start_date || new Date().toISOString().slice(0, 10), rental_end_date: i.rental_end_date || isoPlusMonths(12) };
    }
    return { ...i, sale_type: 'sale' };
  }));

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === customerId) || null,
    [customers, customerId]
  );

  const isValid = useMemo(() =>
    Boolean(customerId && opportunityTitle.trim() && resolvedItems.length && resolvedItems.every(i => i.product_id && i.quantity > 0 && i.priced.priced)),
    [customerId, opportunityTitle, resolvedItems]
  );

  const submit = async (saveMode: 'draft' | 'sent') => {
    if (!isValid || saving) return;
    setSaving(saveMode);
    setError('');
    try {
      const res = await fetch('/api/quotes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          opportunity_title: opportunityTitle,
          probability, note, save_mode: saveMode,
          items: items.map(i => ({
            product_id: i.product_id, quantity: Number(i.quantity), sale_type: i.sale_type,
            rental_start_date: i.sale_type === 'rental' ? i.rental_start_date || null : null,
            rental_end_date: i.sale_type === 'rental' ? i.rental_end_date || null : null,
            rental_monthly_price: i.sale_type === 'rental' && i.rental_monthly_price !== '' ? Number(i.rental_monthly_price) : null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Teklif kaydedilemedi');
      router.push(`/crm/quotes/${json.id}`);
      router.refresh();
    } catch (err: any) { setError(err.message); setSaving(null); }
  };

  if (!loaded) {
    return (
      <div className="pax-page-container">
        <div className="pax-card pax-loading" style={{ padding: 60, textAlign: 'center' }}>
          Yükleniyor...
        </div>
      </div>
    );
  }

  const formContent = (
    <>
      {error && (
        <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Müşteri ve Detaylar */}
      <div className="pax-card" style={{ display: 'grid', gap: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📋 Teklif Detayları</h3>
        <div>
          <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Müşteri *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="pax-input" required style={{ width: '100%', minHeight: 48, fontSize: 16 }}>
            <option value="">Müşteri seç...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.musteri}</option>)}
          </select>
          {selectedCustomer && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
              {selectedCustomer.sektor && `${selectedCustomer.sektor} • `}
              {selectedCustomer.sorumlu && `Sorumlu: ${selectedCustomer.sorumlu}`}
            </div>
          )}
        </div>

        <div>
          <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Senaryo Başlığı *</label>
          <input type="text" value={opportunityTitle} onChange={(e) => setOpportunityTitle(e.target.value)} className="pax-input" placeholder="Örn: Mağaza içi EFT POS dönüşümü" required style={{ width: '100%', minHeight: 48, fontSize: 16 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Olasılık</label>
            <select value={probability} onChange={(e) => setProbability(Number(e.target.value))} className="pax-input" style={{ width: '100%', minHeight: 48, fontSize: 16 }}>
              {probabilities.map(val => <option key={val} value={val}>%{val}</option>)}
            </select>
          </div>
          <div>
            <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>İç Not</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="pax-input" placeholder="Opsiyonel" style={{ width: '100%', minHeight: 48, fontSize: 16 }} />
          </div>
        </div>
      </div>

      {/* Ürünler */}
      <div className="pax-card" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📦 Teklif Satırları</h3>
          <button type="button" onClick={() => setItems(prev => [...prev, emptyLine()])} className="pax-btn pax-btn-secondary" style={{ fontSize: 14, padding: '8px 16px', minHeight: 36 }}>+ Ekle</button>
        </div>

        {resolvedItems.map((item, idx) => (
          <div key={item.uid} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>Satır {idx + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Satış / Kiralama seçimi (08.09): kiralama seçilince tarih ve aylık kira alanları açılır. */}
                <div role="radiogroup" aria-label="Satış tipi" style={{ display: 'inline-flex', padding: 3, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  {(['sale', 'rental'] as SaleType[]).map(kind => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={item.sale_type === kind}
                      onClick={() => toggleSaleType(item.uid, kind)}
                      disabled={kind === 'rental' && Boolean(item.product?.is_recurring)}
                      title={kind === 'rental' && item.product?.is_recurring ? 'Aylık hizmet kalemi kiralama olarak girilemez' : undefined}
                      style={{
                        minHeight: 30, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
                        background: item.sale_type === kind ? (kind === 'rental' ? '#b45309' : '#4338ca') : 'transparent',
                        color: item.sale_type === kind ? '#fff' : 'var(--text-2)',
                        opacity: kind === 'rental' && item.product?.is_recurring ? 0.5 : 1,
                      }}
                    >
                      {kind === 'sale' ? 'Satış' : 'Kiralama'}
                    </button>
                  ))}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(prev => prev.filter(i => i.uid !== item.uid))} style={{ padding: '4px 12px', fontSize: 13, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', color: '#991b1b', cursor: 'pointer' }}>Sil</button>
                )}
              </div>
            </div>

            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Ürün *</label>
              <select value={item.product_id} onChange={(e) => setItems(prev => prev.map(i => i.uid === item.uid ? { ...i, product_id: e.target.value } : i))} className="pax-input" required style={{ width: '100%', minHeight: 48, fontSize: 16 }}>
                <option value="">Ürün seç...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {item.product && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>{item.product.category} • {item.product.description}</div>}
            </div>

            <div>
              <label className="pax-label" style={{ display: 'block', marginBottom: 8 }}>Adet *</label>
              <input type="number" min={1} value={item.quantity} onChange={(e) => setLine(item.uid, { quantity: Math.max(1, Number(e.target.value || 1)) })} className="pax-input" required style={{ width: '100%', minHeight: 48, fontSize: 16 }} />
            </div>

            {item.sale_type === 'rental' && (
              <div style={{ display: 'grid', gap: 12, padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--chip-gold-bd)', background: 'var(--chip-gold-bg)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--chip-gold-color)' }}>Kiralama dönemi ve aylık kira</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div>
                    <label className="pax-label" style={{ display: 'block', marginBottom: 6 }}>Başlangıç *</label>
                    <input type="date" value={item.rental_start_date} onChange={(e) => setLine(item.uid, { rental_start_date: e.target.value })} className="pax-input" style={{ width: '100%', minHeight: 44 }} />
                  </div>
                  <div>
                    <label className="pax-label" style={{ display: 'block', marginBottom: 6 }}>Bitiş *</label>
                    <input type="date" min={item.rental_start_date || undefined} value={item.rental_end_date} onChange={(e) => setLine(item.uid, { rental_end_date: e.target.value })} className="pax-input" style={{ width: '100%', minHeight: 44 }} />
                  </div>
                  <div>
                    <label className="pax-label" style={{ display: 'block', marginBottom: 6 }}>Aylık birim kira (USD) *</label>
                    <input type="number" min={0} step="0.01" value={item.rental_monthly_price} onChange={(e) => setLine(item.uid, { rental_monthly_price: e.target.value })} className="pax-input" placeholder="cihaz başı / ay" style={{ width: '100%', minHeight: 44 }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Katalogda kira tarifesi yok; aylık birim kira elle girilir. Tutar = kira × adet × ay{item.priced.rental_months ? ` (${item.priced.rental_months} ay)` : ''}.
                </div>
              </div>
            )}

            {item.product && (
              <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', display: 'grid', gap: 8 }}>
                {item.sale_type === 'rental' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Dönem:</span><span style={{ fontWeight: 600 }}>{item.rule_label}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Aylık kira:</span><span style={{ fontWeight: 600 }}>{money(item.unit_price)} × {item.quantity} = {money(item.priced.monthly_total)} / ay</span></div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Barem:</span><span style={{ fontWeight: 600 }}>{item.rule_label}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Birim Fiyat:</span><span style={{ fontWeight: 600 }}>{money(item.unit_price)}</span></div>
                  </>
                )}
                {item.priced.problem && <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>{item.priced.problem}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700 }}>{item.sale_type === 'rental' ? 'Sözleşme değeri:' : 'Toplam:'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{money(item.total_price)}{item.sale_type !== 'rental' && item.product.is_recurring && <span style={{ fontSize: 12 }}> / ay</span>}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Özet */}
      <div className="pax-card" style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>💰 Ticari Özet</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Toplam cihaz', value: String(totals.total_devices) },
            { label: 'Teklif tutarı', value: money(totals.total_amount) },
            ...(totals.rental_amount > 0 ? [{ label: 'Kiralama sözleşme değeri', value: money(totals.rental_amount) }] : []),
            { label: 'Aylık recurring', value: money(totals.monthly_amount), accent: true },
            { label: 'Teklif geçerliliği', value: '15 gün' },
            { label: 'Sent olursa', value: 'Aktivite + follow‑up (+30 gün)' },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)' }}>{label}</span>
              <strong style={accent ? { color: 'var(--accent)' } : {}}>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Kaydet */}
      <div className="pax-card" style={{ display: 'grid', gap: 12 }}>
        <button type="button" onClick={() => submit('draft')} disabled={!isValid || saving != null} className="pax-btn pax-btn-secondary">
          {saving === 'draft' ? 'Kaydediliyor...' : '📝 Draft Kaydet'}
        </button>
        <button type="submit" disabled={!isValid || saving != null} className="pax-btn pax-btn-primary">
          {saving === 'sent' ? 'Gönderiliyor...' : '📤 Sent Olarak Oluştur'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
          Sent ile kayıt açılırsa teklif tarihi bugün, geçerlilik +15 gün ve follow‑up +30 gün olarak kaydedilir.
        </p>
      </div>
    </>
  );

  // Mobile/new-quote: hero + pax-page-container wrapper
  if (showHero) {
    return (
      <form className="pax-page-container" onSubmit={(e) => { e.preventDefault(); submit('sent'); }}>
        <div className="pax-hero">
          <span className="pax-hero-eyebrow">Yeni Teklif</span>
          <h1 className="pax-hero-title">Quote Builder</h1>
          <p className="pax-hero-description">Ürün + adet gir, sisteme fiyat barem seçsin.</p>
        </div>
        {formContent}
      </form>
    );
  }

  // Desktop: bare form
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit('sent'); }}>
      {formContent}
    </form>
  );
}
