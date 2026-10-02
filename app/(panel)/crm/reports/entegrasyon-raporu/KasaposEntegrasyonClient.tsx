'use client';

import '@/styles/reports-kasapos-entegrasyon.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KasaposEntegrasyonPayload, KasaposFirmRow, KasaposMonthCell } from '@/lib/reports/kasapos-entegrasyon-shared';

// KasaPOS Entegrasyon Raporu — müdür raporunun (PDF 28.09.2026) canlı hâli, birebir görünüm.
// Veri: Satışlar › Hizmet Faturaları — KasaPOS kalemleri + fatura formundaki aktif satış kasası.

type Cell = KasaposMonthCell;
type Firm = KasaposFirmRow;
type Payload = KasaposEntegrasyonPayload;

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
const pct = (n: number | null) => (n == null ? '—' : `%${n}`);
const barW = (v: number, max: number) => (max > 0 ? Math.max((v / max) * 100, v > 0 ? 2 : 0) : 0);

// Aktif satış kasası Satışlar › Hizmet Faturaları formundan girilir; rapor yalnız gösterir.
function KasaCell({ firm }: { firm: Firm }) {
  const title = firm.aktifKasaUpdatedAt
    ? `Son güncelleme: ${new Date(firm.aktifKasaUpdatedAt).toLocaleDateString('tr-TR')}${firm.aktifKasaUpdatedBy ? ` · ${firm.aktifKasaUpdatedBy}` : ''}`
    : 'Aktif satış kasası girilmemiş — Satışlar › Hizmet Faturaları formundan girin';
  return (
    <span title={title} style={{ color: firm.aktifKasa == null ? ORANGE : undefined }}>
      {firm.aktifKasa != null ? fmt(firm.aktifKasa) : 'Girilmedi'}
    </span>
  );
}

