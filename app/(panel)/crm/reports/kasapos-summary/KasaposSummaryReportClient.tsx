'use client';

import { useEffect, useMemo, useState } from 'react';
import '@/styles/reports-management.css';
import '@/styles/reports-kasapos-summary.css';

type QuoteItem = {
  id: string;
  product_name_snapshot: string | null;
  product_code_snapshot: string | null;
  product_type: string | null;
  category: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  is_recurring: boolean | null;
  formatted_unit_price: string;
  formatted_total_price: string;
};

type QuoteSummary = {
  id: string;
  quote_no: string;
  status: string;
  probability: number;
  total_device_count: number;
  total_amount: number;
  formatted_total_amount: string;
  valid_until: string | null;
  follow_up_date: string | null;
  owner_name: string;
  opportunity_title: string;
  items: QuoteItem[];
};

type ReportRow = {
  musteri_id: string;
  firma_adi: string;
  kasapos_firmasi: string;
  faz_no: number | null;
  faz_adi: string | null;
  faz_display: string;
  faz_durumu: string;
  faz_grubu: string;
  sabit_bilgisayar_markasi: string;
  pos_modeli: string;
  pos_markasi: string;
  magaza_sayisi: string;
  toplam_pos_adedi: string;
  toplam_pos_adedi_numeric: number | null;
  has_quote: boolean;
  quote_count: number;
  latest_quote: QuoteSummary | null;
};

type Payload = {
  kasaposOptions: string[];
  selectedKasapos: string;
  rows: ReportRow[];
  totals: {
    totalCompanies: number;
    totalPos: number;
    numericPosCoverage: number;
    uniqueKasaposCount: number;
    withStoreCount: number;
  };
};

const EMPTY: Payload = {
  kasaposOptions: [],
  selectedKasapos: '',
  rows: [],
  totals: { totalCompanies: 0, totalPos: 0, numericPosCoverage: 0, uniqueKasaposCount: 0, withStoreCount: 0 },
};

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function excelEscape(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function excelColumnWidth(values: unknown[], min = 90, max = 360) {
  const longest = values.reduce<number>((len, value) => Math.max(len, String(value ?? '').length), 0);
  return Math.min(max, Math.max(min, longest * 8 + 28));
}


function xlsxEscape(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
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
  zip.folder('docProps')?.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PAX CRM</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Kasapos Raporu</vt:lpstr></vt:vector></TitlesOfParts></Properties>`);
  const xl = zip.folder('xl');
  xl?.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kasapos Raporu" sheetId="1" r:id="rId1"/></sheets></workbook>`);
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

function trDate(value: string | null | undefined) {
  if (!value) return '-';

  const raw = String(value).trim();
  if (!raw) return '-';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed);
  }

  return raw;
}

function statusLabel(status: string) {
  const key = String(status ?? '').toLowerCase();
  if (key === 'draft') return 'Taslak';
  if (key === 'sent') return 'Gönderildi';
  if (key === 'closed') return 'Kapatıldı';
  return status || '-';
}

