'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LiveBoard from '@/components/reports/LiveBoard';
import '@/styles/seller-followup.css';

// Satışçı Takip Raporu
//   Sekme 1 — Takip Listesi: açık engeller (Engel & Etki verisinden), 10 firma/sayfa.
//   Sekme 2 — Kişi Bazlı Aktivite: temas edilen müşteriler, kanal kırılımı + hedef.
//   Sekme 3 — Canlı Ekran: kendi kendine dönen yönetici panosu (takım özeti + kişi
//             slaytları). ?tab=live ile doğrudan açılır — TV/ikinci ekran için yer imi.

type TabKey = 'followup' | 'activity' | 'live';
const TAB_KEYS: TabKey[] = ['followup', 'activity', 'live'];

function tabFromUrl(): TabKey {
  if (typeof window === 'undefined') return 'followup';
  const value = new URLSearchParams(window.location.search).get('tab');
  return (TAB_KEYS as string[]).includes(value ?? '') ? (value as TabKey) : 'followup';
}

type FollowupRow = {
  customerId: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  konuKimde: string;
  konuKimdeTipi: string | null;
  modelAdetLabel: string;
  totalQuantity: number;
  takipKonusu: string;
  notes: string | null;
  cozumTarihi: string | null;
  effectiveStatus: string;
  overdue: boolean;
  nearTerm: boolean;
};

type FollowupPayload = {
  filters: { owner: string; from: string; to: string };
  summary: {
    openFollowupCount: number;
    totalQuantity: number;
    nearTermQuantity: number;
    nearTermCustomers: string[];
    nearTermLabel: string;
  };
  rows: FollowupRow[];
  ownerOptions: string[];
};

type ContactTargets = {
  salesPhysical: number;
  salesOnline: number;
  salesPhone: number;
  salesEmail: number;
  technicalPhysical: number;
  technicalOnline: number;
  totalActivities: number;
  uniqueCustomers: number;
};

type ContactOwnerRow = {
  owner: string;
  salesPhysical: number;
  salesOnline: number;
  salesPhone: number;
  salesEmail: number;
  technicalPhysical: number;
  technicalOnline: number;
  totalActivities: number;
  uniqueCustomers: number;
  targets: ContactTargets;
};

// Kişi bazlı aktivite tablosu, haftalık yönetim sunumu payload'ındaki
// contactReport bloğundan beslenir (PPTX'te de aynı veri kullanılıyor).
type ContactPayload = {
  message?: string;
  contactReport?: { owners: ContactOwnerRow[] };
};

const EMPTY_FOLLOWUP: FollowupPayload = {
  filters: { owner: '', from: '', to: '' },
  summary: { openFollowupCount: 0, totalQuantity: 0, nearTermQuantity: 0, nearTermCustomers: [], nearTermLabel: '' },
  rows: [],
  ownerOptions: [],
};

const PAGE_SIZE = 10;

function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString('tr-TR');
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartInput() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // pazartesi başlangıç
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

/** Gerçekleşme/hedef hücresi: hedef 0 ise sadece gerçekleşen gösterilir. */
function TargetCell({ actual, target }: { actual: number; target: number }) {
  if (!target) return <span className="sfu-target"><b>{formatNumber(actual)}</b></span>;
  const reached = actual >= target;
  return (
    <span className={`sfu-target ${reached ? 'ok' : 'miss'}`}>
      <b>{formatNumber(actual)}</b> <span>/ {formatNumber(target)}</span>
    </span>
  );
}

