import JSZip from 'jszip';

/**
 * Basit XLSX üretici — dış kütüphane yok, JSZip + el yazımı SpreadsheetML (PPTX tarafındaki
 * `lib/pptx/ooxml.ts` ile aynı yaklaşım). 21.09'a kadar `components/blocker-impact/BlockerImpactExport.ts`
 * içinde Engel & Etki'ye özeldi; Satış / Hizmet Fatura raporları da Excel istediği için (Sinan, 21.09)
 * buraya taşındı — tek üretici, iki okuyucu (altın kural 17). Engel & Etki eski adıyla buradan okur.
 *
 * Kurallar:
 *   * İlk satır başlıktır (koyu zemin, dondurulmuş, otomatik filtre). Sayı hücreleri sayı olarak yazılır
 *     (Excel'de toplanabilir), geri kalan her şey metin.
 *   * Sayfa adı Excel sınırı gereği 31 karaktere kesilir.
 *   * Tarayıcıda (Blob) ve Node'da (Buffer/Uint8Array) çalışır; `output` ile seçilir.
 */
/**
 * Biçimli hücre (22.09, Sinan: "tutarlara $ ekleyelim", "tarih 14.09.2026 şeklinde gözüksün").
 * Değer SAYI olarak yazılır, görünümü Excel'in kendi biçimi verir — böylece hücre toplanabilir
 * kalır (metne "$" yapıştırmak sütunu toplanamaz yapardı).
 *   usd  → $#,##0.00 · try → ₺#,##0.00 · date → GG.AA.YYYY (değer Excel gün seri numarası)
 */
export type CellFormat = 'usd' | 'try' | 'date';
export type FormattedCell = { value: number; format: CellFormat };
export type Cell = string | number | null | undefined | FormattedCell;
export type Sheet = { name: string; rows: Cell[][]; widths?: number[] };

/** Excel gün seri numarası (1900 tabanı; 1899-12-30 = 0). 'YYYY-MM-DD' bekler, geçersizde null. */
export function excelDateSerial(isoDate: unknown): number | null {
  const text = String(isoDate ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const serial = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000);
  return serial > 0 ? serial : null;
}

/** Tarih hücresi; tarih yoksa BOŞ hücre (uydurma tarih üretilmez). */
export function dateCell(isoDate: unknown): Cell {
  const serial = excelDateSerial(isoDate);
  return serial == null ? '' : { value: serial, format: 'date' };
}

/** Para hücresi; değer yoksa BOŞ (0 yazmak "sıfıra satıldı" demek olurdu). */
export function moneyCell(value: number | null | undefined, currency: 'USD' | 'TRY' = 'USD'): Cell {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return { value: Math.round(Number(value) * 100) / 100, format: currency === 'TRY' ? 'try' : 'usd' };
}

function isFormattedCell(value: Cell): value is FormattedCell {
  return typeof value === 'object' && value != null && 'format' in value && typeof (value as FormattedCell).value === 'number';
}

/** Stil sırası cellXfs ile birebir: 0 metin · 1 başlık · 2 USD · 3 TL · 4 tarih. */
const STYLE_INDEX: Record<CellFormat, number> = { usd: 2, try: 3, date: 4 };

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function columnName(index: number) {
  let value = index + 1;
  let out = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    value = Math.floor((value - remainder) / 26);
  }
  return out;
}

function cellXml(value: Cell, row: number, col: number, header: boolean) {
  const ref = `${columnName(col)}${row}`;
  if (!header && isFormattedCell(value)) return `<c r="${ref}" s="${STYLE_INDEX[value.format]}"><v>${value.value}</v></c>`;
  const style = header ? ' s="1"' : ' s="0"';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${xmlEscape(value as string | null | undefined)}</t></is></c>`;
}

function sheetXml(sheet: Sheet) {
  const maxCols = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const widths = Array.from({ length: maxCols }, (_, index) => sheet.widths?.[index] ?? 18)
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows.map((values, index) => {
    const rowNo = index + 1;
    return `<row r="${rowNo}">${values.map((value, col) => cellXml(value, rowNo, col, index === 0)).join('')}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${columnName(maxCols - 1)}${maxRows}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  <cols>${widths}</cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="A1:${columnName(maxCols - 1)}${maxRows}"/>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="&quot;₺&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="DD.MM.YYYY"/></numFmts>
  <fonts count="2"><font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1"><alignment vertical="top"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1"><alignment vertical="top"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export type WorkbookOptions = {
  /** docProps başlığı (Excel › Dosya › Bilgi). */
  title?: string;
  /** Üretim zamanı — testlerde sabitlemek için. */
  createdAt?: Date;
};

/** Sayfaları JSZip paketine yazar; çıktı türünü çağıran seçer (tarayıcıda 'blob', Node'da 'uint8array'). */
export function buildWorkbookZip(sheets: Sheet[], options: WorkbookOptions = {}) {
  if (!sheets.length) throw new Error('Çalışma kitabı en az bir sayfa ister.');
  const zip = new JSZip();
  const created = (options.createdAt ?? new Date()).toISOString();
  const title = options.title ?? 'PAX CRM Rapor';
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>PAX CRM</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`);
  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PAX CRM</Application></Properties>`);
  zip.file('xl/styles.xml', stylesXml());
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  sheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)));
  return zip;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Tarayıcı: indirilecek Blob. */
export function buildWorkbookBlob(sheets: Sheet[], options: WorkbookOptions = {}) {
  return buildWorkbookZip(sheets, options).generateAsync({ type: 'blob', mimeType: XLSX_MIME });
}

/** Node / test: paket baytları (JSZip ile geri açılıp içeriği doğrulanabilir). */
export function buildWorkbookBytes(sheets: Sheet[], options: WorkbookOptions = {}) {
  return buildWorkbookZip(sheets, options).generateAsync({ type: 'uint8array' });
}

/** Tarayıcıda dosyayı indirir (geçici nesne URL'si, hemen serbest bırakılır). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
