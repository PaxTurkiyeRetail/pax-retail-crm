import { createHash } from 'node:crypto';

const fail = message => { throw new Error('Retail reference: ' + message); };
const modes = { 'Satış': 'sale', 'Kiralama': 'rental', 'Banka': 'bank' };
const rates2026 = { A80: 15, A910SE: 17, A6650: 20 };
export const retailReferenceNameKey = name => String(name).trim().toLocaleLowerCase('tr-TR');

function embeddedData(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > 10 * 1024 * 1024) fail('HTML boyutu geçersiz');
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const candidates = blocks.filter(m => /\btype\s*=\s*["']application\/json["']/i.test(m[1])).flatMap(m => {
    try { const value = JSON.parse(m[2]); return value && Array.isArray(value.p26) && Array.isArray(value.p27) ? [value] : []; } catch { return []; }
  });
  if (candidates.length !== 1) fail('Tek bir p26/p27 JSON kaynağı gerekli');
  return { data: candidates[0], blocks, hash: createHash('sha256').update(html).digest('hex') };
}

export function retailReferenceSalesTotals(html) {
  const { data } = embeddedData(html);
  if (!Array.isArray(data.salesF) || !Array.isArray(data.salesModels)) fail('Satış firma/model JSON kaynağı gerekli');
  const sum = (rows, field) => rows.reduce((total, row) => {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0) fail('Satış toplamı geçersiz');
    return total + row[field];
  }, 0);
  const usd = sum(data.salesF, 'usd'), terminals = sum(data.salesF, 'qty');
  const modelUsd = sum(data.salesModels, 'usd');
  if (Math.round(usd * 100) !== Math.round(modelUsd * 100)) fail('Referans firma/model ciro toplamı uyuşmuyor');
  const s210 = data.salesModels.filter(row => row.name === 'S210');
  if (s210.length !== 1) fail('Referans S210 modeli tekil olmalı');
  return { firms: data.salesF.length, usd, terminals, s210: sum(s210, 'qty') };
}

export function parseRetailReferencePool(html) {
  const { data, hash } = embeddedData(html);
  if (!Array.isArray(data.crm) || data.crm.length !== 530) fail('CRM havuzu tam 530 kaynak satırı olmalı');
  const seen = new Set();
  const rows = data.crm.map((raw, index) => {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 200) fail('CRM firma adı geçersiz');
    const key = retailReferenceNameKey(raw.name);
    if (seen.has(key)) fail('CRM kaynak firma adı mükerrer');
    seen.add(key);
    if (!['Lead', 'Hunter', 'Kasa', 'Farmer'].includes(raw.status)) fail('CRM kaynak statüsü geçersiz');
    if (typeof raw.kasa !== 'string' || !['Bilinmeyen', 'Univera', 'Inhouse', 'Nebim', 'Toshiba'].includes(raw.kasa)) fail('CRM kasa raporlama grubu geçersiz');
    return { referenceKey: `retail-reference-2026-2027:crm:${String(index).padStart(3, '0')}`, referenceName: raw.name,
      retailStatus: raw.status, registerVendorGroup: raw.kasa, sourceName: 'Retail_2026_2027.html',
      referenceSnapshot: { schemaVersion: 1, sourceSha256: hash, sourceArray: 'crm', sourceIndex: index, original: raw } };
  });
  return { sourceSha256: hash, rows };
}

/** Exact Turkish case/whitespace identity only; no fuzzy aliases or customer mutations. */
export function matchRetailReferencePool(rows, customers) {
  const index = new Map();
  for (const customer of customers) {
    const key = retailReferenceNameKey(customer.name);
    index.set(key, [...(index.get(key) ?? []), customer.id]);
  }
  const matched = rows.map(row => ({ ...row, matches: index.get(retailReferenceNameKey(row.referenceName)) ?? [] }));
  const missing = matched.filter(row => !row.matches.length).length;
  const ambiguous = matched.filter(row => row.matches.length > 1).length;
  if (missing || ambiguous) fail(`CRM eşlemesi başarısız: eksik=${missing}, belirsiz=${ambiguous}`);
  const result = matched.map(({ matches, ...row }) => ({ ...row, customerId: matches[0] }));
  if (new Set(result.map(row => row.customerId)).size !== rows.length) fail('CRM aynı müşteri birden fazla kaynak satırına bağlanıyor');
  return result;
}

