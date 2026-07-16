'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';

type Option = { label: string; value: string };
type MonthOption = { label: string; value: number };
type SimpleRow = { label: string; value: number };
type ForecastReportRow = {
  id: string;
  musteri: string;
  sektor: string | null;
  owner_name: string | null;
  product_code_snapshot: string | null;
  product_name_snapshot: string | null;
  forecast_label: string;
  forecast_year: number;
  forecast_month: number;
  sales_channel: string;
  probability: number;
  quantity: number;
  weighted_quantity: number;
  note: string | null;
};
type Payload = {
  rows: ForecastReportRow[];
  summary: {
    totalLines: number;
    uniqueCustomers: number;
    uniqueOwners: number;
    totalQuantity: number;
    weightedQuantity: number;
  };
  ownerOptions: string[];
  salesChannels: Option[];
  probabilities: Option[];
  months: MonthOption[];
  years: number[];
  ownerSummary: SimpleRow[];
  monthSummary: SimpleRow[];
  channelSummary: SimpleRow[];
  probabilitySummary: SimpleRow[];
  productSummary: SimpleRow[];
  onboardingNeeded?: boolean;
};

const EMPTY: Payload = {
  rows: [],
  summary: { totalLines: 0, uniqueCustomers: 0, uniqueOwners: 0, totalQuantity: 0, weightedQuantity: 0 },
  ownerOptions: [],
  salesChannels: [],
  probabilities: [],
  months: [],
  years: [],
  ownerSummary: [],
  monthSummary: [],
  channelSummary: [],
  probabilitySummary: [],
  productSummary: [],
};

function numberFormat(value: number) {
  return Number(value || 0).toLocaleString('tr-TR');
}

function buildForecastFileName() {
  const today = new Date().toISOString().slice(0, 10);
  return `forecast-raporu-${today}.xlsx`;
}

function exportModelName(row: ForecastReportRow) {
  return row.product_code_snapshot || row.product_name_snapshot || '-';
}

function buildMonthlyModelSummary(rows: ForecastReportRow[], weighted = false) {
  const map = new Map<string, { period: string; year: number; month: number; model: string; quantity: number }>();
  rows.forEach((row) => {
    const period = row.forecast_label || '-';
    const year = Number(row.forecast_year || 0);
    const month = Number(row.forecast_month || 0);
    const model = exportModelName(row);
    const key = `${year}||${month}||${period}||${model}`;
    const existing = map.get(key) ?? { period, year, month, model, quantity: 0 };
    const quantity = weighted ? (Number(row.quantity || 0) * Number(row.probability || 0)) / 100 : Number(row.quantity || 0);
    existing.quantity += quantity;
    map.set(key, existing);
  });
  const values = Array.from(map.values()).map((item) => ({
    ...item,
    quantity: Math.round(item.quantity),
  }));
  return values.sort((a, b) => (a.year - b.year) || (a.month - b.month) || a.model.localeCompare(b.model, 'tr'));
}

type ForecastPivotPeriod = { key: string; label: string; year: number; month: number };
type ForecastPivotRow = { model: string; quantities: Record<string, number> };
type ForecastPivot = { periods: ForecastPivotPeriod[]; rows: ForecastPivotRow[] };

function buildMonthlyModelPivot(rows: ForecastReportRow[], weighted = false): ForecastPivot {
  const periods = new Map<string, ForecastPivotPeriod>();
  const modelMap = new Map<string, { model: string; quantities: Record<string, number> }>();

  rows.forEach((row) => {
    const year = Number(row.forecast_year || 0);
    const month = Number(row.forecast_month || 0);
    const label = row.forecast_label || '-';
    const periodKey = `${year}||${month}||${label}`;
    periods.set(periodKey, { key: periodKey, label, year, month });

    const model = exportModelName(row);
    const existing = modelMap.get(model) ?? { model, quantities: {} };
    const quantity = weighted ? (Number(row.quantity || 0) * Number(row.probability || 0)) / 100 : Number(row.quantity || 0);
    existing.quantities[periodKey] = Number(existing.quantities[periodKey] || 0) + quantity;
    modelMap.set(model, existing);
  });

  const sortedPeriods = Array.from(periods.values()).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  const sortedRows = Array.from(modelMap.values())
    .map((row) => ({
      model: row.model,
      quantities: Object.fromEntries(Object.entries(row.quantities).map(([key, value]) => [key, Math.round(Number(value || 0))])),
    }))
    .sort((a, b) => a.model.localeCompare(b.model, 'tr'));

  return { periods: sortedPeriods, rows: sortedRows };
}

function yearLabel(year: number) {
  return year > 0 ? String(year) : 'Dönem';
}


