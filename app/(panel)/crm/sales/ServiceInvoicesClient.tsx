'use client';

// HİZMET FATURALARI sekmesi — Satışlar › Hizmet Faturaları (migration 032, 14.09.2026).
// Furkan'ın talebi (11.09), Çağdaş Bey onayı, Sinan'ın tarifi: "hizmet ve entegrasyon kullanan
// firmalar için fatura kesmek üzere kayıt; ayrı sekme; hizmet türü, firma, kalemler, tutar TL/USD,
// ay (geçmişe de girilebilsin), adet. Her ay kesilmesi zorunlu."
//   * Kayıt = firma + ay + para birimi + kalemler (hizmet × adet × birim fiyat). Tutar kalemlerden.
//   * Cihaz satışlarından AYRI tablo; USD cirosuna karışmaz. Toplamlar para birimine göre ayrı.
//   * "Eksik firmalar": geçen ay faturası olup seçili ayda faturası olmayanlar — tek tıkla
//     geçen ayın kalemleriyle yeni fatura penceresi açılır.
//   * Hizmet kalemi listesi Liste Yönetimleri › Hizmet Kalemleri; satışçı listesi OWNER_ORDER.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import SalesReportDownload from '@/components/sales/SalesReportDownload';
import {
  computeLineTotals,
  currentPeriod,
  fmtServiceMoney,
  periodInputValue,
  periodLabel,
  previousPeriod,
  type CurrencyTotals,
  type ServiceCurrency,
  type ServiceInvoiceRow,
  type ServiceInvoiceSummary,
} from '@/lib/sales/service-invoices-shared';

type Options = {
  services: Array<{ value: string; label: string }>;
  owners: string[];
  currencies: Array<{ value: ServiceCurrency; label: string; symbol: string }>;
  customers: Array<{ id: string; musteri: string; sorumlu: string | null }>;
};

type DraftLine = { uid: string; service_key: string; quantity: string; unit_price: string };
type Draft = {
  id: string | null;
  customer_id: string;
  period: string;          // YYYY-MM
  currency: ServiceCurrency;
  invoice_no: string;
  invoice_date: string;
  owner_name: string;
  note: string;
  lines: DraftLine[];
};

const uid = () => Math.random().toString(36).slice(2);
const newLine = (service_key = ''): DraftLine => ({ uid: uid(), service_key, quantity: '1', unit_price: '' });
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const fmtDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};
/** "12.500,50" / "12500.5" → 12500.5 (TR ve EN yazımı). */
const parseMoney = (raw: string): number => {
  const text = String(raw ?? '').replace(/\s/g, '');
  if (!text) return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
};

function emptyDraft(period: string): Draft {
  return { id: null, customer_id: '', period: periodInputValue(period), currency: 'TRY', invoice_no: '', invoice_date: todayIso(), owner_name: '', note: '', lines: [newLine()] };
}

function draftFromRow(row: ServiceInvoiceRow): Draft {
  return {
    id: row.id,
    customer_id: row.customer_id,
    period: periodInputValue(row.period_month),
    currency: row.currency,
    invoice_no: row.invoice_no ?? '',
    invoice_date: row.invoice_date ?? '',
    owner_name: row.owner_name,
    note: row.note ?? '',
    lines: row.items.length
      ? row.items.map((item) => ({ uid: uid(), service_key: item.service_key, quantity: String(item.quantity), unit_price: String(item.unit_price) }))
      : [newLine()],
  };
}

function totalsText(totals: CurrencyTotals) {
  const parts: string[] = [];
  if (totals.TRY.count) parts.push(fmtServiceMoney(totals.TRY.amount, 'TRY'));
  if (totals.USD.count) parts.push(fmtServiceMoney(totals.USD.amount, 'USD'));
  return parts.length ? parts.join(' · ') : '—';
}

