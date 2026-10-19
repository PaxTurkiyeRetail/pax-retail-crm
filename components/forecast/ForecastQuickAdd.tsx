'use client';

// CRM havuzundan forecast'e hızlı ekleme (045). Firma satırına gömülür: model · adet · ay (+ yıl, tip).
// Ayrı API YOK: mevcut POST /api/forecast/create kullanılır (yetki, portföy, katalog ve fiyat kuralları orada).
// Seçenekler /api/forecast/options'tan bir kez alınır; `options` prop'u verilirse istek atılmaz
// (ör. tabloda çok satır varsa üst bileşen bir kez çekip paylaştırır).

import { useEffect, useState, type CSSProperties } from 'react';

export type ForecastQuickAddOptions = {
  products: Array<{ id: string; code: string; name: string; rental_monthly_price?: number | null }>;
  salesChannels: Array<{ label: string; value: string }>;
  probabilities: Array<{ label: string; value: string }>;
  months: Array<{ label: string; value: number }>;
  years: number[];
};

type Props = {
  customerId: string;
  customerName?: string;
  options?: ForecastQuickAddOptions | null;
  defaultYear?: number;
  /** Kayıt sonrası (ör. paneli yenile). */
  onSaved?: (row: unknown) => void;
  compact?: boolean;
};

let optionsCache: Promise<ForecastQuickAddOptions> | null = null;
export function loadForecastQuickAddOptions(): Promise<ForecastQuickAddOptions> {
  optionsCache ??= fetch('/api/forecast/options', { cache: 'no-store' })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Forecast seçenekleri alınamadı.');
      return json as ForecastQuickAddOptions;
    })
    .catch((error) => { optionsCache = null; throw error; });
  return optionsCache;
}

export default function ForecastQuickAdd({ customerId, customerName, options: given, defaultYear, onSaved, compact }: Props) {
  const [options, setOptions] = useState<ForecastQuickAddOptions | null>(given ?? null);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(defaultYear ?? new Date().getFullYear()));
  const [saleType, setSaleType] = useState<'sale' | 'rental'>('sale');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (given) { setOptions(given); return; }
    let alive = true;
    loadForecastQuickAddOptions().then((o) => { if (alive) setOptions(o); }).catch((e) => alive && setMsg({ ok: false, text: e.message }));
    return () => { alive = false; };
  }, [given]);

  async function save() {
    if (!options) return;
    const qty = Math.floor(Number(quantity));
    if (!productId || !(qty > 0)) { setMsg({ ok: false, text: 'Model ve adet girin.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/forecast/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          items: [{
            product_id: productId,
            quantity: qty,
            forecast_month: Number(month),
            forecast_year: Number(year),
            sales_channel: options.salesChannels[0]?.value ?? '',
            probability: Number(options.probabilities[0]?.value ?? 30),
            sale_type: saleType,
            include_in_retail_plan: true,
            note: 'Retail panelinden hızlı ekleme',
          }],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Forecast kaydedilemedi.');
      setMsg({ ok: true, text: `${customerName ?? 'Firma'}: ${qty} adet eklendi.` });
      setQuantity('');
      onSaved?.(json?.row ?? null);
    } catch (error: any) {
      setMsg({ ok: false, text: error?.message || 'Forecast kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !options;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ ...field, minWidth: compact ? 110 : 160 }} disabled={disabled} aria-label="Model">
          <option value="">{options ? 'Model' : 'Yükleniyor…'}</option>
          {(options?.products ?? []).map((p) => <option key={p.id} value={p.id}>{p.code || p.name}</option>)}
        </select>
        <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))} placeholder="Adet" style={{ ...field, width: 72 }} disabled={disabled} aria-label="Adet" />
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={field} disabled={disabled} aria-label="Ay">
          {(options?.months ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {!compact ? (
          <select value={year} onChange={(e) => setYear(e.target.value)} style={field} disabled={disabled} aria-label="Yıl">
            {(options?.years ?? [Number(year)]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : null}
        <select value={saleType} onChange={(e) => setSaleType(e.target.value === 'rental' ? 'rental' : 'sale')} style={field} disabled={disabled} aria-label="Satış tipi">
          <option value="sale">Satış</option>
          <option value="rental">Kiralama</option>
        </select>
        <button type="button" onClick={() => void save()} disabled={disabled} style={button}>{busy ? '…' : '+ Forecast'}</button>
      </div>
      {msg ? <small style={{ color: msg.ok ? 'var(--chip-green-color)' : 'var(--chip-gold-color)', fontWeight: 700 }}>{msg.text}</small> : null}
    </div>
  );
}

const field: CSSProperties = { minHeight: 32, borderRadius: 10, border: '1px solid var(--border)', padding: '0 8px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 };
const button: CSSProperties = { minHeight: 32, padding: '0 12px', borderRadius: 10, border: 'none', background: '#0e6fc7', color: '#fff', fontWeight: 800, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' };