export default function KasaposSummaryReportPage() {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kasapos, setKasapos] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'firma_adi' | 'faz_no' | 'kasapos_firmasi' | 'toplam_pos_adedi'>('firma_adi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedQuoteRow, setSelectedQuoteRow] = useState<ReportRow | null>(null);

  const load = async (nextKasapos = kasapos) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (nextKasapos) params.set('kasapos', nextKasapos);
      const queryString = params.toString();
      const res = await fetch(`/api/reports/kasapos-summary${queryString ? `?${queryString}` : ''}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.message || 'Rapor yüklenemedi');
        setPayload(EMPTY);
        return;
      }
      setPayload({ ...EMPTY, ...data, totals: { ...EMPTY.totals, ...(data?.totals ?? {}) } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(''); }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    let rows = payload.rows.filter((row) => {
      if (!needle) return true;
      const haystack = [
        row.firma_adi,
        row.kasapos_firmasi,
        row.pos_modeli,
        row.pos_markasi,
        row.faz_display,
        row.faz_durumu,
        row.sabit_bilgisayar_markasi,
        row.magaza_sayisi,
        row.toplam_pos_adedi,
        row.latest_quote?.quote_no,
        row.latest_quote?.owner_name,
        row.latest_quote?.opportunity_title,
      ].join(' ').toLocaleLowerCase('tr');
      return haystack.includes(needle);
    });

    rows = [...rows].sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';

      if (sortBy === 'faz_no') {
        left = a.faz_no ?? Number.MIN_SAFE_INTEGER;
        right = b.faz_no ?? Number.MIN_SAFE_INTEGER;
      } else if (sortBy === 'toplam_pos_adedi') {
        left = a.toplam_pos_adedi_numeric ?? Number.MIN_SAFE_INTEGER;
        right = b.toplam_pos_adedi_numeric ?? Number.MIN_SAFE_INTEGER;
      } else {
        left = a[sortBy] ?? '';
        right = b[sortBy] ?? '';
      }

      let result = 0;
      if (typeof left === 'number' && typeof right === 'number') result = left - right;
      else result = String(left).localeCompare(String(right), 'tr');
      return sortDir === 'asc' ? result : -result;
    });

    return rows;
  }, [payload.rows, query, sortBy, sortDir]);

  const exportCsv = async () => {
    const header = ['Firma Adı', 'Kasapos Firması', 'POS Modeli', 'POS Markası', 'Faz No (Açıklamasıyla)', 'Faz Durumu', 'Sabit Bilgisayar Markası', 'Mağaza Sayısı', 'Toplam Pos Adedi', 'Teklif Var mı', 'Teklif No'];
    const dataRows = filteredRows.map((row) => [
      row.firma_adi,
      row.kasapos_firmasi,
      row.pos_modeli,
      row.pos_markasi,
      row.faz_display,
      row.faz_durumu,
      row.sabit_bilgisayar_markasi,
      row.magaza_sayisi,
      row.toplam_pos_adedi,
      row.has_quote ? 'Var' : 'Yok',
      row.latest_quote?.quote_no ?? '-',
    ]);
    try {
      await downloadStyledXlsx('kasapos-raporu.xlsx', header, dataRows);
    } catch (error) {
      console.error('Kasapos raporu indirilemedi', error);
      setMessage('Excel dosyası oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  const clearFilters = async () => {
    setKasapos('');
    setQuery('');
    await load('');
  };

  const setSorting = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir(field === 'faz_no' || field === 'toplam_pos_adedi' ? 'desc' : 'asc');
  };

  const selectedQuote = selectedQuoteRow?.latest_quote ?? null;

  return (
    <>
      <main className="kasapos-report-page pax-page-container">
        <div className="pax-hero kasapos-hero">
          <span className="pax-hero-eyebrow">Rapor Merkezi · Kasapos Özeti</span>
          <h1 className="pax-hero-title">Kasapos Firma Raporu</h1>
          <p className="pax-hero-description">
            Müşteriler ekranında künye durumu Tamam olan firmaları; Kasapos firması, faz bilgisi, sabit bilgisayar markası, mağaza sayısı, toplam POS adedi ve teklif görünümü ile listeler.
          </p>
          <div className="hero-actions">
            <button className="btn-hero" onClick={() => void load()} disabled={loading}>{loading ? 'Yükleniyor...' : '↻ Yenile'}</button>
            <button className="secondary" onClick={exportCsv} disabled={!filteredRows.length}>Excel İndir</button>
          </div>
        </div>

        <section className="kasapos-kpi-grid">
          <div className="kasapos-kpi-card"><span>Toplam Firma</span><strong>{payload.totals.totalCompanies}</strong><small>Künyesi tamam müşteriler</small></div>
          <div className="kasapos-kpi-card"><span>Toplam POS</span><strong>{payload.totals.totalPos}</strong><small>Sayısal okunabilen kayıtlar</small></div>
          <div className="kasapos-kpi-card"><span>POS Veri Kapsaması</span><strong>%{payload.totals.numericPosCoverage}</strong><small>Toplam POS adedi dolu satırlar</small></div>
          <div className="kasapos-kpi-card"><span>Kasapos Firma Sayısı</span><strong>{payload.totals.uniqueKasaposCount}</strong><small>Benzersiz Kasapos firması</small></div>
          <div className="kasapos-kpi-card"><span>Mağaza Bilgisi Olan</span><strong>{payload.totals.withStoreCount}</strong><small>Mağaza sayısı dolu</small></div>
        </section>

        <section className="surface kasapos-filter-surface">
          <div className="filters-grid kasapos-filters-grid">
            <label className="field">
              <span className="field-label">Arama</span>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Firma, Kasapos, faz, durum, marka, teklif" />
            </label>
            <label className="field">
              <span className="field-label">Kasapos Firması</span>
              <select className="input" value={kasapos} onChange={async (e) => {
                const value = e.target.value;
                setKasapos(value);
                await load(value);
              }}>
                <option value="">Tüm Kasapos Firmaları</option>
                {payload.kasaposOptions.filter((item) => item !== 'Tüm Kasapos Firmaları').map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Görünüm</span>
              <div className="input kasapos-inline-info">Satır sayısı: <strong>{filteredRows.length}</strong></div>
            </label>
          </div>
          <div className="filter-actions">
            <button className="secondary" onClick={() => void clearFilters()}>Filtreyi Temizle</button>
          </div>
        </section>

        {message ? <div className="message kasapos-message">{message}</div> : null}

        <section className="surface">
          <div className="table-wrap kasapos-table-wrap">
            <table className="kasapos-table">
              <thead>
                <tr>
                  <th onClick={() => setSorting('firma_adi')}>Firma Adı</th>
                  <th onClick={() => setSorting('kasapos_firmasi')}>Kasapos Firması</th>
                  <th>POS Modeli</th>
                  <th>POS Markası</th>
                  <th onClick={() => setSorting('faz_no')}>Faz No (Açıklamasıyla)</th>
                  <th>Durum</th>
                  <th>Sabit Bilgisayar Markası</th>
                  <th>Mağaza Sayısı</th>
                  <th onClick={() => setSorting('toplam_pos_adedi')}>Toplam Pos Adedi</th>
                  <th>Teklif</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.musteri_id}>
                    <td className="firm-cell">{row.firma_adi}</td>
                    <td>{row.kasapos_firmasi}</td>
                    <td>{row.pos_modeli}</td>
                    <td>{row.pos_markasi}</td>
                    <td>
                      <div className="phase-cell">
                        <strong>{row.faz_no != null ? `FAZ ${row.faz_no}` : '-'}</strong>
                        <span>{row.faz_display}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          minHeight: 30,
                          padding: '0 10px',
                          borderRadius: 999,
                          background: row.faz_durumu !== '-' ? 'rgba(14,165,233,.10)' : 'rgba(148,163,184,.12)',
                          color: row.faz_durumu !== '-' ? '#0369a1' : 'var(--text-3)',
                          border: row.faz_durumu !== '-' ? '1px solid rgba(14,165,233,.18)' : '1px solid var(--border)',
                          fontWeight: 800,
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.faz_durumu}
                      </span>
                    </td>
                    <td>{row.sabit_bilgisayar_markasi}</td>
                    <td>{row.magaza_sayisi}</td>
                    <td>{row.toplam_pos_adedi}</td>
                    <td>
                      {row.has_quote && row.latest_quote ? (
                        <button
                          type="button"
                          onClick={() => setSelectedQuoteRow(row)}
                          style={{
                            border: '1px solid #c7d2fe',
                            background: '#eef2ff',
                            color: '#3730a3',
                            borderRadius: 999,
                            minHeight: 34,
                            padding: '0 12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Var{row.quote_count > 1 ? ` (${row.quote_count})` : ''}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>Yok</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={10} className="kasapos-empty">Kayıt bulunamadı.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedQuoteRow && selectedQuote ? (
        <div
          onClick={() => setSelectedQuoteRow(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.32)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '86vh',
              overflow: 'auto',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 22,
              boxShadow: '0 20px 50px rgba(15,23,42,.18)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Teklif Detayı</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1.2 }}>{selectedQuoteRow.firma_adi}</div>
                <div style={{ marginTop: 4, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.4 }}>
                  {selectedQuote.quote_no} · {selectedQuote.opportunity_title || 'Ticari teklif'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuoteRow(null)}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  borderRadius: 12,
                  minHeight: 36,
                  minWidth: 36,
                  padding: '0 12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: 'var(--text-2)',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', marginBottom: 14 }}>
              <MiniCard label="Olasılık" value={`%${selectedQuote.probability ?? 0}`} />
              <MiniCard label="Cihaz / Tutar" value={`${selectedQuote.total_device_count} / ${selectedQuote.formatted_total_amount}`} />
              <MiniCard label="Geçerlilik" value={trDate(selectedQuote.valid_until)} />
              <MiniCard label="Takip" value={trDate(selectedQuote.follow_up_date)} />
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', marginBottom: 14 }}>
              <div style={sectionStyleCompact}>
                <div style={sectionTitleCompact}>Teklif Özeti</div>
                <div style={metaGridStyle}>
                  <MetaRow label="Teklif No" value={selectedQuote.quote_no} />
                  <MetaRow label="Durum" value={statusLabel(selectedQuote.status)} />
                  <MetaRow label="Satışçı" value={selectedQuote.owner_name || '-'} />
                  <MetaRow label="Toplam" value={selectedQuote.formatted_total_amount} />
                </div>
              </div>
              <div style={sectionStyleCompact}>
                <div style={sectionTitleCompact}>Müşteri Özeti</div>
                <div style={metaGridStyle}>
                  <MetaRow label="Kasapos firması" value={selectedQuoteRow.kasapos_firmasi} />
                  <MetaRow label="Faz" value={selectedQuoteRow.faz_display} />
                  <MetaRow label="Mağaza sayısı" value={selectedQuoteRow.magaza_sayisi} />
                  <MetaRow label="Toplam POS" value={selectedQuoteRow.toplam_pos_adedi} />
                </div>
              </div>
            </div>

            <div style={sectionStyleCompact}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={sectionTitleCompact}>Satır Detayları</div>
                <div style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 700 }}>{selectedQuote.items.length} satır</div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedQuote.items.length ? selectedQuote.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                      background: 'rgba(248,250,252,.9)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 14 }}>{item.product_name_snapshot || '-'}</div>
                        <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 12 }}>{item.product_code_snapshot || '-'}{item.category ? ` · ${item.category}` : ''}</div>
                      </div>
                      <div style={{ whiteSpace: 'nowrap', fontWeight: 900, color: 'var(--text)', fontSize: 13 }}>{item.formatted_total_price}{item.is_recurring ? ' / ay' : ''}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', marginTop: 10 }}>
                      <MiniMeta label="Tip" value={item.product_type || '-'} />
                      <MiniMeta label="Adet" value={String(item.quantity ?? 0)} />
                      <MiniMeta label="Birim" value={item.formatted_unit_price} />
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: 14, color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 14 }}>Satır detayı bulunamadı.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900, color: 'var(--text)', lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 3, color: 'var(--text)', fontWeight: 800, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{label}</span>
      <strong style={{ color: 'var(--text)', textAlign: 'right', fontSize: 13 }}>{value}</strong>
    </div>
  );
}

const sectionStyleCompact = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 14 } as const;
const sectionTitleCompact = { fontWeight: 900, fontSize: 15, color: 'var(--text)' } as const;
const metaGridStyle = { display: 'grid', gap: 8, marginTop: 10 } as const;
