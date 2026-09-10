'use client';

// Satışlar ekranı — SATIŞ kayıtları: kazanılan tekliflerden türeyenler + teklifsiz girilenler.
// Kural (Sinan, 07.09): teklif donmuş belgedir, burada düzenlenen satıştır.
// Cihaz adedi değişince tutar katalog kademesinden yeniden hesaplanır; "anlaşma
// fiyatı" girilirse katalog ezilir (kayıtta "elle" işareti görünür).
// Ciro (Canlı Ekran, Teklif Raporları) aktif satışların toplamıdır.
// Doğrudan satış (Sinan/Furkan, 10.09; migration 027): teklifi olmayan satış buradan "+ Satış Ekle"
// ile girilir (`source='direct'`, teklif no yok). Tutar teklif ekranıyla AYNI motordan hesaplanır
// (ürün + adet → katalog kademesi); istenirse anlaşma fiyatı ezer.
// Satış Kanalı (027): Banka · Direkt Satış · Kanal — Forecast'in parametre listesi; Satış Tipi
// (Satış / Kiralama) ayrı kavramdır, ikisi karıştırılmaz.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';

type SaleRow = {
  id: string;
  /** Teklifsiz satışta null (027). */
  quote_id: string | null;
  customer_id: string;
  musteri: string;
  quote_no: string | null;
  owner_name: string;
  sale_date: string;
  device_count: number;
  amount: number;
  price_source: 'catalog' | 'manual';
  status: 'active' | 'cancelled';
  note: string | null;
  /** Kiralama (08.09): 'rental' tümü kiralama · 'mixed' satış + kiralama. Dönem burada düzenlenir. */
  sale_type: 'sale' | 'rental' | 'mixed';
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_monthly_amount: number;
  hardware_amount: number;
  quote_device_count: number;
  quote_amount: number;
  updated_at: string | null;
  updated_by: string | null;
  /** Satış kanalı (Banka · Direkt Satış · Kanal) — Forecast listesiyle aynı kaynak (027). */
  sales_channel: string | null;
  /** quote = kazanılan teklifden · direct = teklifsiz girildi (027). */
  source: 'quote' | 'direct';
};

type ChannelOption = { value: string; label: string };
type CustomerOption = { id: string; musteri: string };
type ProductOption = { id: string; code: string; name: string; product_type: string; is_recurring: boolean; rental_monthly_price: number | null };
type NewLine = { uid: string; product_id: string; quantity: string; sale_type: 'sale' | 'rental' };

