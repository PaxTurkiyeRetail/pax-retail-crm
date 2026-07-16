'use client';

import { useEffect, useMemo, useState } from 'react';

import { appToast } from '@/lib/app-toast';

type Product = { id: string; code: string; name: string; category: string; product_type?: string };
type Option = { label: string; value: string };
type MonthOption = { label: string; value: number };
type ForecastLine = {
  id: string;
  product_code_snapshot: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  forecast_year: number;
  forecast_month: number;
  forecast_label: string;
  sales_channel: string;
  probability: number;
  note: string | null;
};
type CustomerRow = {
  musteri_id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  entegrasyon_tipi: string | null;
  hasForecast: boolean;
  forecastCount: number;
  totalQuantity: number;
  weightedQuantity: number;
  latestForecastLabel: string | null;
  forecasts: ForecastLine[];
};
type Summary = {
  totalCustomers: number;
  enteredCustomers: number;
  missingCustomers: number;
  completionRate: number;
  totalQuantity: number;
  weightedQuantity: number;
};
type OptionsPayload = {
  products: Product[];
  salesChannels: Option[];
  probabilities: Option[];
  months: MonthOption[];
  years: number[];
};

type ForecastDraftLine = {
  uid: string;
  productId: string;
  quantity: string;
  forecastMonth: string;
  forecastYear: string;
  salesChannel: string;
  probability: string;
  note: string;
};

const EMPTY_SUMMARY: Summary = { totalCustomers: 0, enteredCustomers: 0, missingCustomers: 0, completionRate: 0, totalQuantity: 0, weightedQuantity: 0 };
const EMPTY_OPTIONS: OptionsPayload = { products: [], salesChannels: [], probabilities: [], months: [], years: [] };

function numberFormat(value: number) {
  return Number(value || 0).toLocaleString('tr-TR');
}

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function draftUid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyDraftLine(options: OptionsPayload, source?: Partial<ForecastDraftLine>): ForecastDraftLine {
  return {
    uid: draftUid(),
    productId: source?.productId ?? options.products[0]?.id ?? '',
    quantity: source?.quantity ?? '1',
    forecastMonth: source?.forecastMonth ?? String(currentMonth()),
    forecastYear: source?.forecastYear ?? String(options.years[0] ?? currentYear()),
    salesChannel: source?.salesChannel ?? options.salesChannels[0]?.value ?? '',
    probability: source?.probability ?? options.probabilities[0]?.value ?? '30',
    note: source?.note ?? '',
  };
}

