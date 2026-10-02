'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// KasaPOS Entegrasyon Raporu — müdür raporunun (PDF 28.09.2026) canlı hâli.
// Veri: hizmet faturaları (Furkan girer) + aktif satış kasası (bu ekrandan satır içi girilir).

type Cell = { adet: number; tutar: number } | null;

type Firm = {
  customerId: string;
  musteri: string;
  sorumlu: string | null;
  aktifKasa: number | null;
  aktifKasaUpdatedAt: string | null;
  aktifKasaUpdatedBy: string | null;
  monthly: Cell[];
  toplamAdet: number;
  toplamTutar: number;
  refAdet: number;
  refTutar: number;
  birimFiyat: number | null;
  kullanimPct: number | null;
  firsatAdet: number | null;
  potansiyel: number | null;
  eksikAy: boolean;
};

type Payload = {
  year: number;
  months: string[];
  refMonthIndex: number;
  monthlyTotals: Array<{ adet: number; tutar: number; firma: number }>;
  kpi: {
    refAdet: number;
    refTutar: number;
    prevAdet: number;
    prevTutar: number;
    aktifKasaToplam: number;
    faturalananAktif: number;
    kullanimPct: number | null;
    firsatAdet: number;
    potansiyel: number;
    tamKullanimTutar: number;
    kasaGirilmemisFirma: number;
  };
  firms: Firm[];
};

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const BLUE = '#1F5FAF';
const TEAL = '#0F7B73';
const ORANGE = '#B85C14';

