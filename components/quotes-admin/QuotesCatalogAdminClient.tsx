'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PRODUCT_USAGE_LABELS, normalizeUsageType, type ProductUsageType } from '@/lib/quotes/catalog';

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
  /** Kiralama tarifesi (USD/ay, KDV hariç); null = kiralanamaz. 08.09: A80 15 · A910S 15 · A6650 20. */
  rental_monthly_price?: number | null;
  usage_type?: ProductUsageType;
  rental_min_months?: number | null;
  rental_setup_fee?: number | null;
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
  /** Boş = kiralanamaz. */
  rental_monthly_price: string;
  usage_type: ProductUsageType;
  rental_min_months: string;
  rental_setup_fee: string;
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
  rental_monthly_price: '',
  usage_type: 'both',
  rental_min_months: '',
  rental_setup_fee: '',
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
  /** Yürürlükteki fiyat listesi tarihi (Liste Yönetimleri → Teklif). */
  const [priceListVersion, setPriceListVersion] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productForm, setProductForm] = useState<FormProduct>(emptyProduct);
  const [ruleForm, setRuleForm] = useState({ min_qty: 1, max_qty: '', unit_price: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [editorTab, setEditorTab] = useState<'general' | 'pricing'>('general');

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
    setPriceListVersion(String(json.priceListVersion ?? '').trim());
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
      rental_monthly_price: selectedProduct.rental_monthly_price == null ? '' : String(selectedProduct.rental_monthly_price),
      usage_type: normalizeUsageType(selectedProduct.usage_type),
      rental_min_months: selectedProduct.rental_min_months == null ? '' : String(selectedProduct.rental_min_months),
      rental_setup_fee: selectedProduct.rental_setup_fee == null ? '' : String(selectedProduct.rental_setup_fee),
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
          rental_monthly_price: productForm.rental_monthly_price.trim() === '' ? null : Number(productForm.rental_monthly_price),
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

  const usageCounts = useMemo(() => {
    const counts = { both: 0, sale: 0, rental: 0, passive: 0 };
    for (const product of products) {
      if (!product.is_active) { counts.passive += 1; continue; }
      counts[normalizeUsageType(product.usage_type)] += 1;
    }
    return counts;
  }, [products]);

  const ruleCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const rule of rules) map.set(rule.product_id, (map.get(rule.product_id) ?? 0) + 1);
    return map;
  }, [rules]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr')),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return products.filter((product) => {
      const usage = normalizeUsageType(product.usage_type);
      if (listFilter === 'passive' && product.is_active) return false;
      if (listFilter !== 'all' && listFilter !== 'passive' && (!product.is_active || usage !== listFilter)) return false;
      if (!q) return true;
      return `${product.code} ${product.name} ${product.category}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [products, search, listFilter]);

  const formUsage = productForm.usage_type;
  const rentalAllowed = formUsage !== 'sale' && !productForm.is_recurring;
  const saleAllowed = formUsage !== 'rental';
  const rentNumber = Number(productForm.rental_monthly_price);
  const monthsNumber = Number(productForm.rental_min_months);
  const setupNumber = Number(productForm.rental_setup_fee || 0);
  const rentalMissing = formUsage === 'rental' && productForm.rental_monthly_price.trim() === '';
  const monthsInvalid = productForm.rental_min_months.trim() !== '' && (!Number.isInteger(monthsNumber) || monthsNumber < 1 || monthsNumber > 120);
  const formError = !productForm.code.trim() || !productForm.name.trim()
    ? 'Kod ve ürün adı zorunlu.'
    : rentalMissing
      ? 'Sadece Kiralama ürününde aylık kira zorunlu.'
      : monthsInvalid
        ? 'Taahhüt süresi 1-120 ay arası olmalı.'
        : null;
  const rentalTotal = rentalAllowed && rentNumber > 0 && monthsNumber > 0 && !monthsInvalid
    ? rentNumber * monthsNumber + (Number.isFinite(setupNumber) ? setupNumber : 0)
    : null;

  const setUsage = (next: ProductUsageType) => setProductForm((prev) => ({
    ...prev,
    usage_type: next,
    // Sadece Kiralama'da abonelik olamaz.
    is_recurring: next === 'rental' ? false : prev.is_recurring,
    billing_period: next === 'rental' ? 'one_time' : prev.billing_period,
  }));

  const startNew = () => { setSelectedProductId(''); setProductForm(emptyProduct); setMsg(null); };
  const okMsg = Boolean(msg && /kaydedildi|silindi/.test(msg));

  return (
    <main style={{ display: 'grid', gap: 14 }}>
      <header style={{ ...surface, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--text)' }}>Ürün Kataloğu</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 13.5 }}>
            Satış, Teklif ve Forecast ekranlarının ortak ürün ve fiyat kaynağı{priceListVersion ? ` · Fiyat listesi ${priceListVersion}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={startNew} style={primaryButton}>+ Yeni Ürün</button>
        </div>
      </header>

      <section className="quote-catalog-kpis" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {([
          ['all', 'Aktif ürün', products.length - usageCounts.passive, '#4f46e5'],
          ['both', USAGE_LABEL.both, usageCounts.both, USAGE_COLOR.both],
          ['sale', USAGE_LABEL.sale, usageCounts.sale, USAGE_COLOR.sale],
          ['rental', USAGE_LABEL.rental, usageCounts.rental, USAGE_COLOR.rental],
        ] as const).map(([key, title, value, color]) => (
          <button key={key} type="button" onClick={() => setListFilter(key)} style={{ ...kpiCard, boxShadow: `inset 3px 0 0 ${color}`, outline: listFilter === key ? `2px solid ${color}` : 'none', outlineOffset: -2 }}>
            <span style={kpiLabel}>{title}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</span>
          </button>
        ))}
      </section>

      {msg ? (
        <div role="status" style={{ ...surface, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, color: okMsg ? 'var(--chip-green-color)' : 'var(--chip-red-color)', background: okMsg ? 'var(--chip-green-bg)' : 'var(--chip-red-bg)' }}>{msg}</div>
      ) : null}

      <section className="quote-catalog-layout" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(300px, 0.85fr) 1.15fr', alignItems: 'start' }}>
        <div style={{ ...surface, display: 'grid', gap: 10, alignContent: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={sectionTitle}>Ürünler <span style={countBadge}>{visibleProducts.length}</span></h2>
            <div role="tablist" aria-label="Ürün filtresi" style={segment}>
              {([['all', 'Tümü'], ['both', 'İkisi'], ['sale', 'Satış'], ['rental', 'Kiralama'], ['passive', 'Pasif']] as const).map(([key, text]) => (
                <button key={key} type="button" role="tab" aria-selected={listFilter === key} onClick={() => setListFilter(key)} style={{ ...segmentButton, ...(listFilter === key ? segmentActive : null) }}>{text}</button>
              ))}
            </div>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kod, ad veya kategori ara…" aria-label="Ürün ara" style={input} />
          <div style={{ display: 'grid', gap: 6, maxHeight: 680, overflowY: 'auto', paddingRight: 2 }}>
            {loading ? <div style={emptyText}>Yükleniyor…</div> : null}
            {!loading && !visibleProducts.length ? <div style={emptyText}>Bu filtrede ürün yok.</div> : null}
            {visibleProducts.map((product) => {
              const usage = normalizeUsageType(product.usage_type);
              const ruleCount = ruleCountByProduct.get(product.id) ?? 0;
              const showsSale = usage !== 'rental';
              const showsRent = usage !== 'sale' && !product.is_recurring && product.rental_monthly_price;
              return (
                <button key={product.id} type="button" onClick={() => setSelectedProductId(product.id)} style={{ ...productRow, ...(selectedProductId === product.id ? selectedRow : null), opacity: product.is_active ? 1 : 0.6 }}>
                  <span aria-hidden style={{ ...iconTile, background: `${USAGE_COLOR[usage]}18`, color: USAGE_COLOR[usage] }}>{initials(product.name)}</span>
                  <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 3 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-3)', fontSize: 11.5, minWidth: 0 }}>
                      <span style={{ ...pill, ...usagePill[usage], minHeight: 18, fontSize: 10.5 }}>{USAGE_SHORT[usage]}</span>
                      {!product.is_active ? <span style={{ ...pill, ...passivePill, minHeight: 18, fontSize: 10.5 }}>Pasif</span> : null}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.code}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 2, justifyItems: 'end', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {showsRent ? <span style={{ color: USAGE_COLOR.rental }}>${Number(product.rental_monthly_price).toLocaleString('tr-TR')}<span style={{ fontWeight: 600, opacity: 0.75 }}>/ay</span></span> : null}
                    {showsSale ? <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>{product.is_recurring ? 'hizmet' : ruleCount ? `${ruleCount} barem` : 'barem yok'}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ ...surface, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span aria-hidden style={{ ...iconTile, width: 52, height: 52, fontSize: 17, borderRadius: 14, background: `${USAGE_COLOR[formUsage]}18`, color: USAGE_COLOR[formUsage] }}>{initials(productForm.name || 'Yeni')}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ ...sectionTitle, fontSize: 20 }}>{productForm.id ? productForm.name || 'Ürün' : 'Yeni ürün'}</h2>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ ...pill, ...usagePill[formUsage] }}>{USAGE_LABEL[formUsage]}</span>
                  <span style={{ ...pill, ...(productForm.is_active ? { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: 'var(--chip-green-bd)' } : passivePill) }}>{productForm.is_active ? 'Aktif' : 'Pasif'}</span>
                  {productForm.code ? <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 700 }}>{productForm.code} · {productForm.category}</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {rentalAllowed ? <MiniStat label="Aylık kira" value={rentNumber > 0 ? money(rentNumber) : '—'} color={USAGE_COLOR.rental} /> : null}
                {rentalAllowed ? <MiniStat label="Taahhüt" value={monthsNumber > 0 && !monthsInvalid ? `${monthsNumber} ay` : '—'} color={USAGE_COLOR.rental} /> : null}
                {saleAllowed && !productForm.is_recurring ? <MiniStat label="Satış başlangıç" value={selectedProductRules.length && productForm.id ? money(Math.min(...selectedProductRules.map((r) => r.unit_price))) : '—'} color={USAGE_COLOR.sale} /> : null}
              </div>
            </div>

            <div role="tablist" aria-label="Ürün bölümleri" style={{ ...segment, alignSelf: 'start', justifySelf: 'start' }}>
              {([['general', 'Genel bilgi'], ['pricing', 'Fiyatlandırma']] as const).map(([key, text]) => (
                <button key={key} type="button" role="tab" aria-selected={editorTab === key} onClick={() => setEditorTab(key)} style={{ ...segmentButton, minHeight: 32, padding: '0 14px', fontSize: 13, ...(editorTab === key ? segmentActive : null) }}>{text}</button>
              ))}
            </div>

            {editorTab === 'general' ? <>
            <fieldset style={fieldset}>
              <legend style={legend}>1 · Kullanım tipi</legend>
              <div role="radiogroup" className="quote-catalog-usage mobile-grid-stack" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                {(['both', 'sale', 'rental'] as ProductUsageType[]).map((key) => (
                  <button key={key} type="button" role="radio" aria-checked={formUsage === key} onClick={() => setUsage(key)} style={{ ...usageCard, ...(formUsage === key ? { borderColor: USAGE_COLOR[key], boxShadow: `inset 0 0 0 1px ${USAGE_COLOR[key]}`, background: 'var(--card)' } : null) }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: formUsage === key ? USAGE_COLOR[key] : 'var(--text)' }}>{USAGE_LABEL[key]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.35 }}>{USAGE_HINT[key]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset style={fieldset}>
              <legend style={legend}>2 · Ürün bilgisi</legend>
              <div className="mobile-grid-stack" style={grid2}>
                <label style={field}><span style={label}>Kod *</span><input value={productForm.code} onChange={(e) => setProductForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} style={input} placeholder="A910SE+S210+CRADLE" /></label>
                <label style={field}><span style={label}>Ürün adı *</span><input value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} style={input} placeholder="PAX A910SE + S210 + Cradle" /></label>
                <label style={field}>
                  <span style={label}>Kategori</span>
                  <input list="quote-catalog-categories" value={productForm.category} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} style={input} placeholder="EFT POS" />
                  <datalist id="quote-catalog-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </label>
                <label style={field}>
                  <span style={label}>Ürün tipi</span>
                  <select value={productForm.product_type} onChange={(e) => setProductForm((prev) => ({ ...prev, product_type: e.target.value as Product['product_type'] }))} style={input}>
                    <option value="device">Cihaz</option>
                    <option value="bundle">Set (birden çok cihaz)</option>
                    <option value="peripheral">Aksesuar / çevre birimi</option>
                    <option value="recurring">Hizmet</option>
                  </select>
                </label>
                <label style={field}><span style={label}>Birim</span><input value={productForm.unit_label} onChange={(e) => setProductForm((prev) => ({ ...prev, unit_label: e.target.value }))} style={input} placeholder="adet" /></label>
                <label style={field}><span style={label}>Para birimi</span><input value={productForm.currency} onChange={(e) => setProductForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} style={input} placeholder="USD" /></label>
              </div>
              <label style={field}><span style={label}>Açıklama</span><input value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} style={input} placeholder="Teklifte görünen kısa açıklama" /></label>
              <label style={field}><span style={label}>Teknik özellikler</span><textarea value={productForm.specsText} onChange={(e) => setProductForm((prev) => ({ ...prev, specsText: e.target.value }))} style={textarea} placeholder={'Her satıra bir özellik\nAndroid 12\nIP67'} /></label>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ ...checkLabel, opacity: formUsage === 'rental' ? 0.5 : 1 }} title={formUsage === 'rental' ? 'Sadece Kiralama ürünü abonelik olamaz' : undefined}>
                  <input type="checkbox" disabled={formUsage === 'rental'} checked={productForm.is_recurring} onChange={(e) => setProductForm((prev) => ({ ...prev, is_recurring: e.target.checked, billing_period: e.target.checked ? 'monthly' : 'one_time' }))} /> Aylık hizmet (abonelik)
                </label>
                <label style={checkLabel}><input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Aktif</label>
                <label style={{ ...checkLabel, gap: 6 }}>Liste sırası <input type="number" value={productForm.sort_order} onChange={(e) => setProductForm((prev) => ({ ...prev, sort_order: Number(e.target.value || 100) }))} style={{ ...input, width: 80, minHeight: 34 }} /></label>
              </div>
            </fieldset>

            </> : null}

            {editorTab === 'pricing' ? (
            <fieldset style={{ ...fieldset, ...rentalPanel, ...(rentalAllowed ? null : { opacity: 0.6 }) }}>
              <legend style={{ ...legend, color: 'var(--chip-gold-color)' }}>3 · Kiralama koşulları</legend>
              {rentalAllowed ? (
                <>
                  <div className="mobile-grid-stack" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                    <label style={field}>
                      <span style={label}>Aylık kira bedeli (USD){formUsage === 'rental' ? ' *' : ''}</span>
                      <input type="number" min={0} step="0.01" value={productForm.rental_monthly_price} onChange={(e) => setProductForm((prev) => ({ ...prev, rental_monthly_price: e.target.value }))} style={{ ...input, ...(rentalMissing ? { borderColor: '#f87171' } : null) }} placeholder={formUsage === 'rental' ? 'örn. 15' : 'Boş = kiralanamaz'} />
                    </label>
                    <label style={field}>
                      <span style={label}>Min. taahhüt (ay)</span>
                      <input type="number" min={1} max={120} step={1} value={productForm.rental_min_months} onChange={(e) => setProductForm((prev) => ({ ...prev, rental_min_months: e.target.value }))} style={{ ...input, ...(monthsInvalid ? { borderColor: '#f87171' } : null) }} placeholder="örn. 12" />
                    </label>
                    <label style={field}>
                      <span style={label}>Kurulum bedeli (USD, tek sefer)</span>
                      <input type="number" min={0} step="0.01" value={productForm.rental_setup_fee} onChange={(e) => setProductForm((prev) => ({ ...prev, rental_setup_fee: e.target.value }))} style={input} placeholder="Boş = yok" />
                    </label>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                    Tutarlar KDV hariç, cihaz başına.{' '}
                    {rentalTotal != null
                      ? <>Taahhüt toplamı: <b style={{ color: 'var(--text)' }}>{money(rentalTotal)}</b> / cihaz ({productForm.rental_min_months} ay × {money(rentNumber)}{setupNumber > 0 ? ` + ${money(setupNumber)} kurulum` : ''}).</>
                      : 'Kiralama satırında aylık kira buradan otomatik gelir.'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {productForm.is_recurring ? 'Aylık hizmet ürünü kiralanmaz.' : 'Sadece Satış ürünü: kiralamaya kapalı, kira bilgisi kaydedilmez.'}
                </div>
              )}
            </fieldset>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: formError ? 'var(--chip-red-color)' : 'var(--text-3)' }}>
                {formError ?? (productForm.id ? 'Değişiklik yeni kayıtlara uygulanır; mevcut teklif ve satışlar değişmez.' : 'Kaydedince Satış, Teklif ve Forecast listelerinde görünür.')}
              </span>
              <button type="button" onClick={saveProduct} disabled={savingProduct || Boolean(formError)} style={{ ...primaryButton, opacity: savingProduct || formError ? 0.6 : 1 }}>
                {savingProduct ? 'Kaydediliyor…' : productForm.id ? 'Değişiklikleri kaydet' : 'Ürünü ekle'}
              </button>
            </div>
          </div>

          {editorTab === 'pricing' ? (
          <div style={{ ...surface, display: 'grid', gap: 12, boxShadow: `inset 3px 0 0 ${USAGE_COLOR.sale}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2 style={sectionTitle}>Satış fiyat baremleri {selectedProduct && saleAllowed && !productForm.is_recurring ? <span style={countBadge}>{selectedProductRules.length}</span> : null}</h2>
              {selectedProduct ? <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 700 }}>{selectedProduct.code}</span> : null}
            </div>
            {!selectedProduct || !productForm.id ? (
              <div style={emptyText}>Barem eklemek için önce ürünü kaydedin ya da listeden seçin.</div>
            ) : !saleAllowed ? (
              <div style={{ ...emptyText, color: 'var(--chip-gold-color)' }}>Sadece Kiralama ürünü: satış baremi kullanılmaz, fiyat kiralama koşullarından gelir.</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Adet aralığına göre cihaz başı satış fiyatı (USD, KDV hariç). Barem yoksa satışta fiyat elle girilir.</div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        {['Adet aralığı', 'Birim fiyat', ''].map((head) => <th key={head || 'actions'} style={tableHead}>{head}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedProductRules.length ? <tr><td colSpan={3} style={{ ...tableCell, color: 'var(--text-3)' }}>Barem yok.</td></tr> : null}
                      {selectedProductRules.map((rule) => (
                        <tr key={rule.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={tableCell}>{rule.min_qty} – {rule.max_qty ?? '∞'} adet</td>
                          <td style={{ ...tableCell, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(rule.unit_price)}</td>
                          <td style={{ ...tableCell, textAlign: 'right' }}><button type="button" onClick={() => void deleteRule(rule.id)} style={dangerButton}>Sil</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="quote-catalog-rule-grid mobile-grid-stack" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3,minmax(0,1fr)) auto', alignItems: 'end' }}>
                  <label style={field}><span style={label}>Min adet</span><input type="number" min={1} value={ruleForm.min_qty} onChange={(e) => setRuleForm((prev) => ({ ...prev, min_qty: Number(e.target.value || 1) }))} style={input} /></label>
                  <label style={field}><span style={label}>Max adet</span><input type="number" min={1} value={ruleForm.max_qty} onChange={(e) => setRuleForm((prev) => ({ ...prev, max_qty: e.target.value }))} style={input} placeholder="Boş = sınırsız" /></label>
                  <label style={field}><span style={label}>Birim fiyat (USD)</span><input type="number" min={0} step="0.01" value={ruleForm.unit_price} onChange={(e) => setRuleForm((prev) => ({ ...prev, unit_price: e.target.value }))} style={input} placeholder="704" /></label>
                  <button type="button" onClick={saveRule} disabled={savingRule} style={primaryButton}>{savingRule ? '…' : 'Barem ekle'}</button>
                </div>
              </>
            )}
          </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

type ListFilter = 'all' | ProductUsageType | 'passive';

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toLocaleUpperCase('tr-TR');
}

function MiniStat({ label: text, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, padding: '8px 12px', minWidth: 92, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', boxShadow: `inset 3px 0 0 ${color}` }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{text}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

const iconTile: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 38, height: 38, borderRadius: 10, fontSize: 13, fontWeight: 800, letterSpacing: '.02em' };
const USAGE_LABEL = PRODUCT_USAGE_LABELS;
const USAGE_SHORT: Record<ProductUsageType, string> = { both: 'Satış + Kira', sale: 'Sadece Satış', rental: 'Sadece Kira' };
const USAGE_HINT: Record<ProductUsageType, string> = {
  both: 'Satışta barem fiyatı, kiralamada aylık kira kullanılır.',
  sale: 'Yalnız satış olarak seçilir; kiralamaya kapalı.',
  rental: 'Yalnız kiralama olarak seçilir; aylık kira zorunlu.',
};
const USAGE_COLOR: Record<ProductUsageType, string> = { both: '#0e7490', sale: '#4338ca', rental: '#b45309' };

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow)' };
const kpiCard: CSSProperties = { display: 'grid', gap: 4, textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit' };
const kpiLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)' };
const sectionTitle: CSSProperties = { margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800, color: 'var(--text)' };
const countBadge: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 20, padding: '0 8px', borderRadius: 999, background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)', fontSize: 12, fontWeight: 800 };
const segment: CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', padding: 3, gap: 2, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' };
const segmentButton: CSSProperties = { minHeight: 26, padding: '0 9px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const segmentActive: CSSProperties = { background: 'var(--card)', color: 'var(--text)', boxShadow: '0 1px 2px rgba(15,23,42,.12)' };
const productRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit' };
const selectedRow: CSSProperties = { borderColor: '#6366f1', boxShadow: 'inset 3px 0 0 #6366f1', background: 'var(--chip-indigo-bg)' };
const usageCard: CSSProperties = { display: 'grid', gap: 4, alignContent: 'start', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontFamily: 'inherit' };
const fieldset: CSSProperties = { display: 'grid', gap: 10, margin: 0, padding: 0, border: 'none', minWidth: 0 };
const rentalPanel: CSSProperties = { padding: '12px 14px', borderRadius: 12, border: '1px solid var(--chip-gold-bd)', background: 'var(--chip-gold-bg)' };
const legend: CSSProperties = { padding: 0, marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)', float: 'left', width: '100%' };
const emptyText: CSSProperties = { padding: '14px 4px', color: 'var(--text-3)', fontSize: 13 };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: '#0e6fc7', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const dangerButton: CSSProperties = { minHeight: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--chip-red-bd)', background: 'var(--chip-red-bg)', color: 'var(--chip-red-color)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const grid2: CSSProperties = { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2,minmax(0,1fr))' };
const field: CSSProperties = { display: 'grid', gap: 5, minWidth: 0 };
const label: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' };
const input: CSSProperties = { minHeight: 38, borderRadius: 10, border: '1px solid var(--border)', padding: '0 11px', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const textarea: CSSProperties = { ...input, minHeight: 84, padding: '9px 11px', resize: 'vertical' };
const tableHead: CSSProperties = { textAlign: 'left', padding: '9px 12px', color: 'var(--text-3)', fontWeight: 700, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '9px 12px', color: 'var(--text)', fontSize: 13 };
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '0 8px', borderRadius: 999, border: '1px solid transparent', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' };
const passivePill: CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' };
const usagePill: Record<ProductUsageType, CSSProperties> = {
  both: { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' },
  sale: { background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-color)', borderColor: 'var(--chip-indigo-bd)' },
  rental: { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', borderColor: 'var(--chip-gold-bd)' },
};
const checkLabel: CSSProperties = { display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--text)', fontWeight: 700, fontSize: 13 };