export default function ForecastClient() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [options, setOptions] = useState<OptionsPayload>(EMPTY_OPTIONS);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [draftLines, setDraftLines] = useState<ForecastDraftLine[]>(() => [emptyDraftLine(EMPTY_OPTIONS)]);
  const [openCustomerId, setOpenCustomerId] = useState('');

  const loadOptions = async () => {
    const res = await fetch('/api/forecast/options', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Forecast seçenekleri alınamadı.');
    const payload = { ...EMPTY_OPTIONS, ...json } as OptionsPayload;
    setOptions(payload);
    setDraftLines((prev) => {
      const sourceLines = prev.length ? prev : [emptyDraftLine(payload)];
      return sourceLines.map((line) => ({
        ...emptyDraftLine(payload),
        ...line,
        productId: line.productId || payload.products[0]?.id || '',
        salesChannel: line.salesChannel || payload.salesChannels[0]?.value || '',
        probability: line.probability || payload.probabilities[0]?.value || '30',
        forecastYear: line.forecastYear || String(payload.years[0] ?? currentYear()),
      }));
    });
  };

  const loadRows = async () => {
    setLoading(true);
    setMessage(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    try {
      const res = await fetch(`/api/forecast/list?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Forecast listesi alınamadı.');
      setOnboarding(Boolean(json.onboardingNeeded));
      setRows(json.rows ?? []);
      setSummary({ ...EMPTY_SUMMARY, ...(json.summary ?? {}) });
      setTotal(Number(json.total ?? 0));
      setOwnerName(String(json.ownerName ?? ''));
      setScope(json.scope === 'all' ? 'all' : 'own');
      if (json.message && json.message !== 'forecast_module_not_setup') setMessage(json.message);
    } catch (error: any) {
      setRows([]);
      setMessage(error?.message || 'Forecast listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions().catch((error) => setMessage(error?.message || 'Forecast seçenekleri alınamadı.'));
  }, []);

  useEffect(() => {
    void loadRows();
  }, [q, status, year, month, page, pageSize]);

  useEffect(() => { setPage(1); }, [q, status, year, month, pageSize]);

  const selectedCustomer = useMemo(() => rows.find((row) => row.musteri_id === openCustomerId) ?? null, [rows, openCustomerId]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const forecastPreview = useMemo(() => {
    if (draftLines.length > 1) return `${draftLines.length} forecast satırı`;
    const line = draftLines[0];
    const monthLabel = options.months.find((item) => String(item.value) === line?.forecastMonth)?.label ?? '';
    return monthLabel && line?.forecastYear ? `${monthLabel} ${line.forecastYear}` : '-';
  }, [options.months, draftLines]);

  function openForm(customer: CustomerRow) {
    setOpenCustomerId(customer.musteri_id);
    setDraftLines([emptyDraftLine(options)]);
  }

  function updateDraftLine(uid: string, patch: Partial<ForecastDraftLine>) {
    setDraftLines((prev) => prev.map((line) => (line.uid === uid ? { ...line, ...patch } : line)));
  }

  function addDraftLine() {
    setDraftLines((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        emptyDraftLine(options, {
          forecastMonth: last?.forecastMonth,
          forecastYear: last?.forecastYear,
          salesChannel: last?.salesChannel,
          probability: last?.probability,
        }),
      ];
    });
  }

  function removeDraftLine(uid: string) {
    setDraftLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.uid !== uid)));
  }

  async function saveForecast() {
    if (!selectedCustomer) return;

    const invalidLine = draftLines.find((line) => !line.productId || Number(line.quantity) <= 0 || !line.forecastMonth || !line.forecastYear || !line.salesChannel || !line.probability);
    if (invalidLine) {
      const msg = 'Tüm forecast satırlarında ürün, adet, dönem, satış kanalı ve gerçekleşme oranı dolu olmalı.';
      setMessage(msg);
      appToast.error('Eksik forecast satırı', msg);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/forecast/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.musteri_id,
          items: draftLines.map((line) => ({
            product_id: line.productId,
            quantity: Number(line.quantity),
            forecast_month: Number(line.forecastMonth),
            forecast_year: Number(line.forecastYear),
            sales_channel: line.salesChannel,
            probability: Number(line.probability),
            note: line.note,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Forecast kaydedilemedi.');
      const savedCount = Number(json?.count ?? draftLines.length);
      appToast.success('Forecast kaydedildi', `${selectedCustomer.musteri} için ${savedCount} ürün satırı eklendi.`);
      setOpenCustomerId('');
      setDraftLines([emptyDraftLine(options)]);
      await loadRows();
    } catch (error: any) {
      const msg = error?.message || 'Forecast kaydedilemedi.';
      setMessage(msg);
      appToast.error('Forecast kaydedilemedi', msg);
    } finally {
      setSaving(false);
    }
  }

  const cards = [
    { label: scope === 'all' ? 'Tüm Portföy' : 'Benim Portföyüm', value: numberFormat(summary.totalCustomers), hint: scope === 'all' ? 'Admin görünümünde tüm müşteri havuzu' : (ownerName ? `${ownerName} portföyü` : 'Giriş yapan kullanıcı'), tone: 'slate' },
    { label: 'Forecast Girilen', value: numberFormat(summary.enteredCustomers), hint: 'Kayıt tamamlanan müşteri', tone: 'green' },
    { label: 'Aksiyon Bekleyen', value: numberFormat(summary.missingCustomers), hint: 'Forecast girişi bekleyen müşteri', tone: 'red' },
    { label: 'Tamamlanma', value: `%${summary.completionRate}`, hint: 'Portföy kapsama oranı', tone: 'violet' },
    { label: 'Toplam Adet', value: numberFormat(summary.totalQuantity), hint: 'Seçili filtre toplamı', tone: 'blue' },
  ];

  return (
    <main className="forecast-page premium-workspace">
      <section className="pax-hero forecast-hero">
        <span className="pax-hero-eyebrow">CRM Forecast</span>
        <h1 className="pax-hero-title">Account Forecast Girişi</h1>
        <p className="pax-hero-description">Account bazlı ürün forecast akışını tek ekranda yönetin. Admin ve Super Admin tüm portföyü görür; satış ekipleri kendi müşteri havuzunda ürün, adet, dönem, satış kanalı ve gerçekleşme oranını hızlıca işler.</p>
        <div className="pax-hero-stats forecast-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Tamamlanma</div><div className="pax-hero-stat-value">%{summary.completionRate}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Eksik</div><div className="pax-hero-stat-value">{summary.missingCustomers}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Toplam Adet</div><div className="pax-hero-stat-value">{numberFormat(summary.totalQuantity)}</div></div>
        </div>
      </section>

      {onboarding ? (
        <section className="premium-alert warning">
          <strong>Forecast modülü için SQL kurulumu bekleniyor.</strong>
          <span>Önce <code>sql/forecast_module_setup.sql</code> dosyasını PostgreSQL üzerinde çalıştırın.</span>
        </section>
      ) : null}

      {message ? <section className="premium-alert danger">{message}</section> : null}

      <section className="premium-kpi-grid forecast-kpi-grid">
        {cards.map((card) => (
          <article key={card.label} className={`premium-kpi-card tone-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="premium-filter-card">
        <div className="premium-section-head compact">
          <div>
            <span>Filtreler</span>
            <h2>Portföy görünümünü daralt</h2>
          </div>
          <button type="button" className="premium-btn secondary" onClick={() => { setQ(''); setStatus(''); setYear(''); setMonth(''); setPage(1); }}>Temizle</button>
        </div>
        <div className="premium-filter-grid forecast-filter-grid">
          <label className="premium-field"><span>Arama</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Müşteri, sektör veya account ara" /></label>
          <label className="premium-field"><span>Forecast Durumu</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tümü</option><option value="entered">Forecast girilenler</option><option value="missing">Forecast eksikler</option></select></label>
          <label className="premium-field"><span>Ay</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Tüm Aylar</option>{options.months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="premium-field"><span>Yıl</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Tüm Yıllar</option>{options.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="premium-field"><span>Sayfa</span><select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} / sayfa</option>)}</select></label>
        </div>
      </section>

      {selectedCustomer ? (
        <section className="premium-drawer-card forecast-entry-card">
          <div className="premium-section-head forecast-entry-head">
            <div>
              <span>Forecast ekleniyor</span>
              <h2>{selectedCustomer.musteri}</h2>
              <p>Tek kayıtta birden fazla ürün satırı ekleyebilirsiniz. Dönem görünümü: <strong>{forecastPreview}</strong></p>
            </div>
            <button type="button" className="premium-btn secondary" onClick={() => setOpenCustomerId('')}>Kapat</button>
          </div>

          <div className="forecast-entry-lines">
            {draftLines.map((line, index) => (
              <article key={line.uid} className="forecast-entry-line">
                <div className="forecast-line-top">
                  <strong>Ürün Satırı {index + 1}</strong>
                  <button type="button" className="forecast-line-remove" onClick={() => removeDraftLine(line.uid)} disabled={draftLines.length <= 1}>Kaldır</button>
                </div>
                <div className="premium-filter-grid forecast-entry-grid">
                  <label className="premium-field wide"><span>Ürün</span><select value={line.productId} onChange={(event) => updateDraftLine(line.uid, { productId: event.target.value })}><option value="">Ürün seç</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}</select></label>
                  <label className="premium-field"><span>Adet</span><input type="number" min={1} value={line.quantity} onChange={(event) => updateDraftLine(line.uid, { quantity: event.target.value })} placeholder="Adet" /></label>
                  <label className="premium-field"><span>Ay</span><select value={line.forecastMonth} onChange={(event) => updateDraftLine(line.uid, { forecastMonth: event.target.value })}>{options.months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  <label className="premium-field"><span>Yıl</span><select value={line.forecastYear} onChange={(event) => updateDraftLine(line.uid, { forecastYear: event.target.value })}>{options.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label className="premium-field"><span>Satış Kanalı</span><select value={line.salesChannel} onChange={(event) => updateDraftLine(line.uid, { salesChannel: event.target.value })}>{options.salesChannels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  <label className="premium-field"><span>Gerçekleşme</span><select value={line.probability} onChange={(event) => updateDraftLine(line.uid, { probability: event.target.value })}>{options.probabilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  <label className="premium-field wide"><span>Not</span><input value={line.note} onChange={(event) => updateDraftLine(line.uid, { note: event.target.value })} placeholder="Opsiyonel not" /></label>
                </div>
              </article>
            ))}
          </div>

          <div className="forecast-entry-footer">
            <button type="button" className="premium-btn secondary" onClick={addDraftLine}>+ Ürün Satırı Ekle</button>
            <button type="button" className="premium-btn primary" onClick={saveForecast} disabled={saving || onboarding}>{saving ? 'Kaydediliyor...' : `${draftLines.length} Satırı Kaydet`}</button>
          </div>
        </section>
      ) : null}

      <section className="premium-table-card forecast-table-card">
        <div className="premium-section-head compact">
          <div>
            <span>Müşteri Listesi</span>
            <h2>Toplam {total} müşteri · Sayfa {page}/{totalPages}</h2>
          </div>
          <div className="premium-actions">
            <button type="button" className="premium-btn secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Önceki</button>
            <button type="button" className="premium-btn secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Sonraki</button>
          </div>
        </div>

        <div className="forecast-completion-strip">
          <div className="forecast-completion-top">
            <span>Forecast kapsama oranı</span>
            <strong>%{summary.completionRate}</strong>
          </div>
          <div className="forecast-completion-track" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, summary.completionRate))}%` }} />
          </div>
        </div>

        <div className="forecast-list-head" aria-hidden="true">
          <span>Müşteri</span>
          <span>Account</span>
          <span>Mevcut Forecast</span>
          <span>Adet</span>
          <span>Aksiyon</span>
        </div>

        <div className="forecast-list-wrap">
          {!loading && !rows.length ? <div className="premium-empty-cell forecast-empty-card">Kayıt bulunamadı.</div> : null}
          {rows.map((row) => (
            <article key={row.musteri_id} className={`forecast-list-row ${row.hasForecast ? 'entered' : 'missing'}`}>
              <div className="forecast-list-col customer">
                <strong>{row.musteri}</strong>
                <small>{row.sektor || '-'} {row.entegrasyon_tipi ? `· ${row.entegrasyon_tipi}` : ''}</small>
              </div>
              <div className="forecast-list-col account">
                <span className="forecast-col-label">Account</span>
                <strong>{row.sorumlu || '-'}</strong>
              </div>
              <div className="forecast-list-col details">
                <span className="forecast-col-label">Mevcut Forecast</span>
                <div className="forecast-chip-list">
                  {row.forecasts.slice(0, 4).map((line) => (
                    <span key={line.id} className="forecast-soft-chip">{line.product_code_snapshot || line.product_name_snapshot} · {line.quantity} adet · {line.forecast_label} · %{line.probability}</span>
                  ))}
                  {row.forecasts.length > 4 ? <span className="forecast-soft-chip">+{row.forecasts.length - 4}</span> : null}
                  {!row.forecasts.length ? <span className="forecast-muted">Forecast yok</span> : null}
                </div>
              </div>
              <div className="forecast-list-col qty">
                <span className="forecast-col-label">Adet</span>
                <strong>{numberFormat(row.totalQuantity)}</strong>
              </div>
              <div className="forecast-list-col action">
                <button type="button" className="premium-btn primary compact" onClick={() => openForm(row)}>Forecast Ekle</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