type XlsxCell = { value?: string | number | null; style?: number; type?: 'text' | 'number' };

type XlsxRow = XlsxCell[];

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let dividend = index + 1;
  let name = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
}

function makeTextCell(value: unknown, style = 0): XlsxCell {
  return { value: String(value ?? ''), style, type: 'text' };
}

function makeNumberCell(value: unknown, style = 0): XlsxCell {
  return { value: Number(value || 0), style, type: 'number' };
}

function xlsxCellXml(cell: XlsxCell, rowIndex: number, colIndex: number) {
  const ref = `${columnName(colIndex)}${rowIndex}`;
  const styleAttr = cell.style ? ` s="${cell.style}"` : '';
  if (cell.type === 'number') {
    const numberValue = Number(cell.value || 0);
    return `<c r="${ref}"${styleAttr}><v>${Number.isFinite(numberValue) ? numberValue : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(cell.value ?? '')}</t></is></c>`;
}

function xlsxRowXml(row: XlsxRow, rowIndex: number) {
  const cells = row.map((cell, colIndex) => xlsxCellXml(cell, rowIndex, colIndex)).join('');
  return `<row r="${rowIndex}">${cells}</row>`;
}

function buildWorksheetXml(rows: XlsxRow[], mergeRefs: string[], detailEndRow: number) {
  const maxCol = Math.max(1, ...rows.map((row) => row.length));
  const lastCol = columnName(maxCol - 1);
  const sheetData = rows.map((row, index) => xlsxRowXml(row, index + 1)).join('');
  const widths = [18, 30, 24, 18, 36, 18, 20, 12, 32];
  const cols = Array.from({ length: maxCol }, (_, index) => {
    const width = widths[index] ?? 14;
    const col = index + 1;
    return `<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`;
  }).join('');
  const mergeCells = mergeRefs.length
    ? `<mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${xmlEscape(ref)}"/>`).join('')}</mergeCells>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastCol}${rows.length}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${sheetData}</sheetData>
  <autoFilter ref="A1:I${Math.max(1, detailEndRow)}"/>
  ${mergeCells}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF064E3B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF059669"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function pushPivotBlock(sheetRows: XlsxRow[], mergeRefs: string[], title: string, pivot: ForecastPivot, titleStyle: number, headerStyle: number, dataStyle: number) {
  if (!pivot.periods.length) return;

  const yearGroups: Array<{ year: number; periods: ForecastPivotPeriod[] }> = [];
  pivot.periods.forEach((period) => {
    const lastGroup = yearGroups[yearGroups.length - 1];
    if (lastGroup && lastGroup.year === period.year) {
      lastGroup.periods.push(period);
    } else {
      yearGroups.push({ year: period.year, periods: [period] });
    }
  });

  const displayColumns = yearGroups.flatMap((group) => [
    ...group.periods.map((period) => ({ type: 'period' as const, period, year: group.year })),
    { type: 'yearTotal' as const, year: group.year },
  ]);

  sheetRows.push([]);
  const blockWidth = Math.max(2, displayColumns.length + 1);
  const blockLastCol = columnName(blockWidth - 1);

  const titleRow = sheetRows.length + 1;
  sheetRows.push([makeTextCell(title, titleStyle), ...Array.from({ length: blockWidth - 1 }, () => makeTextCell('', titleStyle))]);
  mergeRefs.push(`A${titleRow}:${blockLastCol}${titleRow}`);

  const yearRowIndex = sheetRows.length + 1;
  const yearRow: XlsxRow = [makeTextCell('', headerStyle)];
  yearGroups.forEach((group) => {
    group.periods.forEach(() => yearRow.push(makeTextCell(yearLabel(group.year), headerStyle)));
    yearRow.push(makeTextCell(yearLabel(group.year), headerStyle));
  });
  sheetRows.push(yearRow);

  let displayColStart = 1;
  yearGroups.forEach((group) => {
    const groupWidth = group.periods.length + 1;
    const startCol = columnName(displayColStart);
    const endCol = columnName(displayColStart + groupWidth - 1);
    if (groupWidth > 1) mergeRefs.push(`${startCol}${yearRowIndex}:${endCol}${yearRowIndex}`);
    displayColStart += groupWidth;
  });

  sheetRows.push([
    makeTextCell('Model', headerStyle),
    ...displayColumns.map((column) => {
      if (column.type === 'yearTotal') return makeTextCell(`${yearLabel(column.year)} Toplam`, headerStyle);
      return makeTextCell(column.period.label.replace(/\s+\d{4}$/u, ''), headerStyle);
    }),
  ]);

  pivot.rows.forEach((row) => {
    sheetRows.push([
      makeTextCell(row.model, 7),
      ...displayColumns.map((column) => {
        const value = column.type === 'yearTotal'
          ? Math.round(yearGroups.find((group) => group.year === column.year)?.periods.reduce((sum, period) => sum + Number(row.quantities[period.key] || 0), 0) || 0)
          : Math.round(Number(row.quantities[column.period.key] || 0));
        return value > 0 ? makeNumberCell(value, dataStyle) : makeTextCell('', dataStyle);
      }),
    ]);
  });
}

