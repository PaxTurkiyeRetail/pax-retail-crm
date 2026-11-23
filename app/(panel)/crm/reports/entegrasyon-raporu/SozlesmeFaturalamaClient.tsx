'use client';

import '@/styles/reports-kasapos-entegrasyon.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SozlesmeFaturalamaPayload, BillingSaleRow } from '@/lib/reports/sozlesme-faturalama';
import { VChart } from './KasaposEntegrasyonClient';

// Sözleşme / Faturalama raporu (054) — KasaPOS Adet & Tutar sekmesiyle aynı görünüm.
// Faturalama tarihi = fatura başlangıç tarihi, girilmemişse satış tarihi.

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const BLUE = '#1F5FAF';
const BLUE_L = '#BCD3EE';
const TEAL = '#0F7B73';
const TEAL_L = '#A8D0C9';
const ORANGE = '#B85C14';
const NAVY = '#13213C';

const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const fmt = (n: number) => nf.format(Math.round(n));
const usd = (n: number) => `${nf.format(Math.round(n))} $`;
const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const signed = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : '-'}%${Math.abs(n)}`);
const barW = (v: number, max: number) => (max > 0 ? Math.max((v / max) * 100, v > 0 ? 2 : 0) : 0);
const dt = (v: string | null) => (v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const TYPE_LABEL: Record<string, string> = { sale: 'Satış', rental: 'Kiralama', mixed: 'Satış + Kiralama' };

export default function SozlesmeFaturalamaClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<SozlesmeFaturalamaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/sozlesme-faturalama?year=${y}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Rapor yüklenemedi.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(year); }, [load, year]);

  const view = useMemo(() => {
    if (!data) return null;
    const ref = data.refMonthIndex;
    const mIdx = (i: number) => Number(data.months[i]?.slice(5, 7)) - 1;
    const refAy = AY[mIdx(ref)] ?? '';
    const prevAy = ref > 0 ? AY[mIdx(ref - 1)] : '';
    const idxs = data.months.map((_, i) => i);
    // Birden fazla yıla yayılıyorsa ay adına yıl eki (Mar '27).
    const multiYear = data.months[0]?.slice(0, 4) !== data.months[data.months.length - 1]?.slice(0, 4);
    const yEk = (i: number) => (multiYear ? ` '${data.months[i].slice(2, 4)}` : '');
    const ayAdi = idxs.map((i) => `${AY[mIdx(i)]}${multiYear ? ` ${data.months[i].slice(0, 4)}` : ''}`);
    const ayKisa = idxs.map((i) => `${AY_KISA[mIdx(i)]}${yEk(i)}`);
    const first = data.months[0];
    const last = data.months[data.months.length - 1];
    const period = `${AY[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}–${AY[Number(last.slice(5, 7)) - 1]} ${last.slice(0, 4)}`;
    const maxAdet = Math.max(0, ...data.monthly.map((m) => m.adet));
    // Firma × ay (faturalama tarihine göre cihaz adedi).
    const firms = new Map<string, { musteri: string; cells: number[]; tutar: number; cihaz: number }>();
    for (const r of data.rows) {
      const i = data.months.indexOf(r.billingDate.slice(0, 7));
      if (i < 0) continue;
      const f = firms.get(r.customerId) ?? { musteri: r.musteri, cells: idxs.map(() => 0), tutar: 0, cihaz: 0 };
      f.cells[i] += r.devices;
      f.cihaz += r.devices;
      f.tutar += r.amount;
      firms.set(r.customerId, f);
    }
    const firmRows = [...firms.entries()].map(([id, f]) => ({ id, ...f })).sort((a, b) => b.cihaz - a.cihaz || b.tutar - a.tutar);
    return { ref, refAy, prevAy, idxs, ayAdi, ayKisa, maxAdet, firmRows, period };
  }, [data]);

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const period = view?.period ?? '';
  const detail: BillingSaleRow[] = (data?.rows ?? []).filter((r) => !onlyMissing || r.fromSaleDate);

  return (
    <main className="pax-page-container">
      <div className="kpe">
        <section className="kpe-section">
          <div className="kpe-head">
            <div>
              <div className="kpe-brand">PAX Türkiye Retail Solutions</div>
              <h1 className="kpe-title">Sözleşme ve faturalama başlangıçları{period ? `, ${period}` : ''}</h1>
            </div>
            <div>
              <div className="kpe-source">Kaynak: Satışlar · Sözleşme / Faturalama<br />{today}</div>
              <div className="kpe-tools no-print">
                <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {[currentYear, currentYear - 1].map((y) => <option key={y} value={y}>{y}&apos;dan itibaren</option>)}
                </select>
                <button type="button" onClick={() => window.print()} disabled={!data}>PDF / Yazdır</button>
              </div>
            </div>
          </div>

          {data && data.kpi.faturaGirilmemis > 0 && (
            <div className="kpe-warn no-print">
              ⚠ {data.kpi.faturaGirilmemis} satışta fatura başlangıç tarihi girilmemiş — bu kayıtlar satış tarihine göre sayıldı.
              Satışlar › Düzenle › Sözleşme / Faturalama&apos;dan girin.
            </div>
          )}
          {error && <div className="kpe-error">{error}</div>}
          {loading && <div className="kpe-card muted">Yükleniyor…</div>}
          {!loading && data && data.rows.length === 0 && (
            <div className="kpe-card muted">
              {data.year} için sözleşme / faturalama bilgisi girilmiş satış yok. Satışlar › Düzenle › Sözleşme / Faturalama&apos;dan girildikçe burada görünür.
            </div>
          )}

          {!loading && data && view && (
            <>
              <div className="kpe-kpis">
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} faturalama başlangıcı</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.refAdet)} satış</div>
                  <div className="kpe-kpi-sub c-blue">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refAdet, data.kpi.prevAdet))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} cihaz</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.refCihaz)}</div>
                  <div className="kpe-kpi-sub c-blue">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refCihaz, data.kpi.prevCihaz))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} tutar</div>
                  <div className="kpe-kpi-val">{usd(data.kpi.refTutar)}</div>
                  <div className="kpe-kpi-sub c-teal">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refTutar, data.kpi.prevTutar))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">Yıl toplamı</div>
                  <div className="kpe-kpi-val">{usd(data.kpi.toplamTutar)}</div>
                  <div className="kpe-kpi-sub muted"><b style={{ color: NAVY }}>{fmt(data.kpi.toplamAdet)}</b> satış · aylık kira <b style={{ color: NAVY }}>{usd(data.kpi.toplamKira)}</b></div>
                </div>
              </div>

              <div className="kpe-row3">
                <div className="kpe-card">
                  <h3>Aylık faturalama başlangıcı</h3>
                  <div className="kpe-trend-head"><i /><i /><span>Satış</span><span>Tutar</span></div>
                  {view.idxs.slice().reverse().map((i) => {
                    const m = data.monthly[i];
                    return (
                      <div key={i} className="kpe-trend-row">
                        <span>{view.ayAdi[i]}</span>
                        <div><div className="kpe-hbar" style={{ width: `${barW(m.adet, view.maxAdet)}%`, background: i === view.ref ? BLUE : BLUE_L }} /></div>
                        <b className="r num">{fmt(m.adet)}</b>
                        <b className="r num">{usd(m.tutar)}</b>
                      </div>
                    );
                  })}
                </div>

                <div className="kpe-card">
                  <h3>Tarih kaynağı</h3>
                  <table className="kpe-ytd">
                    <thead><tr><th /><th>Satış</th><th>Oran</th></tr></thead>
                    <tbody>
                      <tr><td>Fatura başlangıcı girilen</td><td>{fmt(data.kpi.toplamAdet - data.kpi.faturaGirilmemis)}</td><td className="g c-teal">%{data.kpi.toplamAdet ? Math.round(((data.kpi.toplamAdet - data.kpi.faturaGirilmemis) / data.kpi.toplamAdet) * 100) : 0}</td></tr>
                      <tr><td>Satış tarihi kullanılan</td><td>{fmt(data.kpi.faturaGirilmemis)}</td><td className="g" style={{ color: ORANGE }}>%{data.kpi.toplamAdet ? Math.round((data.kpi.faturaGirilmemis / data.kpi.toplamAdet) * 100) : 0}</td></tr>
                    </tbody>
                  </table>
                  <p className="kpe-note">Faturalama tarihi = fatura başlangıç tarihi; girilmemişse satış tarihi.</p>
                </div>

                <div className="kpe-card">
                  <h3>Devam eden sözleşmeler ({view.refAy})</h3>
                  <table className="kpe-ytd">
                    <tbody>
                      <tr><td>Sözleşme</td><td className="g">{fmt(data.ongoing[view.ref]?.adet ?? 0)}</td></tr>
                      <tr><td>Cihaz</td><td className="g">{fmt(data.ongoing[view.ref]?.cihaz ?? 0)}</td></tr>
                      <tr><td>Aylık kira</td><td className="g">{usd(data.ongoing[view.ref]?.kira ?? 0)}</td></tr>
                    </tbody>
                  </table>
                  <p className="kpe-note">Sözleşme, fatura başlangıcından bitiş tarihine kadar her ay devam eder; bitiş yoksa süresiz. Bitiş: Satışlar › Düzenle › Bitir.</p>
                </div>
              </div>
            </>
          )}
        </section>

        {!loading && data && view && (
          <>
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Aylık cihaz ve tutar (faturalama tarihine göre), {period}</h2>
              <div className="kpe-card">
                <div className="kpe-chart-title c-blue">Cihaz</div>
                <VChart values={data.monthly.map((m) => m.cihaz)} labels={view.ayKisa} refIdx={view.ref} color={BLUE} colorL={BLUE_L} />
                <hr className="kpe-divider" />
                <div className="kpe-chart-title c-teal">Tutar</div>
                <VChart values={data.monthly.map((m) => m.tutar)} labels={view.ayKisa} refIdx={view.ref} color={TEAL} colorL={TEAL_L} money />
                <hr className="kpe-divider" />
                <div className="kpe-chart-title c-blue">Devam eden sözleşmeler — toplam cihaz (kümülatif)</div>
                <VChart values={data.ongoing.map((m) => m.cihaz)} labels={view.ayKisa} refIdx={view.ref} color={BLUE} colorL={BLUE_L} />
              </div>
            </section>

            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Firmalar, faturalama başlangıç ayına göre cihaz</h2>
              <div className="kpe-card kpe-scroll">
                <table className="kpe-gtable">
                  <thead>
                    <tr>
                      <th className="idx">#</th>
                      <th className="l">Firma</th>
                      {view.ayKisa.map((a, i) => <th key={i}>{a}</th>)}
                      <th>Cihaz</th>
                      <th>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.firmRows.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="idx">{idx + 1}</td>
                        <td className="l firm">{r.musteri}</td>
                        {r.cells.map((v, i) => <td key={i} className={v ? (i === view.ref ? 'ref-blue' : undefined) : 'empty'}>{v ? fmt(v) : '–'}</td>)}
                        <td className="tot">{fmt(r.cihaz)}</td>
                        <td className="tot">{usd(r.tutar)}</td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td />
                      <td className="l">Toplam, {view.firmRows.length} firma</td>
                      {data.monthly.map((m, i) => <td key={i}>{fmt(m.cihaz)}</td>)}
                      <td>{fmt(data.monthly.reduce((s, m) => s + m.cihaz, 0))}</td>
                      <td>{usd(data.kpi.toplamTutar)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Sözleşme / faturalama detayı</h2>
              <label className="kpe-help no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
                Yalnız fatura başlangıcı girilmemiş satışlar ({fmt(data.kpi.faturaGirilmemis)})
              </label>
              <div className="kpe-card kpe-scroll">
                <table className="kpe-htable">
                  <thead>
                    <tr>
                      <th className="l">#</th>
                      <th className="l">Firma</th>
                      <th className="l">Satıcı</th>
                      <th className="l">Tip</th>
                      <th>Satış tarihi</th>
                      <th>Faturalama tarihi</th>
                      <th className="l">Sözleşme no</th>
                      <th>Durum</th>
                      <th>Cihaz</th>
                      <th>Tutar</th>
                      <th>Aylık kira</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((r, idx) => (
                      <tr key={r.saleId}>
                        <td className="l idx">{idx + 1}</td>
                        <td className="l firm">{r.musteri}</td>
                        <td className="l">{r.owner}</td>
                        <td className="l">{TYPE_LABEL[r.saleType] ?? r.saleType}</td>
                        <td>{dt(r.saleDate)}</td>
                        <td title={r.fromSaleDate ? 'Fatura başlangıcı girilmemiş — satış tarihi kullanıldı' : 'Fatura başlangıç tarihi'} style={{ color: r.fromSaleDate ? ORANGE : undefined, fontWeight: 700 }}>
                          {dt(r.billingDate)}{r.fromSaleDate ? ' *' : ''}
                        </td>
                        <td className="l">{r.contractNo ?? <span className="c-muted">–</span>}</td>
                        <td className={r.contractEnd ? undefined : 'c-teal'} style={r.contractEnd ? { color: ORANGE } : undefined}>{r.contractEnd ? `Bitti ${dt(r.contractEnd)}` : 'Devam ediyor'}</td>
                        <td>{fmt(r.devices)}</td>
                        <td>{usd(r.amount)}</td>
                        <td className={r.rentalMonthly ? undefined : 'c-muted'}>{r.rentalMonthly ? usd(r.rentalMonthly) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="kpe-note">* Fatura başlangıç tarihi girilmemiş; satış tarihi kullanıldı.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
