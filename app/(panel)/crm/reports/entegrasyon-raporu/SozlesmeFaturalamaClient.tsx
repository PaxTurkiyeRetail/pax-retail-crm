'use client';

import '@/styles/reports-kasapos-entegrasyon.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SozlesmeFaturalamaPayload, ContractFirmRow } from '@/lib/reports/sozlesme-faturalama';
import { VChart } from './KasaposEntegrasyonClient';

// Sözleşme / Faturalama raporu (057) — kaynak Hizmet Faturaları, KasaPOS Adet & Tutar ile aynı süzgeç.
// Sözleşme başlangıcından bitişine kadar (bitiş yoksa süresiz) her ay devam eder; faturasız ay son faturadan taşınır.

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
const ayStr = (k: string) => `${AY_KISA[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

export default function SozlesmeFaturalamaClient() {
  const year = new Date().getFullYear();
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
    // Ekran bu aydan başlar; önceki ay (kıyas) listede yok, takvimden alınır.
    const prevAy = AY[(mIdx(ref) + 11) % 12] ?? '';
    const idxs = data.months.map((_, i) => i);
    const multiYear = data.months[0]?.slice(0, 4) !== data.months[data.months.length - 1]?.slice(0, 4);
    const yEk = (i: number) => (multiYear ? ` '${data.months[i].slice(2, 4)}` : '');
    const ayAdi = idxs.map((i) => `${AY[mIdx(i)]}${multiYear ? ` ${data.months[i].slice(0, 4)}` : ''}`);
    const ayKisa = idxs.map((i) => `${AY_KISA[mIdx(i)]}${yEk(i)}`);
    const first = data.months[0];
    const last = data.months[data.months.length - 1];
    const period = `${AY[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}–${AY[Number(last.slice(5, 7)) - 1]} ${last.slice(0, 4)}`;
    const maxAdet = Math.max(0, ...data.monthly.map((m) => m.adet));
    return { ref, refAy, prevAy, idxs, ayAdi, ayKisa, maxAdet, period };
  }, [data]);

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const period = view?.period ?? '';
  const detail: ContractFirmRow[] = (data?.rows ?? []).filter((r) => !onlyMissing || r.fromPeriod);

  return (
    <main className="pax-page-container">
      <div className="kpe">
        <section className="kpe-section">
          <div className="kpe-head">
            <div>
              <div className="kpe-brand">PAX Türkiye Retail Solutions</div>
              <h1 className="kpe-title">KasaPOS sözleşme ve faturalama{period ? `, ${period}` : ''}</h1>
            </div>
            <div>
              <div className="kpe-source">Kaynak: Satışlar › Hizmet Faturaları<br />{today}</div>
              <div className="kpe-tools no-print">
                <button type="button" onClick={() => window.print()} disabled={!data}>PDF / Yazdır</button>
              </div>
            </div>
          </div>

          {data && data.kpi.baslangicGirilmemis > 0 && (
            <div className="kpe-warn no-print">
              ⚠ {data.kpi.baslangicGirilmemis} firmada sözleşme başlangıcı girilmemiş — ilk fatura dönemi başlangıç sayıldı.
              Satışlar › Hizmet Faturaları › Düzenle&apos;den girin.
            </div>
          )}
          {error && <div className="kpe-error">{error}</div>}
          {loading && <div className="kpe-card muted">Yükleniyor…</div>}
          {!loading && data && data.rows.length === 0 && (
            <div className="kpe-card muted">{data.year} için KasaPOS hizmet faturası yok.</div>
          )}

          {!loading && data && view && (
            <>
              <div className="kpe-kpis">
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} aktif sözleşme</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.refFirma)} firma</div>
                  <div className="kpe-kpi-sub c-blue">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refFirma, data.kpi.prevFirma))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} KasaPOS adet</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.refAdet)}</div>
                  <div className="kpe-kpi-sub c-blue">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refAdet, data.kpi.prevAdet))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} tutar</div>
                  <div className="kpe-kpi-val">{usd(data.kpi.refTutar)}</div>
                  <div className="kpe-kpi-sub c-teal">{view.prevAy ? <>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refTutar, data.kpi.prevTutar))}</b></> : '—'}</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">Sözleşmeler</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.toplamFirma)} firma</div>
                  <div className="kpe-kpi-sub muted"><b style={{ color: NAVY }}>{fmt(data.kpi.devamEden)}</b> devam · <b style={{ color: ORANGE }}>{fmt(data.kpi.biten)}</b> bitti</div>
                </div>
              </div>

              <div className="kpe-row3">
                <div className="kpe-card">
                  <h3>Aylık KasaPOS adet / tutar</h3>
                  <div className="kpe-trend-head"><i /><i /><span>Adet</span><span>Tutar</span></div>
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
                  <h3>Başlangıç kaynağı</h3>
                  <table className="kpe-ytd">
                    <thead><tr><th /><th>Firma</th><th>Oran</th></tr></thead>
                    <tbody>
                      <tr><td>Sözleşme başlangıcı girilen</td><td>{fmt(data.kpi.toplamFirma - data.kpi.baslangicGirilmemis)}</td><td className="g c-teal">%{data.kpi.toplamFirma ? Math.round(((data.kpi.toplamFirma - data.kpi.baslangicGirilmemis) / data.kpi.toplamFirma) * 100) : 0}</td></tr>
                      <tr><td>İlk fatura dönemi kullanılan</td><td>{fmt(data.kpi.baslangicGirilmemis)}</td><td className="g" style={{ color: ORANGE }}>%{data.kpi.toplamFirma ? Math.round((data.kpi.baslangicGirilmemis / data.kpi.toplamFirma) * 100) : 0}</td></tr>
                    </tbody>
                  </table>
                  <p className="kpe-note">Başlangıç = hizmet faturasındaki sözleşme başlangıcı; girilmemişse ilk fatura dönemi.</p>
                </div>

                <div className="kpe-card">
                  <h3>Devam eden sözleşmeler ({view.refAy})</h3>
                  <table className="kpe-ytd">
                    <tbody>
                      <tr><td>Firma</td><td className="g">{fmt(data.kpi.refFirma)}</td></tr>
                      <tr><td>KasaPOS adet</td><td className="g">{fmt(data.kpi.refAdet)}</td></tr>
                      <tr><td>Yaklaşan bitiş (90 gün)</td><td className="g">{fmt(data.kpi.yaklasanBitis)}</td></tr>
                    </tbody>
                  </table>
                  <p className="kpe-note">Sözleşme bitiş tarihine kadar her ay devam eder; bitiş yoksa süresiz. Faturası henüz kesilmemiş ay son faturadan taşınır. Kiralama satışları fatura başlangıcından itibaren KasaPOS sayılarının üstüne eklenir ({view.refAy}: {fmt(data.monthly[view.ref]?.satisAdet ?? 0)} adet).</p>
                </div>
              </div>
            </>
          )}
        </section>

        {!loading && data && view && (
          <>
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Aylık KasaPOS adet ve tutar (devam eden sözleşmeler), {period}</h2>
              <div className="kpe-card">
                <div className="kpe-chart-title c-blue">Adet</div>
                <VChart values={data.monthly.map((m) => m.adet)} labels={view.ayKisa} refIdx={view.ref} color={BLUE} colorL={BLUE_L} />
                <hr className="kpe-divider" />
                <div className="kpe-chart-title c-teal">Tutar</div>
                <VChart values={data.monthly.map((m) => m.tutar)} labels={view.ayKisa} refIdx={view.ref} color={TEAL} colorL={TEAL_L} money />
              </div>
            </section>

            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Firmalar, aylara göre KasaPOS adet</h2>
              <div className="kpe-card kpe-scroll">
                <table className="kpe-gtable">
                  <thead>
                    <tr>
                      <th className="idx">#</th>
                      <th className="l">Firma</th>
                      {view.ayKisa.map((a, i) => <th key={i}>{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, idx) => (
                      <tr key={`${r.source}-${r.customerId}`}>
                        <td className="idx">{idx + 1}</td>
                        <td className="l firm">{r.musteri}{r.source === 'satis' ? <span className="c-muted"> · kiralama</span> : null}</td>
                        {r.cells.map((c, i) => (
                          <td
                            key={i}
                            className={c.adet ? (i === view.ref ? 'ref-blue' : undefined) : 'empty'}
                            style={c.adet && !c.actual ? { fontStyle: 'italic', opacity: 0.6 } : undefined}
                            title={c.adet && !c.actual ? 'Fatura yok — son faturadan taşındı' : undefined}
                          >
                            {c.adet ? fmt(c.adet) : '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="total">
                      <td />
                      <td className="l">Toplam, {data.rows.length} firma</td>
                      {data.monthly.map((m, i) => <td key={i}>{fmt(m.adet)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="kpe-note">Soluk / italik: o ay fatura yok, sözleşme sürdüğü için son faturanın değeri taşındı.</p>
            </section>

            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Sözleşme detayı</h2>
              <label className="kpe-help no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
                Yalnız sözleşme başlangıcı girilmemiş firmalar ({fmt(data.kpi.baslangicGirilmemis)})
              </label>
              <div className="kpe-card kpe-scroll">
                <table className="kpe-htable">
                  <thead>
                    <tr>
                      <th className="l">#</th>
                      <th className="l">Firma</th>
                      <th className="l">Kaynak</th>
                      <th className="l">Satıcı</th>
                      <th>Sözleşme başlangıcı</th>
                      <th>Durum</th>
                      <th>Kayıt</th>
                      <th>Son kayıt</th>
                      <th>Adet</th>
                      <th>Aylık tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((r, idx) => (
                      <tr key={`${r.source}-${r.customerId}`}>
                        <td className="l idx">{idx + 1}</td>
                        <td className="l firm">{r.musteri}</td>
                        <td className="l">{r.source === 'satis' ? 'Satış (kiralama)' : 'Hizmet faturası'}</td>
                        <td className="l">{r.owner}</td>
                        <td title={r.fromPeriod ? (r.source === 'satis' ? 'Fatura başlangıcı girilmemiş — satış tarihi' : 'Sözleşme başlangıcı girilmemiş — ilk fatura dönemi') : 'Sözleşme başlangıcı'} style={{ color: r.fromPeriod ? ORANGE : undefined, fontWeight: 700 }}>
                          {dt(r.start)}{r.fromPeriod ? ' *' : ''}
                        </td>
                        <td className={r.end ? undefined : 'c-teal'} style={r.end ? { color: ORANGE } : undefined}>{r.end ? `Bitiş ${dt(r.end)}` : 'Devam ediyor'}</td>
                        <td>{fmt(r.invoices)}</td>
                        <td>{ayStr(r.lastPeriod)}</td>
                        <td>{fmt(r.lastAdet)}</td>
                        <td>{usd(r.lastTutar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="kpe-note">* Sözleşme başlangıcı girilmemiş; ilk fatura dönemi kullanıldı.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
