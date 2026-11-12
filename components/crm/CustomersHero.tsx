'use client';

import '@/styles/customers-hero.css';

type Props = {
  total: number;
  kunyeTamam: number;
  kunyeEksik: number;
  /** Sektörü girilmemiş müşteri sayısı. */
  sektorEksik: number;
  accountCount: number;
};

const fmt = (value: number) => value.toLocaleString('tr-TR');

export default function CustomersHero({ total, kunyeTamam, kunyeEksik, sektorEksik, accountCount }: Props) {
  const pct = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const kunyePct = pct(kunyeTamam);

  return (
    <>
      <section className="pax-hero ch-hero">
        <h1 className="pax-hero-title">Müşteriler</h1>
        <p className="pax-hero-description">Portföydeki tüm müşteriler; faz, künye ve account bilgisiyle.</p>
      </section>

      <div className="ch-kpis">
        <div className="ch-kpi" style={{ boxShadow: 'inset 3px 0 0 #4f46e5' }}>
          <span className="ch-kpi-label">Toplam müşteri</span>
          <strong className="ch-kpi-value">{fmt(total)}</strong>
          <span className="ch-kpi-hint">{accountCount} account üzerinde</span>
        </div>
        <div className="ch-kpi" style={{ boxShadow: 'inset 3px 0 0 #16a34a' }}>
          <span className="ch-kpi-label">Künyesi tamam</span>
          <strong className="ch-kpi-value">{fmt(kunyeTamam)} <small>%{kunyePct}</small></strong>
          <span className="ch-kpi-bar"><span style={{ width: `${kunyePct}%`, background: '#16a34a' }} /></span>
        </div>
        <div className="ch-kpi" style={{ boxShadow: 'inset 3px 0 0 #f59e0b' }}>
          <span className="ch-kpi-label">Künyesi eksik</span>
          <strong className="ch-kpi-value">{fmt(kunyeEksik)} <small>%{pct(kunyeEksik)}</small></strong>
          <span className="ch-kpi-bar"><span style={{ width: `${pct(kunyeEksik)}%`, background: '#f59e0b' }} /></span>
        </div>
        <div className="ch-kpi" style={{ boxShadow: 'inset 3px 0 0 #e11d48' }}>
          <span className="ch-kpi-label">Sektörü girilmemiş</span>
          <strong className="ch-kpi-value">{fmt(sektorEksik)} <small>%{pct(sektorEksik)}</small></strong>
          <span className="ch-kpi-bar"><span style={{ width: `${pct(sektorEksik)}%`, background: '#e11d48' }} /></span>
        </div>
      </div>
    </>
  );
}