/** Read embedded JSON only. Never execute scripts, browser storage, or arbitrary HTML code. */
export function parseRetailReferencePlan(html) {
  const { data, blocks, hash } = embeddedData(html);
  const monthBlocks = blocks.filter(m => /\bid\s*=\s*["']pipeline27-embedded-plans["']/i.test(m[1]));
  if (monthBlocks.length > 1) fail('Birden fazla aylık plan kaynağı');
  let months = {};
  if (monthBlocks.length) { try { months = JSON.parse(monthBlocks[0][2] || '{}'); } catch { fail('Gömülü ay planı JSON değil'); } }
  if (!months || typeof months !== 'object' || Array.isArray(months)) fail('Ay planı nesne olmalı');
  const rows = [];
  for (const [field, year, count, total] of [['p26', 2026, 15, 5186], ['p27', 2027, 17, 6595]]) {
    const source = data[field];
    if (source.length !== count) fail(`${year} satır sayısı ${count} olmalı`);
    let qty = 0;
    source.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Geçersiz plan satırı');
      if (typeof raw.firm !== 'string' || !raw.firm.trim() || raw.firm.length > 200) fail('Firma adı geçersiz');
      if (typeof raw.model !== 'string' || !/^[A-Za-z0-9*_-]{1,40}$/.test(raw.model)) fail('Model kodu geçersiz');
      if (!Number.isInteger(raw.qty) || raw.qty <= 0 || raw.qty > 100000) fail('Adet pozitif tamsayı olmalı');
      if (!Number.isInteger(raw.prob) || raw.prob < 0 || raw.prob > 100) fail('Olasılık geçersiz');
      if (!Object.hasOwn(modes, raw.mode)) fail('İş modeli Satış/Kiralama/Banka olmalı');
      if (raw.note != null && (typeof raw.note !== 'string' || raw.note.length > 4000)) fail('Not geçersiz');
      const month = year === 2026 ? 12 : Object.hasOwn(months, String(index)) ? months[index] : 3;
      if (!Number.isInteger(month) || month < 1 || month > 12) fail('Ay 1..12 olmalı');
      const code = raw.model.replace(/\*/g, '').trim().toUpperCase();
      const businessModel = modes[raw.mode];
      const monthly = year === 2026 && businessModel === 'rental' ? rates2026[code] : null;
      if (year === 2026 && businessModel === 'rental' && monthly == null) fail('Referansta kiralama tarifesi bulunmuyor');
      qty += raw.qty;
      rows.push({
        referenceKey: `retail-reference-2026-2027:${field}:${String(index).padStart(2, '0')}`,
        planYear: year, planMonth: month, firmName: raw.firm, productCode: code,
        quantity: raw.qty, businessModel, probability: raw.prob, note: raw.note ?? '',
        unitPrice: null, rentalMonthlyPrice: monthly, sourceName: 'Retail_2026_2027.html',
        referenceSnapshot: { schemaVersion: 1, sourceSha256: hash, sourceArray: field, sourceIndex: index, original: raw,
          monthOrigin: year === 2026 ? 'year-end-december' : Object.hasOwn(months, String(index)) ? 'embedded-plan' : 'reference-default-march',
          rentalRateOrigin: monthly == null ? null : 'reference-2026-model-monthly-usd' },
      });
    });
    if (qty !== total) fail(`${year} toplamı ${total} olmalı`);
  }
  return { sourceSha256: hash, rows };
}
