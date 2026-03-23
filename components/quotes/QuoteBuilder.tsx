'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Product = {
  id: string; code: string; name: string; category: string;
  product_type: 'device' | 'bundle' | 'recurring' | 'peripheral';
  is_recurring: boolean; billing_period: 'one_time' | 'monthly'; description: string;
};
type Rule = { product_id: string; min_qty: number; max_qty: number | null; unit_price: number };
type Customer = { id: string; musteri: string; sektor: string | null; sorumlu: string | null };
type QuoteItem = { uid: string; product_id: string; quantity: number };

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
  const [items, setItems] = useState<QuoteItem[]>([{ uid: randomId(), product_id: '', quantity: 1 }]);
  const [saving, setSaving] = useState<'draft' | 'sent' | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/quotes/options', { next: { revalidate: 60 } });
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

  const resolvedItems = useMemo(() => items.map(item => {
    const product = productMap.get(item.product_id) ?? null;
    const productRules = rulesByProduct.get(item.product_id) ?? [];
    const rule = productRules.find(r => item.quantity >= r.min_qty && (r.max_qty == null || item.quantity <= r.max_qty)) ?? null;
    return {
      ...item, product, rule,
      rule_label: rule ? `${rule.min_qty}${rule.max_qty ? `-${rule.max_qty}` : '+'}` : '-',
      unit_price: rule?.unit_price ?? 0,
      total_price: (rule?.unit_price ?? 0) * item.quantity,
    };
  }), [items, productMap, rulesByProduct]);

  const totals = useMemo(() => {
    let total_devices = 0, total_amount = 0, monthly_amount = 0;
    resolvedItems.forEach(item => {
      if (item.product?.product_type === 'device') total_devices += item.quantity;
      if (item.product?.is_recurring) monthly_amount += item.total_price;
      else total_amount += item.total_price;
    });
    return { total_devices, total_amount, monthly_amount };
  }, [resolvedItems]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === customerId) || null,
    [customers, customerId]
  );

  const isValid = useMemo(() =>
    Boolean(customerId && opportunityTitle.trim() && items.every(i => i.product_id && i.quantity > 0)),
    [customerId, opportunityTitle, items]
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
          items: items.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })),
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
          <button type="button" onClick={() => setItems(prev => [...prev, { uid: randomId(), product_id: '', quantity: 1 }])} className="pax-btn pax-btn-secondary" style={{ fontSize: 14, padding: '8px 16px', minHeight: 36 }}>+ Ekle</button>
        </div>

        {resolvedItems.map((item, idx) => (
          <div key={item.uid} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>Satır {idx + 1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems(prev => prev.filter(i => i.uid !== item.uid))} style={{ padding: '4px 12px', fontSize: 13, background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', color: '#991b1b', cursor: 'pointer' }}>Sil</button>
              )}
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
              <input type="number" min={1} value={item.quantity} onChange={(e) => setItems(prev => prev.map(i => i.uid === item.uid ? { ...i, quantity: Math.max(1, Number(e.target.value || 1)) } : i))} className="pax-input" required style={{ width: '100%', minHeight: 48, fontSize: 16 }} />
            </div>

            {item.product && (
              <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Barem:</span><span style={{ fontWeight: 600 }}>{item.rule_label}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-3)' }}>Birim Fiyat:</span><span style={{ fontWeight: 600 }}>{money(item.unit_price)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700 }}>Toplam:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{money(item.total_price)}{item.product.is_recurring && <span style={{ fontSize: 12 }}> / ay</span>}</span>
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