const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const fmt = (n: number) => nf.format(n);
const usd = (n: number) => `${nf.format(Math.round(n))} $`;
const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const signed = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : '-'}%${Math.abs(n)}`);

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 };
const td: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' };
const tdL: React.CSSProperties = { ...td, textAlign: 'left', fontWeight: 600 };
const card: React.CSSProperties = { padding: 18 };
const muted: React.CSSProperties = { color: 'var(--text-3)', fontSize: 13 };

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div style={{ background: 'rgba(148,163,184,0.18)', borderRadius: 4, height: 12, width: '100%', minWidth: 80 }}>
      <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  );
}

function KasaInput({ firm, onSaved }: { firm: Firm; onSaved: () => void }) {
  const [value, setValue] = useState(firm.aktifKasa == null ? '' : String(firm.aktifKasa));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setValue(firm.aktifKasa == null ? '' : String(firm.aktifKasa)), [firm.aktifKasa]);

  const save = async () => {
    const next = value.trim();
    if (next === (firm.aktifKasa == null ? '' : String(firm.aktifKasa))) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/reports/kasapos-entegrasyon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: firm.customerId, aktifKasa: next === '' ? null : Number(next) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Kaydedilemedi.');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const title = firm.aktifKasaUpdatedAt
    ? `Son güncelleme: ${new Date(firm.aktifKasaUpdatedAt).toLocaleDateString('tr-TR')}${firm.aktifKasaUpdatedBy ? ` · ${firm.aktifKasaUpdatedBy}` : ''}`
    : 'Aktif satış kasası girilmemiş';

  return (
    <span title={err || title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        className="no-print"
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={saving}
        placeholder="gir"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{
          width: 72,
          textAlign: 'right',
          padding: '3px 6px',
          borderRadius: 6,
          border: `1px solid ${err ? '#dc2626' : firm.aktifKasa == null ? ORANGE : 'var(--border-1, #cbd5e1)'}`,
          background: 'transparent',
          color: 'inherit',
        }}
      />
      <span className="print-only">{firm.aktifKasa ?? '—'}</span>
    </span>
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
    const refAy = AY[Number(data.months[ref]?.slice(5, 7)) - 1] ?? '';
    const prevAy = ref > 0 ? AY[ref - 1] : '';
    const firstIdx = data.monthlyTotals.findIndex((m) => m.adet > 0);
    const first = firstIdx >= 0 ? data.monthlyTotals[firstIdx] : null;
    const last = data.monthlyTotals[ref];
    const byTutar = [...data.firms].sort((a, b) => b.refTutar - a.refTutar || b.toplamTutar - a.toplamTutar);
    const kullanim = [...data.firms].sort((a, b) => {
      const pa = a.kullanimPct ?? -1;
      const pb = b.kullanimPct ?? -1;
      return pb - pa || (b.aktifKasa ?? 0) - (a.aktifKasa ?? 0);
    });
    const firsatlar = data.firms
      .filter((f) => (f.firsatAdet ?? 0) > 0)
      .sort((a, b) => (b.potansiyel ?? 0) - (a.potansiyel ?? 0) || (b.firsatAdet ?? 0) - (a.firsatAdet ?? 0));
    const maxFirsat = Math.max(0, ...firsatlar.map((f) => f.firsatAdet ?? 0));
    const maxAdet = Math.max(0, ...data.monthlyTotals.map((m) => m.adet));
    const maxTutar = Math.max(0, ...data.monthlyTotals.map((m) => m.tutar));
    return { ref, refAy, prevAy, firstIdx, first, last, byTutar, kullanim, firsatlar, maxFirsat, maxAdet, maxTutar };
  }, [data]);

  const reload = useCallback(() => void load(year, true), [load, year]);

  return (
    <main className="pax-page-container kasapos-ent">
      <style>{`
        .kasapos-ent .print-only { display: none; }
        .kasapos-ent table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .kasapos-ent tbody tr { border-bottom: 1px solid var(--border-1, #e5e7eb); }
        .kasapos-ent thead tr { border-bottom: 1px solid var(--border-1, #cbd5e1); }
        .kasapos-ent .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px; }
        .kasapos-ent .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
        .kasapos-ent .kpi { font-size: 34px; font-weight: 800; line-height: 1.15; margin: 6px 0; }
        .kasapos-ent h2 { font-size: 16px; margin: 0 0 12px; }
        @media print {
          .kasapos-ent .no-print { display: none !important; }
          .kasapos-ent .print-only { display: inline; }
          .kasapos-ent .pax-card { break-inside: avoid; }
        }
      `}</style>

      <div className="pax-card" style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: TEAL, fontSize: 13, fontWeight: 600 }}>PAX Türkiye Retail Solutions</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 22 }}>
              KasaPOS entegrasyon adet ve tutarları{view?.refAy ? `, Ocak–${view.refAy} ${data?.year}` : ''}
            </h1>
            <p style={{ ...muted, margin: '6px 0 0' }}>
              Kaynak: Hizmet faturaları (KasaPOS Entegrasyonu ve KasaPOS + TMS kalemleri, USD) · {new Date().toLocaleDateString('tr-TR')}
            </p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 8 }}>
              {[currentYear, currentYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" className="secondary" onClick={() => window.print()} disabled={!data}>PDF / Yazdır</button>
          </div>
        </div>
        {data && data.kpi.kasaGirilmemisFirma > 0 && (
          <div className="no-print" style={{ marginTop: 12, fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            ⚠ {data.kpi.kasaGirilmemisFirma} firmada aktif satış kasası girilmemiş — kullanım % ve fırsat hesabına dahil değil. Aşağıdaki
            &quot;Kullanım ve satış fırsatı&quot; tablosundan girebilirsiniz.
          </div>
        )}
      </div>

      {error && <div className="pax-card" style={{ padding: 16, marginBottom: 16, color: '#dc2626' }}>{error}</div>}
      {loading && <div className="pax-card" style={{ padding: 20, ...muted }}>Yükleniyor…</div>}

      {!loading && data && view && (
        <>
          {/* 1) KPI kartları */}
          <div className="grid4">
            <div className="pax-card" style={card}>
              <div style={muted}>{view.refAy} adet</div>
              <div className="kpi">{fmt(data.kpi.refAdet)}</div>
              <div style={{ color: BLUE, fontSize: 13 }}>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refAdet, data.kpi.prevAdet))}</b></div>
            </div>
            <div className="pax-card" style={card}>
              <div style={muted}>{view.refAy} tutar</div>
              <div className="kpi">{usd(data.kpi.refTutar)}</div>
              <div style={{ color: TEAL, fontSize: 13 }}>{view.prevAy}&apos;a göre <b>{signed(pctChange(data.kpi.refTutar, data.kpi.prevTutar))}</b></div>
            </div>
            <div className="pax-card" style={card}>
              <div style={muted}>Kasa entegrasyon oranı</div>
              <div className="kpi">{data.kpi.kullanimPct != null ? `%${data.kpi.kullanimPct}` : '—'}</div>
              <div style={{ fontSize: 13 }}><b>{fmt(data.kpi.faturalananAktif)} / {fmt(data.kpi.aktifKasaToplam)}</b> kasa entegre</div>
            </div>
            <div className="pax-card" style={card}>
              <div style={muted}>Aylık satış fırsatı</div>
              <div className="kpi">+{usd(data.kpi.potansiyel)}</div>
              <div style={{ color: TEAL, fontSize: 13 }}>Tam kullanımda aylık <b>{usd(data.kpi.tamKullanimTutar)}</b></div>
            </div>
          </div>

          {/* 2) Trend · YTD büyüme · Büyüme fırsatları */}
          <div className="grid3">
            <div className="pax-card" style={card}>
              <h2>Aylık adet ve tutar trendi</h2>
              <table>
                <thead><tr><th style={{ ...th, textAlign: 'left' }} /><th style={th} /><th style={{ ...th, color: BLUE }}>Adet</th><th style={{ ...th, color: TEAL }}>Tutar</th></tr></thead>
                <tbody>
                  {data.monthlyTotals.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: 'left' }}>{AY[i]}</td>
                      <td style={{ ...td, width: '40%' }}><Bar value={m.adet} max={view.maxAdet} color={i === view.ref ? BLUE : '#BCD3EE'} /></td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmt(m.adet)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{usd(m.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pax-card" style={card}>
              <h2>Yılbaşından bu yana büyüme</h2>
              {view.first && view.last ? (
                <>
                  <table>
                    <thead><tr><th style={{ ...th, textAlign: 'left' }} /><th style={th}>{AY[view.firstIdx]}</th><th style={th}>{view.refAy}</th><th style={th}>Büyüme</th></tr></thead>
                    <tbody>
                      <tr><td style={{ ...td, textAlign: 'left' }}>Adet</td><td style={td}>{fmt(view.first.adet)}</td><td style={td}>{fmt(view.last.adet)}</td><td style={{ ...td, color: BLUE, fontWeight: 700 }}>{signed(pctChange(view.last.adet, view.first.adet))}</td></tr>
                      <tr><td style={{ ...td, textAlign: 'left' }}>Tutar</td><td style={td}>{usd(view.first.tutar)}</td><td style={td}>{usd(view.last.tutar)}</td><td style={{ ...td, color: TEAL, fontWeight: 700 }}>{signed(pctChange(view.last.tutar, view.first.tutar))}</td></tr>
                      <tr><td style={{ ...td, textAlign: 'left' }}>Firma</td><td style={td}>{view.first.firma}</td><td style={td}>{view.last.firma}</td><td style={{ ...td, fontWeight: 700 }}>{view.last.firma - view.first.firma >= 0 ? '+' : ''}{view.last.firma - view.first.firma}</td></tr>
                    </tbody>
                  </table>
                  <p style={{ ...muted, marginTop: 12 }}>
                    Adet {view.first.adet > 0 ? (view.last.adet / view.first.adet).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '—'} katına çıktı;
                    faturalanan firma sayısı {view.first.firma}&apos;dan {view.last.firma}&apos;e geldi.
                  </p>
                </>
              ) : <p style={muted}>Veri yok.</p>}
            </div>

            <div className="pax-card" style={card}>
              <h2>Büyüme fırsatları (adet)</h2>
              {view.firsatlar.length === 0 ? <p style={muted}>Aktif satış kasası girilen firmalarda fırsat yok.</p> : (
                <>
                  <table>
                    <tbody>
                      {view.firsatlar.map((f) => (
                        <tr key={f.customerId} style={{ borderBottom: 0 }}>
                          <td style={{ ...tdL, fontWeight: 500 }}>{f.musteri}</td>
                          <td style={{ ...td, width: '35%' }}><Bar value={f.firsatAdet ?? 0} max={view.maxFirsat} color={BLUE} /></td>
                          <td style={{ ...td, fontWeight: 700 }}>{fmt(f.firsatAdet ?? 0)} kasa</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ ...muted, marginTop: 12 }}>
                    {view.firsatlar.length} firmada toplam {fmt(data.kpi.firsatAdet)} kasa · potansiyele göre sıralı.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 3) Firma × ay adet */}
          <div className="pax-card" style={{ ...card, marginBottom: 16, overflow: 'auto' }}>
            <h2>Firmalar, aylık adet büyüklüğüne göre</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>Firma</th>
                  {data.months.map((_, i) => <th key={i} style={{ ...th, color: i === view.ref ? BLUE : undefined }}>{AY_KISA[i]}</th>)}
                  <th style={th}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {data.firms.filter((f) => f.toplamAdet > 0).map((f, idx) => (
                  <tr key={f.customerId}>
                    <td style={{ ...td, textAlign: 'left', color: 'var(--text-3)' }}>{idx + 1}</td>
                    <td style={tdL}>{f.musteri}</td>
                    {f.monthly.map((c, i) => (
                      <td key={i} style={{ ...td, color: i === view.ref ? (c ? BLUE : ORANGE) : c ? undefined : 'var(--text-3)' }}>
                        {c ? fmt(c.adet) : i === view.ref && f.eksikAy ? 'Yok' : '–'}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700 }}>{fmt(f.toplamAdet)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(15,123,115,0.08)', fontWeight: 700 }}>
                  <td />
                  <td style={tdL}>Toplam, {data.firms.filter((f) => f.toplamAdet > 0).length} firma</td>
                  {data.monthlyTotals.map((m, i) => <td key={i} style={td}>{fmt(m.adet)}</td>)}
                  <td style={td}>{fmt(data.monthlyTotals.reduce((s, m) => s + m.adet, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4) Firma × ay tutar */}
          <div className="pax-card" style={{ ...card, marginBottom: 16, overflow: 'auto' }}>
            <h2>Firmalar, aylık tutar büyüklüğüne göre</h2>
            <table>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>Firma</th>
                  {data.months.map((_, i) => <th key={i} style={{ ...th, color: i === view.ref ? TEAL : undefined }}>{AY_KISA[i]}</th>)}
                  <th style={th}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {view.byTutar.filter((f) => f.toplamAdet > 0).map((f, idx) => (
                  <tr key={f.customerId}>
                    <td style={{ ...td, textAlign: 'left', color: 'var(--text-3)' }}>{idx + 1}</td>
                    <td style={tdL}>{f.musteri}</td>
                    {f.monthly.map((c, i) => (
                      <td key={i} style={{ ...td, color: i === view.ref ? (c ? TEAL : ORANGE) : c ? undefined : 'var(--text-3)' }}>
                        {c ? usd(c.tutar) : i === view.ref && f.eksikAy ? 'Yok' : '–'}
                      </td>
                    ))}
                    <td style={{ ...td, fontWeight: 700 }}>{usd(f.toplamTutar)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(15,123,115,0.08)', fontWeight: 700 }}>
                  <td />
                  <td style={tdL}>Toplam</td>
                  {data.monthlyTotals.map((m, i) => <td key={i} style={td}>{usd(m.tutar)}</td>)}
                  <td style={td}>{usd(data.monthlyTotals.reduce((s, m) => s + m.tutar, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5) Kullanım ve satış fırsatı — aktif satış kasası burada girilir */}
          <div className="pax-card" style={{ ...card, overflow: 'auto' }}>
            <h2>
              Aktif satış kasalarının {data.kpi.kullanimPct != null ? `%${data.kpi.kullanimPct}'i` : '—'} faturalanıyor; {fmt(data.kpi.firsatAdet)} kasa satış fırsatı
            </h2>
            <p className="no-print" style={{ ...muted, margin: '-6px 0 12px' }}>
              Aktif satış kasası sütununa sayıyı yazıp Enter&apos;a basın — anında kaydedilir. Fiyat, firmanın son faturalı ayındaki birim fiyattır.
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>Firma</th>
                  <th style={th}>Aktif satış kasası</th>
                  <th style={th}>Faturalanan</th>
                  <th style={{ ...th, textAlign: 'left' }}>Kullanım ({view.refAy})</th>
                  <th style={th}>Birim $</th>
                  <th style={th}>Satış fırsat adeti</th>
                  <th style={th}>Potansiyel / ay</th>
                </tr>
              </thead>
              <tbody>
                {view.kullanim.map((f, idx) => {
                  const low = f.kullanimPct != null && f.kullanimPct < 50;
                  return (
                    <tr key={f.customerId}>
                      <td style={{ ...td, textAlign: 'left', color: 'var(--text-3)' }}>{idx + 1}</td>
                      <td style={tdL}>{f.musteri}</td>
                      <td style={td}><KasaInput firm={f} onSaved={reload} /></td>
                      <td style={td}>{fmt(f.refAdet)}</td>
                      <td style={{ ...td, textAlign: 'left', minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Bar value={Math.min(f.kullanimPct ?? 0, 100)} max={100} color={low ? ORANGE : BLUE} />
                          <b style={{ color: low ? ORANGE : BLUE, minWidth: 42 }}>{f.kullanimPct != null ? `%${f.kullanimPct}` : '—'}</b>
                        </div>
                      </td>
                      <td style={td}>{f.birimFiyat != null ? f.birimFiyat.toLocaleString('tr-TR') : '—'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{f.firsatAdet ? fmt(f.firsatAdet) : '–'}</td>
                      <td style={td}>{f.potansiyel ? usd(f.potansiyel) : '–'}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'rgba(15,123,115,0.08)', fontWeight: 700 }}>
                  <td />
                  <td style={tdL}>Toplam, {view.kullanim.length} firma</td>
                  <td style={td}>{fmt(data.kpi.aktifKasaToplam)}</td>
                  <td style={td}>{fmt(data.kpi.faturalananAktif)}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{data.kpi.kullanimPct != null ? `%${data.kpi.kullanimPct}` : '—'}</td>
                  <td />
                  <td style={td}>{fmt(data.kpi.firsatAdet)}</td>
                  <td style={td}>{usd(data.kpi.potansiyel)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
