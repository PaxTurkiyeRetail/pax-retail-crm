'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { buildWorkbookBlob, downloadBlob } from '@/lib/xlsx/simple-workbook';
import { SALES_TEAM, istanbulDayKey } from '@/lib/reports/live-board-shared';
import {
  KIND_LABELS,
  defaultPeriodKey,
  deviceSheets,
  exportFileName,
  ownerChoices,
  periodOptions,
  serviceSheets,
  type DeviceSaleLine,
  type ExportKind,
  type ExportPeriod,
  type ServiceInvoiceLine,
} from '@/lib/reports/sales-export-shared';

/**
 * "Rapor indir" — Satışlar ekranının iki sekmesinde de aynı bileşen (Sinan, 21.09: "cihaz satış raporu
 * ve hizmet fatura raporu; Ocak ayı gibi ya da 2026 yılı gibi seçilebilir; kişi de seçilebilir, hepsi de").
 *
 * Akış: dönem + satışçı seç → /api/reports/sales-export kalem satırlarını verir → Excel paketi burada,
 * tarayıcıda kurulur (Engel & Etki ile aynı üretici: lib/xlsx/simple-workbook.ts) → indirilir.
 * Yetkisi "kendi teklifleri" olan kullanıcıda satışçı seçici kilitlidir (sunucu da zaten kendi adına sabitler).
 */
type Props = {
  kind: ExportKind;
  /** Listede görülen satışçılar — satış ekibiyle birleştirilir. */
  owners: readonly string[];
  canSeeAll: boolean;
  /** Ana ekranın buton stili (hero içinde açık zemin). */
  buttonStyle: CSSProperties;
};

export default function SalesReportDownload({ kind, owners, canSeeAll, buttonStyle }: Props) {
  const todayKey = useMemo(() => istanbulDayKey(new Date()), []);
  const periods = useMemo(() => periodOptions(todayKey), [todayKey]);
  const ownerOptions = useMemo(() => ownerChoices(SALES_TEAM, owners), [owners]);
  const [open, setOpen] = useState(false);
  const [periodKey, setPeriodKey] = useState(() => defaultPeriodKey(todayKey));
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setNote(null);
    try {
      const params = new URLSearchParams({ kind, period: periodKey });
      if (owner) params.set('owner', owner);
      const res = await fetch(`/api/reports/sales-export?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Rapor verisi alınamadı.');
      const period = json.period as ExportPeriod;
      const meta = { period, owner: String(json.owner ?? ''), generatedAt: new Date().toLocaleString('tr-TR') };
      const sheets = kind === 'cihaz'
        ? deviceSheets(json.lines as DeviceSaleLine[], meta)
        : serviceSheets(json.lines as ServiceInvoiceLine[], meta);
      const blob = await buildWorkbookBlob(sheets, { title: `${KIND_LABELS[kind]} · ${period.label}` });
      downloadBlob(blob, exportFileName(kind, period.key, meta.owner));
      const count = Array.isArray(json.lines) ? json.lines.length : 0;
      setNote(count ? `${count} satır indirildi.` : 'Bu dönemde kayıt yok — boş rapor indirildi.');
    } catch (error: any) {
      setNote(error?.message || 'Rapor indirilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ ...buttonStyle, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
        aria-expanded={open}
      >
        ⬇ {KIND_LABELS[kind]}
      </button>
      {open ? (
        <>
          <select value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} style={selectStyle} aria-label="Dönem">
            {periods.map((period) => (
              <option key={period.key} value={period.key}>{period.kind === 'month' ? `  ${period.label}` : period.label}</option>
            ))}
          </select>
          <select value={owner} onChange={(event) => setOwner(event.target.value)} style={selectStyle} aria-label="Satışçı" disabled={!canSeeAll} title={canSeeAll ? undefined : 'Yalnız kendi kayıtlarınız'}>
            <option value="">Tüm satışçılar</option>
            {ownerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" onClick={() => void download()} disabled={busy} style={{ ...buttonStyle, border: 'none', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 14, background: 'white', color: '#312e81' }}>
            {busy ? 'Hazırlanıyor…' : 'Excel indir'}
          </button>
          {note ? <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 }}>{note}</span> : null}
        </>
      ) : null}
    </div>
  );
}

const selectStyle: CSSProperties = {
  minHeight: 40, borderRadius: 12, padding: '0 10px', border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.12)', color: 'white', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
};
