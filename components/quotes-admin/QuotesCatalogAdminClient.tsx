'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  product_type: 'device' | 'bundle' | 'recurring' | 'peripheral';
  unit_label: string;
  currency: string;
  is_recurring: boolean;
  billing_period: 'one_time' | 'monthly';
  description: string | null;
  specs: string[];
  sort_order: number;
  is_active: boolean;
};

type Rule = {
  id: string;
  product_id: string;
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

type FormProduct = {
  id?: string;
  code: string;
  name: string;
  category: string;
  product_type: Product['product_type'];
  unit_label: string;
  currency: string;
  is_recurring: boolean;
  billing_period: Product['billing_period'];
  description: string;
  specsText: string;
  sort_order: number;
  is_active: boolean;
};

const emptyProduct: FormProduct = {
  code: '',
  name: '',
  category: 'EFT POS',
  product_type: 'device',
  unit_label: 'adet',
  currency: 'USD',
  is_recurring: false,
  billing_period: 'one_time',
  description: '',
  specsText: '',
  sort_order: 100,
  is_active: true,
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function normalizeSpecsText(input: unknown) {
  if (Array.isArray(input)) return input.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object') return Object.values(input as Record<string, unknown>).map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  return '';
}

export default function QuotesCatalogAdminClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productForm, setProductForm] = useState<FormProduct>(emptyProduct);
  const [ruleForm, setRuleForm] = useState({ min_qty: 1, max_qty: '', unit_price: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  async function load(preferredProductId?: string) {
    setLoading(true);
    const res = await fetch('/api/quotes/catalog/list', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json?.message || 'Ürün kataloğu alınamadı.');
      setLoading(false);
      return;
    }
    const nextProducts = (json.products ?? []) as Product[];
    const nextRules = (json.rules ?? []) as Rule[];
    setProducts(nextProducts);
    setRules(nextRules);
    setSelectedProductId((current) => {
      const preferred = preferredProductId || current;
      if (preferred && nextProducts.some((item) => item.id === preferred)) return preferred;
      return nextProducts[0]?.id || '';
    });
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedProduct = useMemo(() => products.find((item) => item.id === selectedProductId) ?? null, [products, selectedProductId]);
  const selectedProductRules = useMemo(() => rules.filter((rule) => rule.product_id === selectedProductId).sort((a, b) => a.min_qty - b.min_qty), [rules, selectedProductId]);

  useEffect(() => {
    if (!selectedProduct) {
      setProductForm(emptyProduct);
      return;
    }
    setProductForm({
      id: selectedProduct.id,
      code: selectedProduct.code,
      name: selectedProduct.name,
      category: selectedProduct.category,
      product_type: selectedProduct.product_type,
      unit_label: selectedProduct.unit_label,
      currency: selectedProduct.currency,
      is_recurring: selectedProduct.is_recurring,
      billing_period: selectedProduct.billing_period,
      description: selectedProduct.description || '',
      specsText: normalizeSpecsText(selectedProduct.specs),
      sort_order: selectedProduct.sort_order,
      is_active: selectedProduct.is_active,
    });
  }, [selectedProduct]);

  async function saveProduct() {
    setSavingProduct(true);
    setMsg(null);
    try {
      const res = await fetch('/api/quotes/catalog/product-upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          specs: productForm.specsText.split('\n').map((item) => item.trim()).filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'Ürün kaydedilemedi.');
        return;
      }
      const savedProduct = (json?.product ?? null) as Product | null;
      if (savedProduct?.id) {
        setProducts((prev) => {
          const exists = prev.some((item) => item.id === savedProduct.id);
          const next = exists
            ? prev.map((item) => (item.id === savedProduct.id ? savedProduct : item))
            : [...prev, savedProduct];
          return [...next].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'tr'));
        });
        setSelectedProductId(String(savedProduct.id));
      }
      setMsg('Ürün kaydedildi.');
      await load(savedProduct?.id ? String(savedProduct.id) : productForm.id);
    } finally {
      setSavingProduct(false);
    }
  }

  async function saveRule() {
    if (!selectedProductId) {
      setMsg('Önce ürün seç.');
      return;
    }
    setSavingRule(true);
    setMsg(null);
    try {
      const res = await fetch('/api/quotes/catalog/rule-upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          min_qty: Number(ruleForm.min_qty || 1),
          max_qty: ruleForm.max_qty === '' ? null : Number(ruleForm.max_qty),
          unit_price: Number(ruleForm.unit_price || 0),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'Fiyat kuralı kaydedilemedi.');
        return;
      }
      setMsg('Fiyat baremi kaydedildi.');
      setRuleForm({ min_qty: 1, max_qty: '', unit_price: '' });
      await load(selectedProductId);
    } finally {
      setSavingRule(false);
    }
  }

  async function deleteRule(ruleId: string) {
    const res = await fetch('/api/quotes/catalog/rule-delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rule_id: ruleId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json?.message || 'Fiyat baremi silinemedi.');
      return;
    }
    setMsg('Fiyat baremi silindi.');
    await load(selectedProductId);
  }

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Teklif Kataloğu Yönetimi</span>
        <h1 className="pax-hero-title">Ürün ve Fiyat Yönetimi</h1>
        <p className="pax-hero-description">Yeni ürün ekleme, mevcut ürün güncelleme ve adet baremine göre fiyat tanımlama ekranı.</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Ürün Sayısı</div><div className="pax-hero-stat-value">{products.length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Fiyat Kuralı</div><div className="pax-hero-stat-value">{rules.length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Kategori</div><div className="pax-hero-stat-value">{new Set(products.map((p: any) => p.category).filter(Boolean)).size}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Kural / Ürün</div><div className="pax-hero-stat-value">{products.length ? (rules.length / products.length).toFixed(1) : 0}</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Link href="/crm/quotes" style={{ ...ghostButton, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Teklif Portföyü</Link>
          <button onClick={() => { setSelectedProductId(''); setProductForm(emptyProduct); setMsg(null); }} style={{ ...primaryButton, background: 'white', color: '#1e3a8a', border: 'none' }}>+ Yeni Ürün</button>
        </div>
      </div>

      {msg ? <div style={{ ...surface, padding: 14, color: '#4338ca', background: 'var(--chip-indigo-bg)', borderColor: 'var(--chip-indigo-bd)' }}>{msg}</div> : null}

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: '0.95fr 1.05fr' }}>
        <div style={{ ...surface, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Ürün Listesi</div>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{products.length} aktif/pasif kayıt</div>
          </div>
          <div style={{ display: 'grid', gap: 10, maxHeight: 70 * 8, overflowY: 'auto', paddingRight: 4 }}>
            {!loading && !products.length ? <div style={{ color: 'var(--text-3)' }}>Katalog boş.</div> : null}
            {products.map((product) => (
              <button key={product.id} onClick={() => setSelectedProductId(product.id)} style={{ ...productCard, ...(selectedProductId === product.id ? selectedCard : null) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, color: 'var(--text)' }}>{product.name}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{product.code} · {product.category}</div>
                  </div>
                  <span style={{ ...pill, ...(product.is_active ? activePill : passivePill) }}>{product.is_active ? 'Aktif' : 'Pasif'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...surface, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{productForm.id ? 'Ürün Güncelle' : 'Yeni Ürün Ekle'}</div>
          <div style={grid2}>
            <label style={field}><span style={label}>Kod</span><input value={productForm.code} onChange={(e) => setProductForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} style={input} placeholder="A6650" /></label>
            <label style={field}><span style={label}>Ürün Adı</span><input value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} style={input} placeholder="PAX A6650" /></label>
            <label style={field}><span style={label}>Kategori</span><input value={productForm.category} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} style={input} placeholder="EFT POS / ELYS / Service" /></label>
            <label style={field}><span style={label}>Ürün Tipi</span><select value={productForm.product_type} onChange={(e) => setProductForm((prev) => ({ ...prev, product_type: e.target.value as Product['product_type'] }))} style={input}><option value="device">device</option><option value="bundle">bundle</option><option value="recurring">recurring</option><option value="peripheral">peripheral</option></select></label>
            <label style={field}><span style={label}>Birim</span><input value={productForm.unit_label} onChange={(e) => setProductForm((prev) => ({ ...prev, unit_label: e.target.value }))} style={input} /></label>
            <label style={field}><span style={label}>Para Birimi</span><input value={productForm.currency} onChange={(e) => setProductForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} style={input} /></label>
            <label style={field}><span style={label}>Sıralama</span><input type="number" value={productForm.sort_order} onChange={(e) => setProductForm((prev) => ({ ...prev, sort_order: Number(e.target.value || 100) }))} style={input} /></label>
            <label style={field}><span style={label}>Faturalama</span><select value={productForm.billing_period} onChange={(e) => setProductForm((prev) => ({ ...prev, billing_period: e.target.value as Product['billing_period'] }))} style={input}><option value="one_time">one_time</option><option value="monthly">monthly</option></select></label>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={checkLabel}><input type="checkbox" checked={productForm.is_recurring} onChange={(e) => setProductForm((prev) => ({ ...prev, is_recurring: e.target.checked }))} /> Recurring (aylık)</label>
            <label style={checkLabel}><input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Aktif ürün</label>
          </div>

          <label style={field}><span style={label}>Açıklama</span><input value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} style={input} placeholder="Kısa açıklama" /></label>
          <label style={field}><span style={label}>Teknik Özellikler</span><textarea value={productForm.specsText} onChange={(e) => setProductForm((prev) => ({ ...prev, specsText: e.target.value }))} style={textarea} placeholder={'Her satıra bir özellik\nAndroid 12\nIP67'} /></label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={saveProduct} disabled={savingProduct} style={primaryButton}>{savingProduct ? 'Kaydediliyor...' : 'Ürünü Kaydet'}</button>
          </div>
        </div>
      </section>

      <section style={{ ...surface, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Fiyat Baremleri</div>
            <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 13 }}>{selectedProduct ? `${selectedProduct.name} için adet kırılımı` : 'Önce ürün seç.'}</div>
          </div>
          {selectedProduct ? <div style={{ color: 'var(--text)', fontWeight: 800 }}>{selectedProduct.code}</div> : null}
        </div>

        {selectedProduct ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr>
                    {['Min Adet', 'Max Adet', 'Birim Fiyat', 'Önizleme', ''].map((head) => <th key={head} style={tableHead}>{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {!selectedProductRules.length ? <tr><td colSpan={5} style={{ padding: 20, color: 'var(--text-3)' }}>Henüz fiyat baremi yok.</td></tr> : null}
                  {selectedProductRules.map((rule) => (
                    <tr key={rule.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tableCell}>{rule.min_qty}</td>
                      <td style={tableCell}>{rule.max_qty ?? '∞'}</td>
                      <td style={tableCell}>{money(rule.unit_price)}</td>
                      <td style={tableCell}>{rule.min_qty} - {rule.max_qty ?? '+'} adet</td>
                      <td style={tableCell}><button onClick={() => void deleteRule(rule.id)} style={dangerButton}>Sil</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ ...surfaceInset, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
              <label style={field}><span style={label}>Min Adet</span><input type="number" min={1} value={ruleForm.min_qty} onChange={(e) => setRuleForm((prev) => ({ ...prev, min_qty: Number(e.target.value || 1) }))} style={input} /></label>
              <label style={field}><span style={label}>Max Adet</span><input type="number" min={1} value={ruleForm.max_qty} onChange={(e) => setRuleForm((prev) => ({ ...prev, max_qty: e.target.value }))} style={input} placeholder="Boş = sınırsız" /></label>
              <label style={field}><span style={label}>Birim Fiyat</span><input type="number" min={0} step="0.01" value={ruleForm.unit_price} onChange={(e) => setRuleForm((prev) => ({ ...prev, unit_price: e.target.value }))} style={input} placeholder="704" /></label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={saveRule} disabled={savingRule} style={primaryButton}>{savingRule ? 'Kaydediliyor...' : 'Baremi Kaydet'}</button></div>
            </div>
          </>
        ) : <div style={{ color: 'var(--text-3)' }}>Soldan bir ürün seç veya yeni ürün oluştur.</div>}
      </section>
    </main>
  );
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const surfaceInset: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 18, padding: 14 };
const eyebrow: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6366f1' };
const productCard: CSSProperties = { textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16, padding: 14, cursor: 'pointer' };
const selectedCard: CSSProperties = { borderColor: '#6366f1', boxShadow: '0 0 0 2px rgba(99,102,241,.12)' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 14, border: 'none', background: '#4f46e5', color: 'var(--surface)', fontWeight: 800, cursor: 'pointer', textDecoration: 'none' };
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' };
const dangerButton: CSSProperties = { minHeight: 34, padding: '0 12px', borderRadius: 12, border: '1px solid #fecaca', background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', fontWeight: 800, cursor: 'pointer' };
const grid2: CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' };
const field: CSSProperties = { display: 'grid', gap: 6 };
const label: CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' };
const input: CSSProperties = { minHeight: 42, borderRadius: 14, border: '1px solid #cbd5e1', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)' };
const textarea: CSSProperties = { minHeight: 120, borderRadius: 14, border: '1px solid #cbd5e1', padding: '12px', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' };
const tableHead: CSSProperties = { textAlign: 'left', padding: '0 12px 10px', color: 'var(--text-3)', fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '14px 12px', color: 'var(--text)', verticalAlign: 'top' };
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 10px', borderRadius: 999, border: '1px solid transparent', fontSize: 12, fontWeight: 800 };
const activePill: CSSProperties = { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: '#a7f3d0' };
const passivePill: CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: '#cbd5e1' };
const checkLabel: CSSProperties = { display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--text)', fontWeight: 700 };