export default function ServiceInvoicesClient() {
  const [rows, setRows] = useState<ServiceInvoiceRow[]>([]);
  const [summary, setSummary] = useState<ServiceInvoiceSummary | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [period, setPeriod] = useState(() => periodInputValue(currentPeriod(todayIso())));
  const [allMonths, setAllMonths] = useState(false);
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customerFilter, setCustomerFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('period', allMonths ? 'all' : `${period}-01`);
      if (allMonths) params.set('year', period.slice(0, 4));
      if (owner) params.set('owner', owner);
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/service-invoices/list?${params.toString()}`, { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Hizmet faturaları yüklenemedi.');
      setRows(json.rows ?? []);
      setSummary(json.summary ?? null);
      setOwners(json.owners ?? []);
      setCanEdit(Boolean(json.canEdit));
      setCanCreate(Boolean(json.canCreate));
      setCanSeeAll(Boolean(json.canSeeAll));
      setMsg(null);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Hizmet faturaları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [period, allMonths, owner, status, q]);

  useEffect(() => { void load(); }, [load]);

  const ensureOptions = useCallback(async () => {
    if (options) return options;
    const res = await fetch('/api/service-invoices/options', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Seçenekler yüklenemedi.');
    const next: Options = {
      services: json.services ?? [], owners: json.owners ?? [], currencies: json.currencies ?? [],
      customers: json.customers ?? [],
    };
    setOptions(next);
    return next;
  }, [options]);

  const openCreate = async (preset?: Partial<Draft>) => {
    setMsg(null);
    try {
      await ensureOptions();
      setCustomerFilter('');
      setDraft({ ...emptyDraft(`${period}-01`), ...preset });
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Seçenekler yüklenemedi.');
    }
  };

  const openEdit = async (row: ServiceInvoiceRow) => {
    setMsg(null);
    try {
      await ensureOptions();
      setCustomerFilter('');
      setDraft(draftFromRow(row));
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Seçenekler yüklenemedi.');
    }
  };

  /** Eksik firma → geçen ayın faturasını şablon alarak yeni fatura (aynı kalemler, seçili ay). */
  const openFromMissing = async (customerId: string) => {
    try {
      const opts = await ensureOptions();
      const prev = previousPeriod(`${period}-01`);
      const res = await fetch(`/api/service-invoices/list?period=${prev}&status=active&q=`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const template = ((json.rows ?? []) as ServiceInvoiceRow[]).find((row) => row.customer_id === customerId);
      const customer = opts.customers.find((row) => row.id === customerId);
      setCustomerFilter('');
      setDraft({
        ...emptyDraft(`${period}-01`),
        customer_id: customerId,
        owner_name: template?.owner_name ?? customer?.sorumlu ?? '',
        currency: template?.currency ?? 'TRY',
        lines: template?.items.length
          ? template.items.map((item) => ({ uid: uid(), service_key: item.service_key, quantity: String(item.quantity), unit_price: String(item.unit_price) }))
          : [newLine()],
      });
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Şablon yüklenemedi.');
    }
  };

  const draftTotals = useMemo(() => {
    if (!draft) return { amount: 0, count: 0 };
    const computed = computeLineTotals(draft.lines.map((line) => ({ service_key: line.service_key, quantity: Number(line.quantity), unit_price: parseMoney(line.unit_price) })));
    return { amount: computed.amount, count: computed.lines.length };
  }, [draft]);

  const filteredCustomers = useMemo(() => {
    const list = options?.customers ?? [];
    const needle = customerFilter.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return list.slice(0, 400);
    return list.filter((row) => row.musteri.toLocaleLowerCase('tr-TR').includes(needle)).slice(0, 400);
  }, [options, customerFilter]);

  const save = async () => {
    if (!draft) return;
    if (!draft.customer_id) { setMsg('Firma seçilmeli.'); return; }
    if (!/^\d{4}-\d{2}$/.test(draft.period)) { setMsg('Ay seçilmeli.'); return; }
    if (!draftTotals.count) { setMsg('En az bir hizmet kalemi girilmeli (adet > 0).'); return; }
    setBusy(true);
    setMsg(null);
    try {
      const body = {
        ...(draft.id ? { id: draft.id } : {}),
        customer_id: draft.customer_id,
        period_month: draft.period,
        currency: draft.currency,
        invoice_no: draft.invoice_no.trim() || null,
        invoice_date: draft.invoice_date || null,
        owner_name: draft.owner_name.trim() || null,
        note: draft.note.trim() || null,
        lines: draft.lines
          .filter((line) => line.service_key && Number(line.quantity) > 0)
          .map((line) => ({ service_key: line.service_key, quantity: Number(line.quantity), unit_price: parseMoney(line.unit_price) })),
      };
      const res = await fetch(draft.id ? '/api/service-invoices/update' : '/api/service-invoices/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Kaydedilemedi.');
      setDraft(null);
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (row: ServiceInvoiceRow) => {
    const reason = window.prompt(`${row.musteri} · ${periodLabel(row.period_month)} faturası iptal edilecek. Sebep (isteğe bağlı):`, '');
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await fetch('/api/service-invoices/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, reason: reason || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'İptal edilemedi.');
      await load();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'İptal edilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const selectedCustomer = options?.customers.find((row) => row.id === draft?.customer_id) ?? null;
  const missing = summary?.missing ?? [];
  const pastPeriodWarning = draft && draft.period < periodInputValue(currentPeriod(todayIso())) ? 'Geçmiş aya kayıt giriyorsun.' : draft && draft.period > periodInputValue(currentPeriod(todayIso())) ? 'Gelecek aya kayıt giriyorsun.' : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Ticari Operasyon</span>
        <h1 className="pax-hero-title">Hizmet Faturaları</h1>
        <p className="pax-hero-description">
          KasaPOS entegrasyonu, TMS, Max Store, AirViewer gibi <b>aylık hizmetlerin</b> faturaları. Her firma için
          her ay bir kayıt beklenir; geçmiş aya da girilebilir. TL ve USD ayrı toplanır — cihaz cirosuna karışmaz.
        </p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">{allMonths ? `${period.slice(0, 4)} · TL` : `${periodLabel(`${period}-01`)} · TL`}</div><div className="pax-hero-stat-value">{summary ? fmtServiceMoney((allMonths ? summary.ytd : summary.period_totals).TRY.amount, 'TRY') : '—'}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">{allMonths ? `${period.slice(0, 4)} · USD` : `${periodLabel(`${period}-01`)} · USD`}</div><div className="pax-hero-stat-value">{summary ? fmtServiceMoney((allMonths ? summary.ytd : summary.period_totals).USD.amount, 'USD') : '—'}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Bu Yıl Toplam</div><div className="pax-hero-stat-value" style={{ fontSize: 20 }}>{summary ? totalsText(summary.ytd) : '—'}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Bu Ay Eksik Firma</div><div className="pax-hero-stat-value">{summary ? missing.length : '—'}</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {canCreate ? <button type="button" onClick={() => void openCreate()} style={{ ...ghostLink, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>+ Hizmet Faturası</button> : null}
          <Link href="/admin/parameters" style={ghostLink}>Hizmet Kalemleri (Liste Yönetimleri)</Link>
          {/* Hizmet Fatura Raporu (Excel) — dönem (ay/yıl) + satışçı seçilir; TL ve USD ayrı toplanır (Sinan, 21.09). */}
          <SalesReportDownload kind="hizmet" owners={owners} canSeeAll={canSeeAll} buttonStyle={ghostLink} />
        </div>
      </div>

      {msg ? <div style={{ ...surface, borderColor: 'var(--chip-gold-bd)', background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', fontWeight: 700 }}>{msg}</div> : null}

      <section style={surface}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={period} onChange={(e) => { if (e.target.value) setPeriod(e.target.value); }} style={{ ...inputStyle, width: 190 }} disabled={allMonths} aria-label="Dönem (ay)" />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} /> Yılın tüm ayları
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firma veya fatura no ara" style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: 170 }}>
            <option value="active">Aktif faturalar</option>
            <option value="cancelled">İptal edilenler</option>
            <option value="">Tümü</option>
          </select>
          {canSeeAll ? (
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ ...inputStyle, width: 190 }}>
              <option value="">Tüm satışçılar</option>
              {owners.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : null}
          <button type="button" onClick={() => void load()} style={ghostButton} disabled={loading}>{loading ? 'Yükleniyor…' : 'Yenile'}</button>
        </div>
      </section>

      {!allMonths && missing.length ? (
        <section style={{ ...surface, borderColor: 'var(--chip-gold-bd)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {periodLabel(`${period}-01`)} faturası kesilmemiş firmalar
            </h3>
            <span style={hintStyle}>Geçen ay ({periodLabel(previousPeriod(`${period}-01`))}) faturası olup bu ay kaydı olmayanlar. &quot;Her ay kesilmesi zorunlu.&quot;</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {missing.map((firm) => (
              <button
                type="button"
                key={firm.customer_id}
                onClick={() => (canCreate ? void openFromMissing(firm.customer_id) : undefined)}
                title={canCreate ? 'Geçen ayın kalemleriyle yeni fatura aç' : undefined}
                style={{ ...pillBase, ...pillWarn, minHeight: 34, gap: 8, cursor: canCreate ? 'pointer' : 'default', fontFamily: 'inherit' }}
              >
                <b>{firm.musteri}</b>
                <span style={{ fontWeight: 700, opacity: .85 }}>geçen ay {fmtServiceMoney(firm.last_amount, firm.currency)}</span>
                {canCreate ? <span aria-hidden="true">＋</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section style={surface}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={tableHead}>Firma</th>
                <th style={tableHead}>Ay</th>
                <th style={tableHead}>Kalemler</th>
                <th style={tableHead}>Tutar</th>
                <th style={tableHead}>Fatura</th>
                <th style={tableHead}>Satışçı</th>
                <th style={tableHead}>Durum</th>
                <th style={tableHead}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...tableCell, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ ...tableCell, textAlign: 'center', color: 'var(--text-3)' }}>
                  {allMonths ? `${period.slice(0, 4)} yılında` : `${periodLabel(`${period}-01`)} için`} kayıt yok. &quot;+ Hizmet Faturası&quot; ile girin.
                </td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)', opacity: row.status === 'cancelled' ? .6 : 1 }}>
                  <td style={tableCell}>
                    <Link href={`/crm/${row.customer_id}`} style={{ fontWeight: 800, color: 'var(--text)' }}>{row.musteri}</Link>
                    {row.note ? <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{row.note}</div> : null}
                  </td>
                  <td style={{ ...tableCell, whiteSpace: 'nowrap' }}><b>{periodLabel(row.period_month)}</b></td>
                  <td style={tableCell}>
                    <div style={{ display: 'grid', gap: 3 }}>
                      {row.items.map((item) => (
                        <div key={item.id} style={{ fontSize: 13 }}>
                          <b>{item.service_label}</b> <span style={{ color: 'var(--text-3)' }}>× {item.quantity.toLocaleString('tr-TR')}</span>
                          {item.unit_price ? <span style={{ color: 'var(--text-3)' }}> · {fmtServiceMoney(item.unit_price, row.currency)}</span> : null}
                        </div>
                      ))}
                      {!row.items.length ? <span style={{ color: 'var(--text-3)' }}>kalem yok</span> : null}
                    </div>
                  </td>
                  <td style={{ ...tableCell, whiteSpace: 'nowrap' }}>
                    <b style={{ fontSize: 15 }}>{fmtServiceMoney(row.amount, row.currency)}</b>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('tr-TR')} adet</div>
                  </td>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 700, color: row.invoice_no ? 'var(--text-2)' : 'var(--text-3)' }}>{row.invoice_no ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(row.invoice_date)}</div>
                  </td>
                  <td style={tableCell}>{row.owner_name || '—'}</td>
                  <td style={tableCell}>
                    {row.status === 'active'
                      ? <span style={{ ...pillBase, ...pillOk }}>Aktif</span>
                      : <span style={{ ...pillBase, ...pillMuted }} title={row.cancel_reason ?? undefined}>İptal</span>}
                  </td>
                  <td style={{ ...tableCell, whiteSpace: 'nowrap' }}>
                    {canEdit && row.status === 'active' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => void openEdit(row)} style={ghostButton} disabled={busy}>Düzenle</button>
                        <button type="button" onClick={() => void cancel(row)} style={{ ...ghostButton, color: 'var(--chip-red-color)' }} disabled={busy}>İptal</button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {draft ? (
        <div style={modalBackdrop} onClick={() => setDraft(null)}>
          <div style={{ ...modalCard, width: 'min(820px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{draft.id ? 'Hizmet Faturasını Düzenle' : 'Hizmet Faturası Ekle'}</h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 14px', fontSize: 13 }}>
              Firma, ay ve para birimini seç; kalemleri <b>hizmet × adet × birim fiyat</b> olarak gir. Tutar kalemlerden hesaplanır.
              {pastPeriodWarning ? <b style={{ color: 'var(--chip-gold-color)' }}> {pastPeriodWarning}</b> : null}
            </p>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <span style={labelStyle}>Firma *</span>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, 2fr)' }}>
                  <input value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="Firma ara…" style={inputStyle} />
                  <select
                    value={draft.customer_id}
                    onChange={(e) => {
                      const customer = options?.customers.find((row) => row.id === e.target.value);
                      setDraft((prev) => (prev ? { ...prev, customer_id: e.target.value, owner_name: prev.owner_name || customer?.sorumlu || '' } : prev));
                    }}
                    style={inputStyle}
                  >
                    <option value="">{options ? (filteredCustomers.length ? 'Seçin' : 'Eşleşen firma yok') : 'Yükleniyor…'}</option>
                    {selectedCustomer && !filteredCustomers.some((row) => row.id === selectedCustomer.id)
                      ? <option value={selectedCustomer.id}>{selectedCustomer.musteri}</option> : null}
                    {filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.musteri}</option>)}
                  </select>
                </div>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Ay (dönem) *</span>
                <input type="month" value={draft.period} onChange={(e) => setDraft((prev) => (prev ? { ...prev, period: e.target.value } : prev))} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Para birimi *</span>
                <select value={draft.currency} onChange={(e) => setDraft((prev) => (prev ? { ...prev, currency: e.target.value as ServiceCurrency } : prev))} style={inputStyle}>
                  {(options?.currencies ?? [{ value: 'TRY', label: 'TL', symbol: '₺' }, { value: 'USD', label: 'USD', symbol: '$' }]).map((currency) => (
                    <option key={currency.value} value={currency.value}>{currency.label} ({currency.symbol})</option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Fatura no</span>
                <input value={draft.invoice_no} onChange={(e) => setDraft((prev) => (prev ? { ...prev, invoice_no: e.target.value } : prev))} placeholder="PSX2026000000025" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Fatura tarihi</span>
                <input type="date" value={draft.invoice_date} onChange={(e) => setDraft((prev) => (prev ? { ...prev, invoice_date: e.target.value } : prev))} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Satışçı</span>
                <select value={draft.owner_name} onChange={(e) => setDraft((prev) => (prev ? { ...prev, owner_name: e.target.value } : prev))} style={inputStyle}>
                  <option value="">{selectedCustomer?.sorumlu ? `Firmanın sorumlusu (${selectedCustomer.sorumlu})` : 'Firmanın sorumlusu'}</option>
                  {(options?.owners ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 6 }}>
              <span style={labelStyle}>Kalemler * <small style={{ fontWeight: 600, color: 'var(--text-3)' }}>— hizmet · adet · birim fiyat ({draft.currency === 'TRY' ? '₺' : '$'})</small></span>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {draft.lines.map((line) => {
                  const lineTotal = Math.floor(Number(line.quantity) || 0) * parseMoney(line.unit_price);
                  return (
                    <div key={line.uid} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 3fr) 88px 140px 120px auto', alignItems: 'center' }}>
                      <select
                        value={line.service_key}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, lines: prev.lines.map((row) => (row.uid === line.uid ? { ...row, service_key: e.target.value } : row)) } : prev))}
                        style={inputStyle}
                      >
                        <option value="">{options ? 'Hizmet seçin' : 'Yükleniyor…'}</option>
                        {(options?.services ?? []).map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}
                      </select>
                      <input
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, lines: prev.lines.map((row) => (row.uid === line.uid ? { ...row, quantity: e.target.value.replace(/\D/g, '') } : row)) } : prev))}
                        placeholder="Adet"
                        style={inputStyle}
                        aria-label="Adet"
                      />
                      <input
                        inputMode="decimal"
                        value={line.unit_price}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, lines: prev.lines.map((row) => (row.uid === line.uid ? { ...row, unit_price: e.target.value.replace(/[^\d.,]/g, '') } : row)) } : prev))}
                        placeholder="Birim fiyat"
                        style={inputStyle}
                        aria-label="Birim fiyat"
                      />
                      <div style={{ fontWeight: 800, textAlign: 'right', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtServiceMoney(lineTotal, draft.currency)}</div>
                      <button type="button" onClick={() => setDraft((prev) => (prev ? { ...prev, lines: prev.lines.length > 1 ? prev.lines.filter((row) => row.uid !== line.uid) : [newLine()] } : prev))} style={ghostButton} aria-label="Satırı sil">✕</button>
                    </div>
                  );
                })}
                <div>
                  <button type="button" onClick={() => setDraft((prev) => (prev ? { ...prev, lines: [...prev.lines, newLine()] } : prev))} style={ghostButton}>+ Satır ekle</button>
                </div>
              </div>
            </div>

            <label style={{ ...fieldStyle, marginTop: 12 }}>
              <span style={labelStyle}>Not</span>
              <textarea value={draft.note} onChange={(e) => setDraft((prev) => (prev ? { ...prev, note: e.target.value } : prev))} rows={2} style={{ ...inputStyle, minHeight: 64, padding: 10, resize: 'vertical' }} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Toplam: {fmtServiceMoney(draftTotals.amount, draft.currency)}
                <span style={{ ...hintStyle, marginLeft: 8 }}>{draftTotals.count} kalem</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setDraft(null)} style={ghostButton} disabled={busy}>Vazgeç</button>
                <button type="button" onClick={() => void save()} style={primaryButton} disabled={busy}>{busy ? 'Kaydediliyor…' : draft.id ? 'Güncelle' : 'Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const surface: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 16, boxShadow: 'var(--shadow)' };
const primaryButton: CSSProperties = { minHeight: 42, padding: '0 16px', borderRadius: 14, background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' };
const ghostButton: CSSProperties = { minHeight: 38, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
const ghostLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', borderRadius: 12, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', textDecoration: 'none', fontWeight: 700 };
const inputStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: '1px solid var(--border)', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, width: '100%' };
const tableHead: CSSProperties = { textAlign: 'left', padding: '0 12px 10px', color: 'var(--text-2)', fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase' };
const tableCell: CSSProperties = { padding: '14px 12px', verticalAlign: 'top', color: 'var(--text)' };
const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 10px', borderRadius: 999, fontWeight: 800, fontSize: 12, border: '1px solid transparent' };
const pillOk: CSSProperties = { background: 'var(--chip-green-bg)', color: 'var(--chip-green-color)', borderColor: 'var(--chip-green-bd)' };
const pillMuted: CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border)' };
const pillWarn: CSSProperties = { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', borderColor: 'var(--chip-gold-bd)' };
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 };
const modalCard: CSSProperties = { ...surface, width: 'min(560px, 100%)', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'grid', gap: 4 };
const fieldStyle: CSSProperties = { display: 'grid', gap: 6, marginBottom: 12 };
const labelStyle: CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--text-2)' };
const hintStyle: CSSProperties = { color: 'var(--text-3)', fontSize: 12 };
