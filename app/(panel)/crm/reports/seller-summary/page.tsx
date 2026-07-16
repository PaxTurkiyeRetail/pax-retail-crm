'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import '@/styles/seller-summary.css';

type SummaryItem = { label: string; value: number };
type NoPhaseRow = { musteri: string; sorumlu: string; kunye: string; sektor: string };
type ActivityRow = { id: string; tarih: string; musteri: string; sorumlu: string; aktiviteyi_giren: string; faz: string; not: string };

type Payload = {
  sellerOptions: string[];
  selectedSeller: string;
  kpi: {
    total: number;
    kunyeTamam: number;
    kunyeEksik: number;
    kunyeYok: number;
    activeCustomers: number;
    withPhase: number;
    withoutPhase: number;
    phaseCoveragePct: number;
    kunyeCompletionPct: number;
    recentActivityGap: number;
  };
  phaseSummary: SummaryItem[];
  detailPhaseSummary: SummaryItem[];
  kunyeSummary: SummaryItem[];
  noPhaseRows: NoPhaseRow[];
  noPhaseTotal: number;
  recentActivities: ActivityRow[];
};

const EMPTY: Payload = {
  sellerOptions: [],
  selectedSeller: '',
  kpi: { total: 0, kunyeTamam: 0, kunyeEksik: 0, kunyeYok: 0, activeCustomers: 0, withPhase: 0, withoutPhase: 0, phaseCoveragePct: 0, kunyeCompletionPct: 0, recentActivityGap: 0 },
  phaseSummary: [],
  detailPhaseSummary: [],
  kunyeSummary: [],
  noPhaseRows: [],
  noPhaseTotal: 0,
  recentActivities: [],
};

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SummaryBars({ items, tone }: { items: SummaryItem[]; tone: 'blue' | 'orange' | 'violet' }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="seller-bars">
      {items.map((item) => (
        <div key={item.label} className="seller-bar-row">
          <div className="seller-bar-top"><span>{item.label}</span><strong>{item.value}</strong></div>
          <div className="seller-bar-track"><div className={`seller-bar-fill ${tone}`} style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function DonutLike({ title, items }: { title: string; items: SummaryItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="seller-card seller-panel">
      <div className="seller-panel-head"><h3>{title}</h3><span>{total}</span></div>
      <div className="seller-donut-list">
        {items.map((item) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="seller-donut-row">
              <div className="seller-donut-label"><span className="seller-dot" />{item.label}</div>
              <div className="seller-donut-meta"><strong>{item.value}</strong><span>%{pct}</span></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SellerSummaryPage() {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [seller, setSeller] = useState('Tüm Satıcılar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load fonksiyonu useCallback ile sabit referans — useEffect bağımlılık sorununu çözer
  const load = useCallback(async (selected?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selected) params.set('seller', selected);
      const res = await fetch(`/api/reports/seller-summary${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || 'Rapor yüklenemedi.');
        setPayload(EMPTY);
        return;
      }
      const merged = { ...EMPTY, ...json };
      setPayload(merged);
      // İlk yüklemede API'nin seçtiği satıcıyı state'e yaz
      if (!selected && merged.selectedSeller) {
        setSeller(merged.selectedSeller);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme
  useEffect(() => { void load(); }, [load]);

  // Satıcı değişince yeniden yükle
  const handleSellerChange = (newSeller: string) => {
    setSeller(newSeller);
    void load(newSeller);
  };

  const actionCards = useMemo(() => ([
    { label: 'Fazı girilmemiş firma', value: payload.kpi.withoutPhase },
    { label: 'Künyesi eksik veya boş firma', value: payload.kpi.kunyeEksik + payload.kpi.kunyeYok },
    { label: 'Son 90 günde aktivite olmayan firma', value: payload.kpi.recentActivityGap },
  ]), [payload]);

  return (
    <main className="seller-summary-page">
      <section className="seller-hero-grid">
        <div className="seller-card seller-hero">
          <div className="seller-hero-top">
            <div>
              <div className="seller-eyebrow">Analiz · Account Özeti</div>
              <h1>Satışçı / account faz raporu</h1>
              <p>Müşteri, İş Ortakları ve özel portföy kayıtları dahil tüm sorumluları tek ekranda izler; firma, künye, faz ve aktivite boşluklarını gösterir.</p>
            </div>
            <div className="seller-select-wrap">
              <label htmlFor="sellerSelect">Account / Grup</label>
              <select
                id="sellerSelect"
                className="seller-select"
                value={seller}
                onChange={(e) => handleSellerChange(e.target.value)}
              >
                {payload.sellerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="seller-kpi-grid">
            <article className="seller-kpi-card"><span>Toplam Firma</span><strong>{payload.kpi.total}</strong></article>
            <article className="seller-kpi-card"><span>Künye Tamamlanma</span><strong>%{payload.kpi.kunyeCompletionPct}</strong></article>
            <article className="seller-kpi-card"><span>Faz Kapsaması</span><strong>%{payload.kpi.phaseCoveragePct}</strong></article>
            <article className="seller-kpi-card"><span>Aktif Firma (90g)</span><strong>{payload.kpi.activeCustomers}</strong></article>
          </div>
        </div>

        <aside className="seller-card seller-actions">
          <h2>Aksiyon Gerekenler</h2>
          <div className="seller-action-list">
            {actionCards.map((item) => (
              <div key={item.label} className="seller-action-item">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {error ? <div className="seller-alert seller-error">{error}</div> : null}
      {loading ? <div className="seller-alert">Rapor yükleniyor…</div> : null}

      <section className="seller-summary-grid">
        <DonutLike title="Künye Durumu" items={payload.kunyeSummary} />
        <section className="seller-card seller-panel">
          <div className="seller-panel-head"><h3>Faz Dağılımı</h3><span>{payload.kpi.total}</span></div>
          <SummaryBars items={payload.phaseSummary} tone="blue" />
        </section>
      </section>

      <section className="seller-summary-grid bottom">
        <section className="seller-card seller-panel">
          {/* Düzeltme: detailPhaseSummary.length (grup sayısı) yerine kpi.total (firma sayısı) */}
          <div className="seller-panel-head"><h3>Faz Kırılımı</h3><span>{payload.kpi.total}</span></div>
          <SummaryBars items={payload.detailPhaseSummary} tone="violet" />
        </section>
        <section className="seller-card seller-panel">
          <div className="seller-panel-head"><h3>Künye Kırılımı</h3><span>{payload.kpi.total}</span></div>
          <SummaryBars items={payload.kunyeSummary} tone="orange" />
        </section>
      </section>

      <section className="seller-table-grid">
        <section className="seller-card seller-panel">
          <div className="seller-panel-head">
            <h3>Fazı Girilmemiş Firmalar</h3>
            <span>{payload.noPhaseTotal}</span>
          </div>
          <div className="seller-table-wrap">
            <table className="seller-table">
              <thead><tr><th>Firma</th><th>Satıcı</th><th>Künye</th><th>Sektör</th></tr></thead>
              <tbody>
                {payload.noPhaseRows.map((row) => (
                  <tr key={`${row.musteri}-${row.sorumlu}`}><td>{row.musteri}</td><td>{row.sorumlu}</td><td>{row.kunye}</td><td>{row.sektor}</td></tr>
                ))}
                {!payload.noPhaseRows.length ? <tr><td colSpan={4} className="seller-empty">Fazı girilmemiş firma yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="seller-card seller-panel">
          <div className="seller-panel-head"><h3>Son Aktiviteler</h3><span>{payload.recentActivities.length}</span></div>
          <div className="seller-table-wrap">
            <table className="seller-table">
              <thead><tr><th>Tarih</th><th>Firma</th><th>Aktiviteyi Giren</th><th>Faz</th><th>Not</th></tr></thead>
              <tbody>
                {payload.recentActivities.map((row) => (
                  <tr key={row.id}><td>{formatDate(row.tarih)}</td><td>{row.musteri}</td><td>{row.aktiviteyi_giren}</td><td>{row.faz}</td><td>{row.not}</td></tr>
                ))}
                {!payload.recentActivities.length ? <tr><td colSpan={5} className="seller-empty">Aktivite bulunamadı.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
