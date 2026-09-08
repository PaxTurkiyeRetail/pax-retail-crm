'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const KOLU_SIRA: Record<string, number> = { Retail: 0, Vertical: 1 };

type Row = {
  customerId: string;
  musteri: string;
  isKolu: string | null;
  entegrasyonModeli: string;
  aktifFazNo: number | null;
  aktifFazAdi: string | null;
  sonNot: string | null;
  sonEventTarihi: string | null;
};

type Payload = {
  filters: { isKolu: string };
  summary: { total: number };
  rows: Row[];
  isKoluOptions: string[];
};

const EMPTY: Payload = { filters: { isKolu: '' }, summary: { total: 0 }, rows: [], isKoluOptions: [] };

function xlsxEscape(value: unknown) {
  return String(value ?? '')
    .split('').filter((ch) => ch.charCodeAt(0) >= 32 || ch.charCodeAt(0) === 9).join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number) {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function xlsxCell(ref: string, value: unknown, styleId = 1) {
  const text = String(value ?? '').trim() || '-';
  return `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t>${xlsxEscape(text)}</t></is></c>`;
}

async function downloadStyledXlsx(filename: string, header: string[], dataRows: unknown[][]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const widths = header.map((title, index) => Math.min(index <= 6 ? 52 : 24, Math.max(index <= 6 ? 18 : 14, Math.max(String(title).length, ...dataRows.map((row) => String(row[index] ?? '').length)) + 3)));
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const headerRow = `<row r="1" ht="24" customHeight="1">${header.map((title, index) => xlsxCell(`${columnName(index)}1`, title, 2)).join('')}</row>`;
  const bodyRows = (dataRows.length ? dataRows : [Array(header.length).fill('')]).map((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    const styleId = rowIndex % 2 === 0 ? 1 : 3;
    const cells = header.map((_, colIndex) => xlsxCell(`${columnName(colIndex)}${excelRow}`, row[colIndex], styleId)).join('');
    return `<row r="${excelRow}">${cells}</row>`;
  }).join('');
  const lastCell = `${columnName(header.length - 1)}${Math.max(dataRows.length + 1, 2)}`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.folder('docProps')?.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>PAX CRM</dc:creator><cp:lastModifiedBy>PAX CRM</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`);
  zip.folder('docProps')?.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PAX CRM</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Entegrasyon Raporu</vt:lpstr></vt:vector></TitlesOfParts></Properties>`);
  const xl = zip.folder('xl');
  xl?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Entegrasyon Raporu" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  xl?.folder('_rels')?.file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  xl?.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="@"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB7C9DA"/></left><right style="thin"><color rgb="FFB7C9DA"/></right><top style="thin"><color rgb="FFB7C9DA"/></top><bottom style="thin"><color rgb="FFB7C9DA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  xl?.folder('worksheets')?.file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${headerRow}${bodyRows}</sheetData><autoFilter ref="A1:${columnName(header.length - 1)}${Math.max(dataRows.length + 1, 2)}"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export default function EntegrasyonRaporuClient() {
  const [isKolu, setIsKolu] = useState('');
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (isKoluFilter: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isKoluFilter) params.set('isKolu', isKoluFilter);
      const res = await fetch(`/api/reports/entegrasyon-firmalari?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Rapor yüklenemedi.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(isKolu); }, [load, isKolu]);

  const sortedRows = useMemo(() => {
    return [...data.rows].sort((a, b) => {
      const sa = KOLU_SIRA[a.isKolu ?? ''] ?? 99;
      const sb = KOLU_SIRA[b.isKolu ?? ''] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.musteri.localeCompare(b.musteri, 'tr');
    });
  }, [data.rows]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const header = ['Firma', 'Entegrasyon Modeli', 'İş Kolu', 'Aktif Faz', 'Son Not'];
      const rows = sortedRows.map((row) => [
        row.musteri,
        row.entegrasyonModeli,
        row.isKolu ?? '-',
        row.aktifFazNo != null ? `Faz ${row.aktifFazNo}${row.aktifFazAdi ? ` — ${row.aktifFazAdi}` : ''}` : '-',
        row.sonNot ?? '-',
      ]);
      await downloadStyledXlsx('entegrasyon-raporu.xlsx', header, rows);
    } finally {
      setExporting(false);
    }
  }, [sortedRows]);

  return (
    <main className="pax-page-container">
      <div className="pax-card" style={{ padding: 20, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Entegrasyon Raporu</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
          Entegrasyon süreci açık müşterilerin ve iş ortaklarının aktif fazı ile son aktivite notu.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {['', 'Retail', 'Vertical'].map((opt) => (
            <button
              key={opt || 'all'}
              type="button"
              onClick={() => setIsKolu(opt)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--border-1, #ccc)',
                background: isKolu === opt ? '#1F4E79' : 'transparent',
                color: isKolu === opt ? '#fff' : 'inherit',
                fontWeight: isKolu === opt ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {opt || 'Tümü'}
            </button>
          ))}
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{data.summary.total} firma</span>
          <button
            type="button"
            className="secondary"
            onClick={() => void exportExcel()}
            disabled={exporting || !data.rows.length}
          >
            {exporting ? 'Hazırlanıyor…' : 'Excel İndir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="pax-card" style={{ padding: 16, marginBottom: 16, color: '#dc2626' }}>{error}</div>
      )}

      <div className="pax-card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-1, #e5e7eb)' }}>
              <th style={{ padding: '10px 14px' }}>Firma</th>
              <th style={{ padding: '10px 14px' }}>Model</th>
              <th style={{ padding: '10px 14px' }}>İş Kolu</th>
              <th style={{ padding: '10px 14px' }}>Aktif Faz</th>
              <th style={{ padding: '10px 14px' }}>Son Not</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Kayıt yok.</td></tr>
            ) : sortedRows.map((row) => {
              const done = row.aktifFazNo != null && row.aktifFazNo >= 9;
              return (
                <tr
                  key={row.customerId}
                  style={{
                    borderBottom: '1px solid var(--border-1, #f1f5f9)',
                    background: done ? 'rgba(34,197,94,0.15)' : undefined,
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.musteri}</td>
                  <td style={{ padding: '10px 14px' }}>{row.entegrasyonModeli}</td>
                  <td style={{ padding: '10px 14px' }}>{row.isKolu ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontWeight: done ? 700 : 400, color: done ? '#15803d' : undefined }}>
                    {row.aktifFazNo != null ? `Faz ${row.aktifFazNo}${row.aktifFazAdi ? ` — ${row.aktifFazAdi}` : ''}` : '—'}
                    {done ? ' ✅' : ''}
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 360 }}>{row.sonNot ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