export default function SellerFollowupClient() {
  const [tab, setTab] = useState<TabKey>('followup');

  // Yer imiyle açılış (?tab=live) + sekme değişince URL'yi sessizce güncelle.
  useEffect(() => { setTab(tabFromUrl()); }, []);
  const switchTab = useCallback((next: TabKey) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'followup') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
      window.dispatchEvent(new Event('pax:locationchange')); // menü aktifliği güncellensin
    } catch {}
  }, []);
  const [owner, setOwner] = useState('');
  const [payload, setPayload] = useState<FollowupPayload>(EMPTY_FOLLOWUP);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [from, setFrom] = useState(weekStartInput);
  const [to, setTo] = useState(todayInput);
  const [contact, setContact] = useState<ContactOwnerRow[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const loadFollowup = useCallback(async (selectedOwner: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedOwner) params.set('owner', selectedOwner);
      const res = await fetch(`/api/reports/seller-followup${params.toString() ? `?${params}` : ''}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || 'Takip raporu yüklenemedi.');
        setPayload(EMPTY_FOLLOWUP);
        return;
      }
      setPayload({ ...EMPTY_FOLLOWUP, ...json });
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Takip raporu yüklenemedi.');
      setPayload(EMPTY_FOLLOWUP);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContact = useCallback(async () => {
    setContactLoading(true);
    setContactError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/reports/weekly-management-presentation?${params}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as ContactPayload;
      if (!res.ok) {
        setContactError(json?.message || 'Aktivite raporu yüklenemedi.');
        setContact([]);
        return;
      }
      setContact(json?.contactReport?.owners ?? []);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Aktivite raporu yüklenemedi.');
      setContact([]);
    } finally {
      setContactLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void loadFollowup(owner); }, [loadFollowup, owner]);
  useEffect(() => { if (tab === 'activity') void loadContact(); }, [tab, loadContact]);

  const totalPages = Math.max(1, Math.ceil(payload.rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = useMemo(
    () => payload.rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [payload.rows, currentPage],
  );

  const contactTotals = useMemo(() => contact.reduce((acc, row) => ({
    salesPhysical: acc.salesPhysical + row.salesPhysical,
    salesOnline: acc.salesOnline + row.salesOnline,
    salesPhone: acc.salesPhone + row.salesPhone,
    salesEmail: acc.salesEmail + row.salesEmail,
    technicalPhysical: acc.technicalPhysical + row.technicalPhysical,
    technicalOnline: acc.technicalOnline + row.technicalOnline,
    totalActivities: acc.totalActivities + row.totalActivities,
    uniqueCustomers: acc.uniqueCustomers + row.uniqueCustomers,
    targets: {
      salesPhysical: acc.targets.salesPhysical + (row.targets?.salesPhysical ?? 0),
      salesOnline: acc.targets.salesOnline + (row.targets?.salesOnline ?? 0),
      salesPhone: acc.targets.salesPhone + (row.targets?.salesPhone ?? 0),
      salesEmail: acc.targets.salesEmail + (row.targets?.salesEmail ?? 0),
      technicalPhysical: acc.targets.technicalPhysical + (row.targets?.technicalPhysical ?? 0),
      technicalOnline: acc.targets.technicalOnline + (row.targets?.technicalOnline ?? 0),
      totalActivities: acc.targets.totalActivities + (row.targets?.totalActivities ?? 0),
      uniqueCustomers: acc.targets.uniqueCustomers + (row.targets?.uniqueCustomers ?? 0),
    },
  }), {
    salesPhysical: 0, salesOnline: 0, salesPhone: 0, salesEmail: 0,
    technicalPhysical: 0, technicalOnline: 0, totalActivities: 0, uniqueCustomers: 0,
    targets: {
      salesPhysical: 0, salesOnline: 0, salesPhone: 0, salesEmail: 0,
      technicalPhysical: 0, technicalOnline: 0, totalActivities: 0, uniqueCustomers: 0,
    },
  }), [contact]);

  const heroTitle = owner ? `Takip Listesi — ${owner} Portföyü` : 'Takip Listesi — Tüm Portföy';
  const nearTermHint = payload.summary.nearTermCustomers.length
    ? `${payload.summary.nearTermLabel}: ${payload.summary.nearTermCustomers.slice(0, 6).join(', ')}${payload.summary.nearTermCustomers.length > 6 ? '…' : ''}`
    : 'Yakın vadede çözüm tarihi olan takip yok';

  return (
    <main className="sfu-page pax-page-container">
      <section className="sfu-hero">
        <div className="sfu-hero-copy">
          <span className="sfu-eyebrow">Rapor Merkezi · Satışçı Takip</span>
          <h1>{heroTitle}</h1>
          <p>
            Engel &amp; Etki ekranındaki <strong>açık engeller</strong> takip listesine dönüştürülür: konu kimde, hangi modelden kaç adet
            beklemede, takip konusu ve planlanan çözüm tarihi. Çözülmüş engeller listeye girmez.
          </p>
        </div>
        <div className="sfu-hero-actions">
          <select className="sfu-select" value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Satıcı seçimi">
            <option value="">Tüm satıcılar</option>
            {payload.ownerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" className="sfu-btn light" onClick={() => void loadFollowup(owner)} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
      </section>

      <section className="sfu-kpis">
        <div className="sfu-kpi accent">
          <div className="sfu-kpi-value">{formatNumber(payload.summary.openFollowupCount)}</div>
          <div className="sfu-kpi-label">Açık Takip</div>
          <div className="sfu-kpi-hint">{owner ? `${owner} portföyünde` : 'Tüm portföyde'} durumu açık engel</div>
        </div>
        <div className="sfu-kpi">
          <div className="sfu-kpi-value">{formatNumber(payload.summary.totalQuantity)}</div>
          <div className="sfu-kpi-label">Toplam Adet</div>
          <div className="sfu-kpi-hint">Takip listesindeki hesapların forecast adetleri</div>
        </div>
        <div className="sfu-kpi warn">
          <div className="sfu-kpi-value">{formatNumber(payload.summary.nearTermQuantity)}</div>
          <div className="sfu-kpi-label">Yakın Vadeli Takip</div>
          <div className="sfu-kpi-hint">{nearTermHint}</div>
        </div>
      </section>

      <div className="sfu-tabs">
        <button type="button" className={`sfu-tab ${tab === 'followup' ? 'active' : ''}`} onClick={() => switchTab('followup')}>
          Takip Listesi
        </button>
        <button type="button" className={`sfu-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => switchTab('activity')}>
          Kişi Bazlı Aktivite
        </button>
        <button type="button" className={`sfu-tab ${tab === 'live' ? 'active' : ''}`} onClick={() => switchTab('live')} title="Kendi kendine dönen yönetici panosu">
          ● Canlı Ekran
        </button>
      </div>

      {/* Canlı Ekran her zaman bağlı kalır (sekme dışındayken zamanlayıcıları durur);
          böylece sekmeye dönüşte veri anında hazır. */}
      <div style={{ display: tab === 'live' ? 'contents' : 'none' }}>
        <LiveBoard active={tab === 'live'} />
      </div>

      {tab === 'live' ? null : tab === 'followup' ? (
        <section className="sfu-panel">
          <div className="sfu-panel-head">
            <h2>Takip Listesi</h2>
            <span>{formatNumber(payload.rows.length)} kayıt · sayfa {currentPage}/{totalPages}</span>
          </div>

          {error ? <div className="sfu-empty">{error}</div> : null}

          {!error && !loading && !payload.rows.length ? (
            <div className="sfu-empty">Açık engel bulunmuyor — takip listesi boş.</div>
          ) : null}

          {!error && payload.rows.length ? (
            <>
              <div className="sfu-table-wrap">
                <table className="sfu-table">
                  <thead>
                    <tr>
                      <th>Müşteri</th>
                      <th>Konu Kimde</th>
                      <th>Model / Adet</th>
                      <th>Takip Konusu</th>
                      <th>Çözüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.customerId}>
                        <td>
                          <span className="sfu-customer">{row.musteri}</span>
                          {row.sektor ? <span className="sfu-sector">{row.sektor}</span> : null}
                        </td>
                        <td>
                          {row.konuKimde}
                          {row.konuKimdeTipi && row.konuKimdeTipi !== row.konuKimde
                            ? <span className="sfu-sector">{row.konuKimdeTipi}</span>
                            : null}
                        </td>
                        <td className="nowrap">{row.modelAdetLabel}</td>
                        <td>
                          {row.takipKonusu}
                          {row.notes && row.notes.trim() !== row.takipKonusu.trim()
                            ? <span className="sfu-note">{row.notes}</span>
                            : null}
                        </td>
                        <td className="nowrap">
                          <span className={`sfu-pill ${row.overdue ? 'overdue' : row.nearTerm ? 'near' : ''}`}>
                            {formatDate(row.cozumTarihi)}
                          </span>
                          {row.overdue ? <span className="sfu-note">Tarih geçti</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sfu-pager">
                <span className="sfu-pager-info">
                  Sayfa başına 10 firma · {formatNumber(payload.rows.length)} kaydın {formatNumber(visibleRows.length)} tanesi görünüyor
                </span>
                <div className="sfu-pager-buttons">
                  <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
                    Önceki
                  </button>
                  <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages}>
                    Sonraki
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : (
        <section className="sfu-panel">
          <div className="sfu-panel-head">
            <h2>Temas Edilen Müşteriler — Kişi Bazlı Özet</h2>
            <span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Başlangıç tarihi" />
              {' — '}
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Bitiş tarihi" />
              {' '}
              <button type="button" className="sfu-tab" onClick={() => void loadContact()} disabled={contactLoading}>
                {contactLoading ? 'Yükleniyor…' : 'Getir'}
              </button>
            </span>
          </div>

          {contactError ? <div className="sfu-empty">{contactError}</div> : null}
          {!contactError && !contactLoading && !contact.length ? (
            <div className="sfu-empty">Seçilen tarih aralığında aktivite kaydı bulunmuyor.</div>
          ) : null}

          {!contactError && contact.length ? (
            <div className="sfu-table-wrap">
              <table className="sfu-table">
                <thead>
                  <tr>
                    <th>Sorumlu</th>
                    <th>Satış Fiziki</th>
                    <th>Satış Online</th>
                    <th>Satış Telefon</th>
                    <th>Satış E-posta</th>
                    <th>Teknik Fiziki</th>
                    <th>Teknik Online</th>
                    <th>Toplam Aktivite</th>
                    <th>Tekil Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {contact.map((row) => (
                    <tr key={row.owner}>
                      <td className="sfu-customer">{row.owner}</td>
                      <td className="num"><TargetCell actual={row.salesPhysical} target={row.targets?.salesPhysical ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.salesOnline} target={row.targets?.salesOnline ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.salesPhone} target={row.targets?.salesPhone ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.salesEmail} target={row.targets?.salesEmail ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.technicalPhysical} target={row.targets?.technicalPhysical ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.technicalOnline} target={row.targets?.technicalOnline ?? 0} /></td>
                      <td className="num"><TargetCell actual={row.totalActivities} target={row.targets?.totalActivities ?? 0} /></td>
                      <td className="num">{formatNumber(row.uniqueCustomers)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Toplam</td>
                    <td className="num"><TargetCell actual={contactTotals.salesPhysical} target={contactTotals.targets.salesPhysical} /></td>
                    <td className="num"><TargetCell actual={contactTotals.salesOnline} target={contactTotals.targets.salesOnline} /></td>
                    <td className="num"><TargetCell actual={contactTotals.salesPhone} target={contactTotals.targets.salesPhone} /></td>
                    <td className="num"><TargetCell actual={contactTotals.salesEmail} target={contactTotals.targets.salesEmail} /></td>
                    <td className="num"><TargetCell actual={contactTotals.technicalPhysical} target={contactTotals.targets.technicalPhysical} /></td>
                    <td className="num"><TargetCell actual={contactTotals.technicalOnline} target={contactTotals.targets.technicalOnline} /></td>
                    <td className="num"><TargetCell actual={contactTotals.totalActivities} target={contactTotals.targets.totalActivities} /></td>
                    <td className="num">{formatNumber(contactTotals.uniqueCustomers)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