function VChart({
  values, labels, refIdx, color, colorL, money,
}: { values: number[]; labels: string[]; refIdx: number; color: string; colorL: string; money?: boolean }) {
  const max = Math.max(0, ...values);
  const f = money ? usd : fmt;
  return (
    <div className="kpe-scroll">
      <div className="kpe-vgrid">
        <div />
        <div className="kpe-vchart kpe-vchart-plot">
          {values.map((v, i) => (
            <div key={i} className="kpe-vcol">
              <div className="kpe-vplot">
                <div className="kpe-vval">{f(v)}</div>
                <div className="kpe-vbar" style={{ height: `${barW(v, max) * 0.82}%`, background: i === refIdx ? color : colorL }} />
              </div>
            </div>
          ))}
        </div>
        <div />
        <div className="kpe-vchart">
          {values.map((_, i) => (
            <div key={i} className={`kpe-vmonth${i === refIdx || i === 0 ? ' ref' : ''}`}>{labels[i]}</div>
          ))}
        </div>
        <div className="kpe-delta-label">Önceki aya göre</div>
        <div className="kpe-vchart">
          {values.map((v, i) => {
            if (i === 0) return <div key={i} className="kpe-vdelta c-muted">Başlangıç</div>;
            const d = Math.round(v - values[i - 1]);
            if (d === 0) return <div key={i} className="kpe-vdelta c-muted" style={{ fontWeight: 500 }}>0</div>;
            const txt = `${d > 0 ? '+' : '-'}${money ? usd(Math.abs(d)) : fmt(Math.abs(d))}`;
            return <div key={i} className="kpe-vdelta" style={{ color: d < 0 ? ORANGE : color }}>{txt}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function KasaposEntegrasyonClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (y: number, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/kasapos-entegrasyon?year=${y}`, { cache: 'no-store' });
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
    const mIdx = (i: number) => {
      const m = Number(data.months[i]?.slice(5, 7)) - 1;
      return Number.isFinite(m) && m >= 0 ? m : i;
    };
    const refAy = AY[mIdx(ref)] ?? '';
    const prevAy = ref > 0 ? AY[mIdx(ref - 1)] : '';
    const count = ref + 1;
    const idxs = Array.from({ length: count }, (_, i) => i);
    const ayAdi = idxs.map((i) => AY[mIdx(i)]);
    const ayKisa = idxs.map((i) => AY_KISA[mIdx(i)]);
    const totals = data.monthlyTotals.slice(0, count);
    const firstIdx = totals.findIndex((m) => m.adet > 0);
    const first = firstIdx >= 0 ? totals[firstIdx] : null;
    const last = totals[ref];
    const billed = data.firms.filter((f) => f.toplamAdet > 0);
    const byAdet = [...billed].sort((a, b) => b.refAdet - a.refAdet || b.toplamAdet - a.toplamAdet);
    const byTutar = [...billed].sort((a, b) => b.refTutar - a.refTutar || b.toplamTutar - a.toplamTutar);
    const kullanim = [...data.firms].sort((a, b) => {
      const pa = a.kullanimPct ?? -1;
      const pb = b.kullanimPct ?? -1;
      return pb - pa || (b.aktifKasa ?? 0) - (a.aktifKasa ?? 0);
    });
    const firsatlar = data.firms
      .filter((f) => (f.firsatAdet ?? 0) > 0)
      .sort((a, b) => (b.firsatAdet ?? 0) - (a.firsatAdet ?? 0) || (b.potansiyel ?? 0) - (a.potansiyel ?? 0));
    const maxFirsat = Math.max(0, ...firsatlar.map((f) => f.firsatAdet ?? 0));
    const maxAdet = Math.max(0, ...totals.map((m) => m.adet));
    const ayFark = firstIdx >= 0 ? ref - firstIdx + 1 : 0;
    return { ref, refAy, prevAy, idxs, ayAdi, ayKisa, totals, firstIdx, first, last, byAdet, byTutar, kullanim, firsatlar, maxFirsat, maxAdet, ayFark };
  }, [data]);

  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const period = view?.refAy && data ? `Ocak–${view.refAy} ${data.year}` : '';

  const firmTable = (mode: 'adet' | 'tutar') => {
    if (!data || !view) return null;
    const rows = mode === 'adet' ? view.byAdet : view.byTutar;
    const f = mode === 'adet' ? fmt : usd;
    const refCls = mode === 'adet' ? 'ref-blue' : 'ref-teal';
    const pick = (c: Cell) => (c ? (mode === 'adet' ? c.adet : c.tutar) : 0);
    return (
      <div className="kpe-card kpe-scroll">
        <table className="kpe-gtable">
          <thead>
            <tr>
              <th className="idx">#</th>
              <th className="l">Firma</th>
              {view.ayKisa.map((a, i) => <th key={i}>{a}</th>)}
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.customerId}>
                <td className="idx">{idx + 1}</td>
                <td className="l firm">{r.musteri}</td>
                {view.idxs.map((i) => {
                  const c = r.monthly[i] ?? null;
                  if (c) return <td key={i} className={i === view.ref ? refCls : undefined}>{f(pick(c))}</td>;
                  if (i === view.ref && r.eksikAy) return <td key={i} className="yok">Yok</td>;
                  return <td key={i} className="empty">–</td>;
                })}
                <td className="tot">{f(mode === 'adet' ? r.toplamAdet : r.toplamTutar)}</td>
              </tr>
            ))}
            <tr className="total">
              <td />
              <td className="l">Toplam, {rows.length} firma</td>
              {view.totals.map((m, i) => <td key={i}>{f(mode === 'adet' ? m.adet : m.tutar)}</td>)}
              <td>{f(view.totals.reduce((s, m) => s + (mode === 'adet' ? m.adet : m.tutar), 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main className="pax-page-container">
      <div className="kpe">
        {/* SAYFA 1 — Dashboard */}
        <section className="kpe-section">
          <div className="kpe-head">
            <div>
              <div className="kpe-brand">PAX Türkiye Retail Solutions</div>
              <h1 className="kpe-title">KasaPOS entegrasyon adet ve tutarları{period ? `, ${period}` : ''}</h1>
            </div>
            <div>
              <div className="kpe-source">Kaynak: Hizmet Fatura Raporu<br />{today}</div>
              <div className="kpe-tools no-print">
                <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {[currentYear, currentYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button type="button" onClick={() => window.print()} disabled={!data}>PDF / Yazdır</button>
              </div>
            </div>
          </div>

          {data && data.kpi.kasaGirilmemisFirma > 0 && (
            <div className="kpe-warn no-print">
              ⚠ {data.kpi.kasaGirilmemisFirma} firmada aktif satış kasası girilmemiş — kullanım % ve fırsat hesabına dahil değil.
              Satışlar › Hizmet Faturaları&apos;nda firmanın KasaPOS faturasını açıp &quot;Aktif satış kasası&quot; alanından girin.
            </div>
          )}
          {error && <div className="kpe-error">{error}</div>}
          {loading && <div className="kpe-card muted">Yükleniyor…</div>}

          {!loading && data && view && (
            <>
              <div className="kpe-kpis">
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} adet</div>
                  <div className="kpe-kpi-val">{fmt(data.kpi.refAdet)}</div>
                  <div className="kpe-kpi-sub c-blue">{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refAdet, data.kpi.prevAdet))}</b></div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">{view.refAy} tutar</div>
                  <div className="kpe-kpi-val">{usd(data.kpi.refTutar)}</div>
                  <div className="kpe-kpi-sub c-teal">{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refTutar, data.kpi.prevTutar))}</b></div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">Kasa entegrasyon oranı</div>
                  <div className="kpe-kpi-val">{pct(data.kpi.kullanimPct)}</div>
                  <div className="kpe-kpi-sub muted"><b style={{ color: NAVY }}>{fmt(data.kpi.faturalananAktif)} / {fmt(data.kpi.aktifKasaToplam)}</b> kasa entegre</div>
                </div>
                <div className="kpe-card">
                  <div className="kpe-kpi-label">Aylık satış fırsatı</div>
                  <div className="kpe-kpi-val">+{usd(data.kpi.potansiyel)}</div>
                  <div className="kpe-kpi-sub c-teal">Tam kullanımda aylık <b>{usd(data.kpi.tamKullanimTutar)}</b></div>
                </div>
              </div>

              <div className="kpe-row3">
                <div className="kpe-card">
                  <h3>Aylık adet ve tutar trendi</h3>
                  <div className="kpe-trend-head"><i /><i /><span>Adet</span><span>Tutar</span></div>
                  {view.idxs.slice().reverse().map((i) => {
                    const m = view.totals[i];
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
                  <h3>Yılbaşından bu yana büyüme</h3>
                  {view.first && view.last ? (
                    <>
                      <table className="kpe-ytd">
                        <thead><tr><th /><th>{view.ayAdi[view.firstIdx]}</th><th>{view.refAy}</th><th>Büyüme</th></tr></thead>
                        <tbody>
                          <tr><td>Adet</td><td>{fmt(view.first.adet)}</td><td>{fmt(view.last.adet)}</td><td className="g c-blue">{signed(pctChange(view.last.adet, view.first.adet))}</td></tr>
                          <tr><td>Tutar</td><td>{usd(view.first.tutar)}</td><td>{usd(view.last.tutar)}</td><td className="g c-teal">{signed(pctChange(view.last.tutar, view.first.tutar))}</td></tr>
                          <tr><td>Firma</td><td>{view.first.firma}</td><td>{view.last.firma}</td><td className="g">{view.last.firma - view.first.firma >= 0 ? '+' : ''}{view.last.firma - view.first.firma}</td></tr>
                        </tbody>
                      </table>
                      <p className="kpe-note">
                        Adet ve tutar {view.ayFark} ayda {view.first.adet > 0 ? (view.last.adet / view.first.adet).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '—'} katına çıktı;
                        faturalanan firma sayısı {view.first.firma}&apos;dan {view.last.firma}&apos;e yükseldi.
                      </p>
                    </>
                  ) : <p className="kpe-note">Veri yok.</p>}
                </div>

                <div className="kpe-card">
                  <h3>Büyüme fırsatları (adet)</h3>
                  {view.firsatlar.length === 0 ? <p className="kpe-note">Aktif satış kasası girilen firmalarda fırsat yok.</p> : (
                    <>
                      {view.firsatlar.map((f) => (
                        <div key={f.customerId} className="kpe-opp-row">
                          <span className="name" title={f.musteri}>{f.musteri}</span>
                          <div><div className="kpe-hbar" style={{ width: `${barW(f.firsatAdet ?? 0, view.maxFirsat)}%`, background: BLUE }} /></div>
                          <b className="num">{fmt(f.firsatAdet ?? 0)} kasa</b>
                        </div>
                      ))}
                      <p className="kpe-note kpe-note-top">{view.firsatlar.length} firmada toplam {fmt(data.kpi.firsatAdet)} kasa.</p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {!loading && data && view && (
          <>
            {/* SAYFA 2 — Aylık grafikler */}
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Aylık adet ve tutar, {period}</h2>
              <div className="kpe-card">
                <div className="kpe-chart-title c-blue">Adet</div>
                <VChart values={view.totals.map((m) => m.adet)} labels={view.ayKisa} refIdx={view.ref} color={BLUE} colorL={BLUE_L} />
                <hr className="kpe-divider" />
                <div className="kpe-chart-title c-teal">Tutar</div>
                <VChart values={view.totals.map((m) => m.tutar)} labels={view.ayKisa} refIdx={view.ref} color={TEAL} colorL={TEAL_L} money />
              </div>
            </section>

            {/* SAYFA 3 — Firma × ay adet */}
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Firmalar, aylık adet büyüklüğüne göre</h2>
              {firmTable('adet')}
            </section>

            {/* SAYFA 4 — Firma × ay tutar */}
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>Firmalar, aylık tutar büyüklüğüne göre</h2>
              {firmTable('tutar')}
            </section>

            {/* SAYFA 5 — Kullanım ve satış fırsatı (aktif satış kasası burada girilir) */}
            <section className="kpe-section">
              <h2 className="kpe-title" style={{ marginBottom: 18 }}>
                Aktif satış kasalarının {data.kpi.kullanimPct != null ? `%${data.kpi.kullanimPct}'ı` : '—'} faturalanıyor; {fmt(data.kpi.firsatAdet)} kasa satış fırsatı
              </h2>
              <p className="kpe-help no-print">
                Aktif satış kasası sütununa sayıyı yazıp Enter&apos;a basın — anında kaydedilir. Fiyat, firmanın son faturalı ayındaki birim fiyattır.
              </p>
              <div className="kpe-card kpe-scroll">
                <table className="kpe-htable">
                  <thead>
                    <tr>
                      <th className="l">#</th>
                      <th className="l">Firma</th>
                      <th>Aktif satış kasası</th>
                      <th>Faturalanan</th>
                      <th className="l">Kullanım ({view.refAy})</th>
                      <th>Satış fırsat adeti</th>
                      <th>Potansiyel / ay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.kullanim.map((f, idx) => {
                      const low = f.kullanimPct != null && f.kullanimPct < 50;
                      const c = low ? ORANGE : BLUE;
                      return (
                        <tr key={f.customerId}>
                          <td className="l idx">{idx + 1}</td>
                          <td className="l firm">{f.musteri}</td>
                          <td><KasaCell firm={f} /></td>
                          <td>{fmt(f.refAdet)}</td>
                          <td className="l">
                            <div className="kpe-use">
                              <div className="kpe-track"><div className="kpe-fill" style={{ width: `${Math.min(f.kullanimPct ?? 0, 100)}%`, background: c }} /></div>
                              <b style={{ color: f.kullanimPct != null ? c : '#5B6475' }}>{pct(f.kullanimPct)}</b>
                            </div>
                          </td>
                          <td className={f.firsatAdet ? 'b' : 'c-muted'}>{f.firsatAdet ? fmt(f.firsatAdet) : '–'}</td>
                          <td className={f.potansiyel ? undefined : 'c-muted'}>{f.potansiyel ? usd(f.potansiyel) : '–'}</td>
                        </tr>
                      );
                    })}
                    <tr className="total">
                      <td />
                      <td className="l">Toplam, {view.kullanim.length} firma</td>
                      <td>{fmt(data.kpi.aktifKasaToplam)}</td>
                      <td>{fmt(data.kpi.faturalananAktif)}</td>
                      <td className="l">
                        <div className="kpe-use">
                          <div className="kpe-track"><div className="kpe-fill" style={{ width: `${Math.min(data.kpi.kullanimPct ?? 0, 100)}%`, background: NAVY }} /></div>
                          <b style={{ color: NAVY }}>{pct(data.kpi.kullanimPct)}</b>
                        </div>
                      </td>
                      <td>{fmt(data.kpi.firsatAdet)}</td>
                      <td>{usd(data.kpi.potansiyel)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