const newLine = (): NewLine => ({ uid: Math.random().toString(36).slice(2), product_id: '', quantity: '1', sale_type: 'sale' });
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const usd = (value: number) =>
  `$${Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
const fmtDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function SalesClient() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [summary, setSummary] = useState<{ sale_count: number; amount: number; devices: number } | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Düzenleme penceresi
  const [editing, setEditing] = useState<SaleRow | null>(null);
  const [formDevices, setFormDevices] = useState('0');
  const [formManual, setFormManual] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formChannel, setFormChannel] = useState('');

  // Yeni (teklifsiz) satış penceresi — 027
  const [creating, setCreating] = useState(false);
  const [options, setOptions] = useState<{ customers: CustomerOption[]; products: ProductOption[] } | null>(null);
  const [newCustomer, setNewCustomer] = useState('');
  const [newDate, setNewDate] = useState(todayIso());
  const [newChannel, setNewChannel] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newAgreed, setNewAgreed] = useState('');
  const [newLines, setNewLines] = useState<NewLine[]>([newLine()]);

  const [cancelling, setCancelling] = useState<SaleRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (owner) params.set('owner', owner);
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/sales/list?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json?.message || 'Satışlar alınamadı.');
      setLoading(false);
      return;
    }
    setRows((json.rows ?? []) as SaleRow[]);
    setSummary(json.summary ?? null);
    setOwners((json.owners ?? []) as string[]);
    setCanEdit(Boolean(json.canEdit));
    setCanSeeAll(Boolean(json.canSeeAll));
    setCanCreate(Boolean(json.canCreate));
    setChannels((json.channels ?? []) as ChannelOption[]);
    setLoading(false);
  }, [owner, status, q]);

  useEffect(() => { void load(); }, [load]);

  const openEdit = (row: SaleRow) => {
    setEditing(row);
    setFormDevices(String(row.device_count ?? 0));
    setFormManual(row.price_source === 'manual' ? String(row.amount ?? '') : '');
    setFormDate(String(row.sale_date ?? '').slice(0, 10));
    setFormNote(row.note ?? '');
    setFormChannel(row.sales_channel ?? '');
    setMsg(null);
  };

  /** Teklifsiz satış penceresi: müşteri ve ürün listesi /api/sales/options'tan (ürünler teklif kataloğuyla aynı). */
  const openCreate = async () => {
    setCreating(true);
    setMsg(null);
    setNewCustomer(''); setNewDate(todayIso()); setNewChannel(''); setNewNote(''); setNewAgreed(''); setNewLines([newLine()]);
    if (options) return;
    // Müşteri listesi yetkiye göre daraltılmış gelir (satışçı → yalnız kendi portföyü).
    const res = await fetch('/api/sales/options', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(json?.message || 'Müşteri ve ürün listesi alınamadı.'); return; }
    setOptions({
      customers: ((json.customers ?? []) as any[]).map((row) => ({ id: String(row.id), musteri: String(row.musteri) })),
      products: ((json.products ?? []) as any[]).map((row) => ({
        id: String(row.id), code: String(row.code ?? ''), name: String(row.name ?? ''),
        product_type: String(row.product_type ?? 'device'), is_recurring: Boolean(row.is_recurring),
        rental_monthly_price: row.rental_monthly_price == null ? null : Number(row.rental_monthly_price),
      })),
    });
  };

  async function submitCreate() {
    const lines = newLines
      .filter((line) => line.product_id && Number(line.quantity) > 0)
      .map((line) => ({ product_id: line.product_id, quantity: Math.floor(Number(line.quantity)), sale_type: line.sale_type }));
    if (!newCustomer) { setMsg('Müşteri seçilmeli.'); return; }
    if (!lines.length) { setMsg('En az bir ürün satırı girilmeli.'); return; }
    setBusy(true);
    const res = await fetch('/api/sales/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: newCustomer,
        sale_date: newDate,
        sales_channel: newChannel || null,
        note: newNote || null,
        agreed_amount: newAgreed.trim() === '' ? null : Number(newAgreed),
        lines,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json?.message || 'Satış kaydı oluşturulamadı.'); return; }
    setCreating(false);
    await load();
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/sales/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: editing.id,
        device_count: Number(formDevices || 0),
        manual_amount: formManual.trim() === '' ? null : Number(formManual),
        sale_date: formDate || null,
        note: formNote,
        sales_channel: formChannel || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json?.message || 'Satış güncellenemedi.'); return; }
    setEditing(null);
    setMsg(json?.warning || null);
    await load();
  }

  async function submitCancel(reopen = false) {
    const target = cancelling;
    if (!target) return;
    setBusy(true);
    const res = await fetch('/api/sales/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: target.id, cancel_reason: cancelReason, reopen }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(json?.message || 'İşlem başarısız.'); return; }
    setCancelling(null);
    setCancelReason('');
    await load();
  }

  const shown = useMemo(() => rows, [rows]);
  const activeRows = shown.filter((row) => row.status === 'active');
  const listAmount = activeRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const listDevices = activeRows.reduce((sum, row) => sum + Number(row.device_count ?? 0), 0);
  const editedCount = activeRows.filter((row) => row.device_count !== row.quote_device_count || Math.round(row.amount) !== Math.round(row.quote_amount)).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Ticari Operasyon</span>
        <h1 className="pax-hero-title">Satışlar</h1>
        <p className="pax-hero-description">
          Satışa dönüştürülen teklifler ve teklifsiz girilen satışlar burada tutulur. Cihaz adedi ve tutar burada
          düzenlenir; teklif belgesi değişmez. Ciro raporları aktif satışları sayar.
        </p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Bu Yıl Satış</div><div className="pax-hero-stat-value">{summary?.sale_count ?? 0}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Bu Yıl Ciro</div><div className="pax-hero-stat-value">{usd(summary?.amount ?? 0)}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Bu Yıl Cihaz</div><div className="pax-hero-stat-value">{(summary?.devices ?? 0).toLocaleString('tr-TR')}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Listede</div><div className="pax-hero-stat-value">{activeRows.length} · {usd(listAmount)}</div></div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {canCreate ? <button type="button" onClick={() => void openCreate()} style={{ ...ghostLink, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>+ Satış Ekle</button> : null}
          <Link href="/crm/quotes" style={{ ...ghostLink }}>Teklifler</Link>
          <Link href="/crm/reports/quotes" style={{ ...ghostLink }}>Teklif Raporları</Link>
        </div>
      </div>

      {msg ? <div style={{ ...surface, borderColor: 'var(--chip-gold-bd)', background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', fontWeight: 700 }}>{msg}</div> : null}

      <section style={surface}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(240px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr) auto' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri veya teklif no ara" style={inputStyle} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="active">Aktif satışlar</option>
            <option value="cancelled">İptal edilenler</option>
            <option value="">Tümü</option>
          </select>
          {canSeeAll ? (
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
              <option value="">Tüm satıcılar</option>
              {owners.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          ) : null}
          <button onClick={() => void load()} style={ghostButton} disabled={loading}>{loading ? 'Yükleniyor…' : 'Yenile'}</button>
          {editedCount ? <span style={{ alignSelf: 'center', color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>{editedCount} satış teklifden farklı</span> : null}
        </div>
      </section>

      <section style={surface}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={tableHead}>Müşteri</th>
                <th style={tableHead}>Teklif</th>
                <th style={tableHead}>Satış Kanalı</th>
                <th style={tableHead}>Satıcı</th>
                <th style={tableHead}>Satış Tarihi</th>
                <th style={tableHead}>Cihaz</th>
                <th style={tableHead}>Tutar</th>
                <th style={tableHead}>Durum</th>
                <th style={tableHead}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ ...tableCell, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={9} style={{ ...tableCell, textAlign: 'center', color: 'var(--text-3)' }}>
                  Kayıt yok. Bir teklifi &quot;Satışa Dönüştür&quot; ile kapatınca ya da &quot;+ Satış Ekle&quot; ile teklifsiz girince burada görünür.
                </td></tr>
              ) : shown.map((row) => {
                const deviceDiff = row.device_count - row.quote_device_count;
                const amountDiff = Math.round(row.amount) - Math.round(row.quote_amount);
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tableCell}>
                      <Link href={`/crm/${row.customer_id}`} style={{ fontWeight: 800, color: 'var(--text)' }}>{row.musteri}</Link>
                      {row.note ? <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{row.note}</div> : null}
                    </td>
                    <td style={tableCell}>
                      {row.quote_id
                        ? <Link href={`/crm/quotes/${row.quote_id}`} style={{ color: 'var(--text-2)', fontWeight: 700 }}>{row.quote_no}</Link>
                        : <span style={{ ...pillBase, ...pillMuted }}>Teklifsiz</span>}
                    </td>
                    <td style={tableCell}>{row.sales_channel || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                    <td style={tableCell}>{row.owner_name || '—'}</td>
                    <td style={tableCell}>{fmtDate(row.sale_date)}</td>
                    <td style={tableCell}>
                      <b>{Number(row.device_count ?? 0).toLocaleString('tr-TR')}</b>
                      {row.quote_id && deviceDiff !== 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)' }}>teklif {Number(row.quote_device_count ?? 0).toLocaleString('tr-TR')} ({deviceDiff > 0 ? '+' : ''}{deviceDiff})</div> : null}
                    </td>
                    <td style={tableCell}>
                      <b>{usd(row.amount)}</b>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {row.price_source === 'manual' ? 'anlaşma fiyatı' : 'katalog'}
                        {row.quote_id && amountDiff !== 0 ? ` · teklif ${usd(row.quote_amount)}` : ''}
                      </div>
                    </td>
                    <td style={tableCell}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ ...pillBase, ...(row.status === 'active' ? pillOk : pillMuted) }}>{row.status === 'active' ? 'Satış' : 'İptal'}</span>
                        {row.sale_type !== 'sale' ? <span style={{ ...pillBase, ...pillRental }}>{row.sale_type === 'mixed' ? 'Satış + Kiralama' : 'Kiralama'}</span> : null}
                      </div>
                      {row.sale_type !== 'sale' ? (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>aylık kira {usd(row.rental_monthly_amount)}</div>
                      ) : null}
                    </td>
                    <td style={{ ...tableCell, whiteSpace: 'nowrap' }}>
                      {canEdit && row.status === 'active' ? <button onClick={() => openEdit(row)} style={ghostButton}>Düzenle</button> : null}
                      {canEdit ? (
                        <button
                          onClick={() => { setCancelling(row); setCancelReason(''); if (row.status === 'cancelled') void 0; }}
                          style={{ ...ghostButton, marginLeft: 8 }}
                        >{row.status === 'active' ? 'İptal' : 'Geri Al'}</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <div style={modalBackdrop} onClick={() => setEditing(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Satışı Düzenle — {editing.musteri}</h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 14px', fontSize: 13 }}>
              {editing.quote_id
                ? <>{editing.quote_no} teklifinden türedi. <b>Teklif belgesi değişmez</b>; burada satış kaydını güncelliyorsun.</>
                : <>Teklifsiz satış kaydı. Yeniden fiyatlanacak teklif satırı yok — tutarı değiştirmek için <b>anlaşma fiyatı</b> gir.</>}
            </p>
            <label style={fieldStyle}>
              <span style={labelStyle}>Cihaz Adedi</span>
              <input type="number" min={0} value={formDevices} onChange={(e) => setFormDevices(e.target.value)} style={inputStyle} />
              <small style={hintStyle}>Boş bırakılan anlaşma fiyatıyla birlikte tutar katalog kademesinden yeniden hesaplanır (teklifteki ürün dağılımı korunur).</small>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Anlaşma Fiyatı (USD) — opsiyonel</span>
              <input type="number" min={0} step="0.01" value={formManual} onChange={(e) => setFormManual(e.target.value)} placeholder="Boş = katalogdan hesapla" style={inputStyle} />
              <small style={hintStyle}>Doldurursan katalog hesabı ezilir ve kayıt &quot;anlaşma fiyatı&quot; olarak işaretlenir.</small>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Satış Tarihi</span>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Satış Kanalı</span>
              <select value={formChannel} onChange={(e) => setFormChannel(e.target.value)} style={inputStyle}>
                <option value="">Seçilmedi</option>
                {channels.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
              </select>
              <small style={hintStyle}>Banka · Direkt Satış · Kanal (Forecast&apos;teki liste). Satış / Kiralama ayrımı ayrı bir alandır.</small>
            </label>
            {editing.sale_type !== 'sale' ? (
              <div style={{ padding: 12, borderRadius: 14, border: '1px solid var(--chip-gold-bd)', background: 'var(--chip-gold-bg)', marginBottom: 12, fontWeight: 800, fontSize: 13, color: 'var(--chip-gold-color)' }}>
                {editing.sale_type === 'mixed' ? 'Satış + Kiralama' : 'Kiralama'} · aylık kira {usd(editing.rental_monthly_amount)}
              </div>
            ) : null}
            <label style={fieldStyle}>
              <span style={labelStyle}>Not</span>
              <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 80, padding: 10 }} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setEditing(null)} style={ghostButton} disabled={busy}>Vazgeç</button>
              <button onClick={() => void saveEdit()} style={primaryButton} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {creating ? (
        <div style={modalBackdrop} onClick={() => setCreating(false)}>
          <div style={{ ...modalCard, width: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Satış Ekle (teklifsiz)</h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 14px', fontSize: 13 }}>
              Teklif oluşturmadan satış kaydı açar. Tutar <b>teklif ekranıyla aynı katalog kademesinden</b> hesaplanır;
              anlaşma fiyatı girersen o ezer. Kayıt ciroya girer.
            </p>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Müşteri *</span>
                <select value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} style={inputStyle}>
                  <option value="">{options ? 'Seçin' : 'Yükleniyor…'}</option>
                  {(options?.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.musteri}</option>)}
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Satış Tarihi *</span>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Satış Kanalı</span>
                <select value={newChannel} onChange={(e) => setNewChannel(e.target.value)} style={inputStyle}>
                  <option value="">Seçilmedi</option>
                  {channels.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Anlaşma Fiyatı (USD) — opsiyonel</span>
                <input inputMode="numeric" value={newAgreed} onChange={(e) => setNewAgreed(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Boş = katalogdan hesapla" style={inputStyle} />
              </label>
            </div>

            <div style={{ marginTop: 6 }}>
              <span style={labelStyle}>Ürünler *</span>
              <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                {newLines.map((line, index) => (
                  <div key={line.uid} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 3fr) 92px 132px auto', alignItems: 'center' }}>
                    <select
                      value={line.product_id}
                      onChange={(e) => setNewLines((prev) => prev.map((row) => (row.uid === line.uid ? { ...row, product_id: e.target.value } : row)))}
                      style={inputStyle}
                    >
                      <option value="">{options ? 'Ürün seçin' : 'Yükleniyor…'}</option>
                      {(options?.products ?? []).map((product) => (
                        <option key={product.id} value={product.id}>{product.code ? `${product.code} · ` : ''}{product.name}</option>
                      ))}
                    </select>
                    <input
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => setNewLines((prev) => prev.map((row) => (row.uid === line.uid ? { ...row, quantity: e.target.value.replace(/\D/g, '') } : row)))}
                      style={inputStyle}
                      aria-label={`Satır ${index + 1} adet`}
                    />
                    <select
                      value={line.sale_type}
                      onChange={(e) => setNewLines((prev) => prev.map((row) => (row.uid === line.uid ? { ...row, sale_type: e.target.value as 'sale' | 'rental' } : row)))}
                      style={inputStyle}
                      aria-label={`Satır ${index + 1} satış tipi`}
                    >
                      <option value="sale">Satış</option>
                      <option value="rental">Kiralama</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setNewLines((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.uid !== line.uid)))}
                      style={ghostButton}
                      disabled={newLines.length === 1}
                      aria-label="Satırı kaldır"
                    >×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setNewLines((prev) => [...prev, newLine()])} style={{ ...ghostButton, marginTop: 8 }}>+ Satır ekle</button>
            </div>

            <label style={{ ...fieldStyle, marginTop: 12 }}>
              <span style={labelStyle}>Not</span>
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} style={{ ...inputStyle, minHeight: 64, padding: 10 }} />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setCreating(false)} style={ghostButton} disabled={busy}>Vazgeç</button>
              <button onClick={() => void submitCreate()} style={primaryButton} disabled={busy || !options}>{busy ? 'Kaydediliyor…' : 'Satışı Kaydet'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelling ? (
        <div style={modalBackdrop} onClick={() => setCancelling(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              {cancelling.status === 'active' ? 'Satışı İptal Et' : 'İptali Geri Al'} — {cancelling.musteri}
            </h2>
            <p style={{ color: 'var(--text-3)', margin: '6px 0 14px', fontSize: 13 }}>
              {cancelling.status === 'active'
                ? 'İptal edilen satış ciroya girmez; kayıt silinmez, listede "İptal" olarak durur.'
                : 'Satış yeniden aktif olur ve ciroya girer.'}
            </p>
            {cancelling.status === 'active' ? (
              <label style={fieldStyle}>
                <span style={labelStyle}>İptal Nedeni *</span>
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} style={inputStyle} placeholder="Örn. müşteri siparişten vazgeçti" />
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setCancelling(null)} style={ghostButton} disabled={busy}>Vazgeç</button>
              <button
                onClick={() => void submitCancel(cancelling.status !== 'active')}
                style={primaryButton}
                disabled={busy || (cancelling.status === 'active' && !cancelReason.trim())}
              >{busy ? 'İşleniyor…' : cancelling.status === 'active' ? 'İptal Et' : 'Geri Al'}</button>
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
const pillRental: CSSProperties = { background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-color)', borderColor: 'var(--chip-gold-bd)' };
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 };
const modalCard: CSSProperties = { ...surface, width: 'min(560px, 100%)', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'grid', gap: 4 };
const fieldStyle: CSSProperties = { display: 'grid', gap: 6, marginBottom: 12 };
const labelStyle: CSSProperties = { fontWeight: 800, fontSize: 13, color: 'var(--text-2)' };
const hintStyle: CSSProperties = { color: 'var(--text-3)', fontSize: 12 };