async function buildForecastXlsxBlob(rows: ForecastReportRow[]) {
  const headers = ['Tarih', 'Müşteri', 'Account', 'Ürün Kodu', 'Ürün Adı', 'Satış Kanalı', 'Gerçekleşme Oranı', 'Adet', 'Not'];
  const monthlyModelPivot = buildMonthlyModelPivot(rows, false);
  const weightedMonthlyModelPivot = buildMonthlyModelPivot(rows, true);
  const mergeRefs: string[] = [];

  const sheetRows: XlsxRow[] = [
    headers.map((header) => makeTextCell(header, 1)),
    ...rows.map((row, index) => [
      makeTextCell(row.forecast_label, 2),
      makeTextCell(row.musteri, index % 2 ? 0 : 2),
      makeTextCell(row.owner_name, index % 2 ? 0 : 2),
      makeTextCell(row.product_code_snapshot, index % 2 ? 0 : 2),
      makeTextCell(row.product_name_snapshot, index % 2 ? 0 : 2),
      makeTextCell(row.sales_channel, index % 2 ? 0 : 2),
      makeTextCell(`%${row.probability}`, index % 2 ? 0 : 2),
      makeNumberCell(row.quantity, index % 2 ? 0 : 2),
      makeTextCell(row.note, index % 2 ? 0 : 2),
    ]),
  ];

  const detailEndRow = sheetRows.length;
  pushPivotBlock(sheetRows, mergeRefs, 'Ay Bazında Model ve Adet', monthlyModelPivot, 3, 4, 8);
  pushPivotBlock(sheetRows, mergeRefs, 'Gerçekleşme Oranına Göre Ay Bazında Model ve Adet', weightedMonthlyModelPivot, 5, 6, 9);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>PAX Retail CRM</dc:creator><cp:lastModifiedBy>PAX Retail CRM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PAX Retail CRM</Application></Properties>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Forecast Raporu" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', buildStylesXml());
  zip.file('xl/worksheets/sheet1.xml', buildWorksheetXml(sheetRows, mergeRefs, detailEndRow));

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export default function ForecastReportClient() {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState('');
  const [channel, setChannel] = useState('');
  const [probability, setProbability] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (owner) params.set('owner', owner);
    if (channel) params.set('channel', channel);
    if (probability) params.set('probability', probability);
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    try {
      const res = await fetch(`/api/reports/forecast?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Forecast raporu alınamadı.');
      setPayload({ ...EMPTY, ...json });
      if (json?.message && json?.message !== 'forecast_module_not_setup') setMessage(json.message);
    } catch (error: any) {
      setPayload(EMPTY);
      setMessage(error?.message || 'Forecast raporu alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [q, owner, channel, probability, year, month]);

  const cards = useMemo(() => ([
    { label: 'Forecast Satırı', value: numberFormat(payload.summary.totalLines), hint: 'Toplam ürün/dönem kaydı', tone: 'slate' },
    { label: 'Müşteri', value: numberFormat(payload.summary.uniqueCustomers), hint: 'Forecast girilen firma', tone: 'green' },
    { label: 'Account', value: numberFormat(payload.summary.uniqueOwners), hint: 'Kayıt giren hesap', tone: 'violet' },
    { label: 'Toplam Adet', value: numberFormat(payload.summary.totalQuantity), hint: 'Brüt forecast', tone: 'blue' },
  ]), [payload.summary]);

  async function downloadCsv() {
    if (!payload.rows.length) return;
    const blob = await buildForecastXlsxBlob(payload.rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildForecastFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="forecast-page premium-workspace">
      <section className="pax-hero forecast-hero">
        <span className="pax-hero-eyebrow">Rapor Merkezi · Forecast</span>
        <h1 className="pax-hero-title">Forecast Raporu</h1>
        <p className="pax-hero-description">Tüm account forecast kayıtlarını müşteri, ürün, dönem, satış kanalı ve gerçekleşme oranı kırılımında izleyin. Bu ekran genel forecast havuzunu yönetim raporu standardında gösterir.</p>
        <div className="premium-hero-actions">
          <button type="button" className="premium-btn primary" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
          <button type="button" className="premium-btn glass" onClick={downloadCsv} disabled={!payload.rows.length}>Forecast Raporunu İndir</button>
          <button type="button" className="premium-btn glass" onClick={() => window.print()} disabled={!payload.rows.length}>Yazdır / PDF</button>
        </div>
      </section>

      {message ? <section className={`premium-alert ${payload.onboardingNeeded ? 'warning' : 'danger'}`}>{message}</section> : null}

      <section className="premium-filter-card">
        <div className="premium-section-head compact">
          <div>
            <span>Rapor Filtreleri</span>
            <h2>Account, kanal ve dönem bazlı analiz</h2>
          </div>
          <button type="button" className="premium-btn secondary" onClick={() => { setQ(''); setOwner(''); setChannel(''); setProbability(''); setYear(''); setMonth(''); }}>Temizle</button>
        </div>
        <div className="premium-filter-grid forecast-report-filter-grid">
          <label className="premium-field wide"><span>Arama</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Müşteri, ürün, sektör veya account ara" /></label>
          <label className="premium-field"><span>Account</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Tüm Accountlar</option>{payload.ownerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="premium-field"><span>Kanal</span><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">Tüm Kanallar</option>{payload.salesChannels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="premium-field"><span>Oran</span><select value={probability} onChange={(event) => setProbability(event.target.value)}><option value="">Tüm Oranlar</option>{payload.probabilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="premium-field"><span>Ay</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Tüm Aylar</option>{payload.months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="premium-field"><span>Yıl</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Tüm Yıllar</option>{payload.years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
      </section>

      <section className="premium-kpi-grid forecast-report-kpi-grid">
        {cards.map((card) => (
          <article key={card.label} className={`premium-kpi-card tone-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="premium-summary-grid forecast-summary-grid">
        <MiniSummary title="Dönem Kırılımı" rows={payload.monthSummary} />
        <MiniSummary title="Account Kırılımı" rows={payload.ownerSummary} />
        <MiniSummary title="Satış Kanalı" rows={payload.channelSummary} />
        <MiniSummary title="Gerçekleşme Oranı" rows={payload.probabilitySummary} />
      </section>

      <section className="premium-table-card">
        <SectionTitle title="Ürün Kırılımı" subtitle="En yüksek adetli forecast ürünleri" />
        <div className="premium-bars">
          {payload.productSummary.map((row) => <BarRow key={row.label} label={row.label} value={row.value} max={payload.productSummary[0]?.value ?? 1} />)}
          {!payload.productSummary.length ? <div className="premium-empty-cell">Ürün kırılımı yok.</div> : null}
        </div>
      </section>

      <section className="premium-table-card">
        <SectionTitle title="Forecast Detay Listesi" subtitle="Müşteri, account, ürün, dönem, kanal ve olasılık bazlı tüm satırlar" />
        <div className="premium-table-wrap">
          <table className="premium-table forecast-report-table">
            <thead>
              <tr>{['Müşteri', 'Account', 'Ürün', 'Dönem', 'Kanal', 'Oran', 'Adet', 'Not'].map((head) => <th key={head}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {payload.rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.musteri || '-'}</strong></td>
                  <td>{row.owner_name || '-'}</td>
                  <td><strong>{row.product_code_snapshot || '-'}</strong><small>{row.product_name_snapshot || '-'}</small></td>
                  <td>{row.forecast_label}</td>
                  <td>{row.sales_channel}</td>
                  <td><span className="forecast-soft-chip">%{row.probability}</span></td>
                  <td><strong>{numberFormat(row.quantity)}</strong></td>
                  <td>{row.note || '-'}</td>
                </tr>
              ))}
              {!payload.rows.length ? <tr><td colSpan={8} className="premium-empty-cell">Forecast kaydı bulunamadı.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MiniSummary({ title, rows }: { title: string; rows: SimpleRow[] }) {
  return (
    <section className="premium-mini-card">
      <SectionTitle title={title} subtitle="Adet bazlı toplam" />
      <div className="premium-bars">
        {rows.slice(0, 8).map((row) => <BarRow key={row.label} label={row.label} value={row.value} max={rows[0]?.value ?? 1} />)}
        {!rows.length ? <div className="premium-empty-cell">Veri yok.</div> : null}
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="premium-section-title"><h2>{title}</h2><p>{subtitle}</p></div>;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="premium-bar-row">
      <div className="premium-bar-top"><strong>{label}</strong><span>{numberFormat(value)}</span></div>
      <div className="premium-bar-track"><div style={{ width: `${width}%` }} /></div>
    </div>
  );
}
