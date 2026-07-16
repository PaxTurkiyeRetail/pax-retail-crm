import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';

import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteDetailById } from '@/lib/quotes/service';
import { STATIC_QUOTE_PRODUCTS, STATIC_QUOTE_PRICING_RULES, normalizeQuoteSpecs, type QuoteProduct } from '@/lib/quotes/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QuoteItem = {
  id?: string;
  product_id?: string | null;
  product_name_snapshot?: string | null;
  product_code_snapshot?: string | null;
  db_product_code?: string | null;
  description_snapshot?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  product_type?: string | null;
  category?: string | null;
  is_recurring?: boolean | null;
  billing_period?: string | null;
};

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

const BLUE = rgb(0.04, 0.68, 0.88);
const DARK_BLUE = rgb(0.02, 0.03, 0.33);
const TEXT = rgb(0.07, 0.07, 0.1);
const SOFT_TEXT = rgb(0.45, 0.45, 0.48);
const LINE = rgb(0.82, 0.82, 0.82);

function safeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalize(value: unknown) {
  return safeText(value)
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}


function fileKey(value: unknown) {
  return normalize(value).replace(/\s+/g, '');
}

function fileSlug(value: unknown) {
  return normalize(value).toLowerCase().replace(/\s+/g, '-');
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let raw = safeText(value);
  if (!raw) return 0;

  raw = raw.replace(/[^0-9,.-]/g, '');

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  // 1.234,56 -> 1234.56
  if (hasComma && hasDot) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // 900,00 -> 900.00
    raw = raw.replace(',', '.');
  } else if (hasDot) {
    // 900.00 -> 900.00, 130.900 -> 130900
    const parts = raw.split('.');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3 && parts.every((part, index) => index === 0 || part.length === 3)) {
      raw = parts.join('');
    }
  }

  const num = Number(raw || 0);
  return Number.isFinite(num) ? num : 0;
}

function trDate(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return safeText(value);
  return parsed.toLocaleDateString('tr-TR');
}

function money(value: number) {
  return `$${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0))}`;
}

function chunkText(text: string, maxLen: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function drawCentered(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color = TEXT) {
  const width = page.getWidth();
  page.drawText(text, {
    x: (width - textWidth(font, text, size)) / 2,
    y,
    size,
    font,
    color,
  });
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = TEXT) {
  page.drawText(text, {
    x: rightX - textWidth(font, text, size),
    y,
    size,
    font,
    color,
  });
}

function drawFitted(page: PDFPage, text: string, x: number, y: number, maxWidth: number, size: number, font: PDFFont, color = TEXT) {
  let fontSize = size;
  let value = safeText(text);
  while (fontSize > 6 && textWidth(font, value, fontSize) > maxWidth) fontSize -= 0.5;
  while (value.length > 4 && textWidth(font, value, fontSize) > maxWidth) value = `${value.slice(0, -4)}...`;
  page.drawText(value, { x, y, size: fontSize, font, color });
}

async function loadFonts(pdfDoc: PDFDocument): Promise<PdfFonts> {
  pdfDoc.registerFontkit(fontkit);

  const fontCandidates = [
    {
      regular: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'),
      bold: path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
  ];

  for (const candidate of fontCandidates) {
    try {
      const [regularBytes, boldBytes] = await Promise.all([
        fs.readFile(candidate.regular),
        fs.readFile(candidate.bold),
      ]);
      return {
        regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
        bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
      };
    } catch {
      // Fallback below.
    }
  }

  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function isRecurring(item: QuoteItem) {
  if (typeof item.is_recurring === 'boolean') return item.is_recurring;
  const text = normalize(`${item.product_type ?? ''} ${item.category ?? ''} ${item.billing_period ?? ''} ${item.product_name_snapshot ?? ''}`);
  return text.includes('AYLIK') || text.includes('RECURRING') || text.includes('TMS') || text.includes('KASAPOS');
}

function productInfoPageIndex(item: QuoteItem) {
  const text = normalize(`${item.product_name_snapshot ?? ''} ${item.product_code_snapshot ?? ''} ${item.description_snapshot ?? ''}`);

  // PAX_TURKIYE_EFT_POS_TEKLIF_SABLONU.pdf icindeki urun bilgi sayfalari burada eslestirilir.
  // Simdiki sablonda A80 urun bilgi sayfasi 2. sayfadir, pdf-lib icin index 1.
  if (text.includes('A80')) return 1;

  // Yeni urun sayfalari sablona eklendiginde burada index eslestirmesi yapilabilir.
  // Ornek:
  // if (text.includes('A920')) return 2;
  // if (text.includes('A910')) return 3;

  return 1;
}


function productVisualCode(item: QuoteItem) {
  // Urun bilgi sayfasi kesinlikle quote_products.code ile eslesir.
  // Oncelik canli DB kodu, sonra teklif olusturuldugu andaki snapshot kodudur.
  const catalogProduct = findCatalogProduct(item);
  return safeText(
    item.db_product_code ||
    item.product_code_snapshot ||
    catalogProduct?.code ||
    item.product_id ||
    ''
  );
}

function productVisualSearchKeys(item: QuoteItem) {
  const code = productVisualCode(item);
  if (!code) return [];
  // Dosya adi ornekleri: ELYS-TOWER-L1450.pdf, ELYSTOWERL1450.pdf, elys-tower-l1450.png
  return Array.from(new Set([code, fileSlug(code), fileKey(code)].map((value) => fileKey(value)).filter(Boolean)));
}

async function findProductVisualFile(item: QuoteItem) {
  const dir = path.join(process.cwd(), 'public', 'templates', 'product-pages');
  const supported = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const keys = productVisualSearchKeys(item);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!supported.has(ext)) continue;

    const base = path.basename(file, ext);
    const baseKey = fileKey(base);
    if (keys.includes(baseKey)) {
      return path.join(dir, file);
    }
  }

  return null;
}

function drawImageContain(page: PDFPage, image: any) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const imgW = image.width;
  const imgH = image.height;
  const scale = Math.min(pageWidth / imgW, pageHeight / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  page.drawImage(image, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  });
}

async function addProductVisualPage(args: {
  outputDoc: PDFDocument;
  templateDoc: PDFDocument;
  templateProductPageIndex: number;
  item: QuoteItem;
}) {
  const visualPath = await findProductVisualFile(args.item);

  // A80 icin hazir template sayfasi varsa urun sayfasi olarak onu kullanabiliriz.
  // Diger cihazlar icin public/templates/product-pages klasorune cihaz adiyla PDF/PNG/JPG koyulmasi zorunlu.
  const productText = normalize(`${args.item.product_name_snapshot ?? ''} ${args.item.product_code_snapshot ?? ''}`);
  if (!visualPath && productText.includes('A80')) {
    await copyTemplatePage({ source: args.templateDoc, target: args.outputDoc, index: args.templateProductPageIndex });
    return;
  }

  if (!visualPath) {
    const code = productVisualCode(args.item);
    throw new Error(
      `Urun bilgi sayfasi bulunamadi. public/templates/product-pages icine quote_products.code ile ayni isimde PDF/PNG/JPG ekleyin: ${code || 'URUN_KODU'}.pdf`
    );
  }

  const ext = path.extname(visualPath).toLowerCase();
  const bytes = await fs.readFile(visualPath);

  if (ext === '.pdf') {
    const productDoc = await PDFDocument.load(bytes);
    const [page] = await args.outputDoc.copyPages(productDoc, [0]);
    args.outputDoc.addPage(page);
    return;
  }

  // PNG/JPG tam sayfa urun bilgi gorseli olarak eklenir.
  const [templatePage] = await args.outputDoc.copyPages(args.templateDoc, [args.templateProductPageIndex]);
  const { width, height } = templatePage.getSize();
  const page = args.outputDoc.addPage([width, height]);
  const image = ext === '.png' ? await args.outputDoc.embedPng(bytes) : await args.outputDoc.embedJpg(bytes);
  drawImageContain(page, image);
}

function cleanProductName(item: QuoteItem) {
  const name = safeText(item.product_name_snapshot || item.product_code_snapshot || 'PAX Ürün');
  return name.replace(/\s*[–-]\s*.*/, '').trim();
}

function productDescription(item: QuoteItem) {
  const desc = safeText(item.description_snapshot);
  if (desc) return desc;
  const name = safeText(item.product_name_snapshot);
  const parts = name.split(/\s+[–-]\s+/);
  if (parts.length > 1) return parts.slice(1).join(' - ');
  return isRecurring(item) ? 'Kasapos + TMS' : 'Android EFT POS';
}

function findCatalogProduct(item: QuoteItem): QuoteProduct | null {
  const productId = safeText(item.product_id);
  if (productId) {
    const byId = STATIC_QUOTE_PRODUCTS.find((product) => product.id === productId);
    if (byId) return byId;
  }

  const itemText = normalize(`${item.product_name_snapshot ?? ''} ${item.product_code_snapshot ?? ''}`);
  if (!itemText) return null;

  return STATIC_QUOTE_PRODUCTS.find((product) => {
    const productCode = normalize(product.code);
    const productName = normalize(product.name);
    return itemText.includes(productCode) || itemText.includes(productName) || productName.includes(itemText);
  }) ?? null;
}

function productDisplayName(item: QuoteItem) {
  const catalogProduct = findCatalogProduct(item);
  return safeText(catalogProduct?.name || cleanProductName(item));
}

function productDisplayDescription(item: QuoteItem) {
  const catalogProduct = findCatalogProduct(item);
  return safeText(catalogProduct?.description || productDescription(item));
}

function productSpecs(item: QuoteItem) {
  const catalogProduct = findCatalogProduct(item);
  const fromCatalog = normalizeQuoteSpecs(catalogProduct?.specs);
  if (fromCatalog.length) return fromCatalog;

  const fromItem = normalizeQuoteSpecs((item as any).specs || item.description_snapshot);
  if (fromItem.length) return fromItem;

  return isRecurring(item) ? ['Terminal başına aylık birim fiyat'] : ['Ürün özellikleri katalogtan alınacaktır.'];
}

function pricingRulesForItem(item: QuoteItem) {
  const catalogProduct = findCatalogProduct(item);
  if (!catalogProduct) return [];
  return STATIC_QUOTE_PRICING_RULES
    .filter((rule) => rule.product_id === catalogProduct.id)
    .sort((a, b) => a.min_qty - b.min_qty);
}

function qtyRangeLabel(minQty: number, maxQty: number | null) {
  if (maxQty == null) return `${minQty}+`;
  if (minQty === maxQty) return String(minQty);
  return `${minQty}-${maxQty}`;
}

function totals(items: QuoteItem[]) {
  const subtotal = items.reduce((sum, item) => {
    const qty = toNumber(item.quantity);
    const unit = toNumber(item.unit_price);
    const total = toNumber(item.total_price) || qty * unit;
    return sum + total;
  }, 0);
  const vat = subtotal * 0.2;
  return { subtotal, vat, grandTotal: subtotal + vat };
}

function drawCover(page: PDFPage, fonts: PdfFonts, customerName: string, proposalDate: string) {
  // Kapak sayfasi temizlenmis template'ten gelir:
  // - Orijinal baslik, "Fiyat Teklifi" ve eski tarih PDF content stream'inden kaldirildi.
  // - Bu nedenle burada beyaz kutu/cut/crop yok; arka plandaki watermark ve cihaz gorselleri aynen kalir.
  // - Sadece dinamik metinler yazilir.
  drawCentered(page, 'PAX Türkiye EFT POS Ödeme Çözümleri', 586, 19.5, fonts.bold, SOFT_TEXT);

  const subtitle = `Fiyat Teklifi - ${customerName}`;
  drawCentered(page, subtitle, 552, customerName.length > 22 ? 17.2 : 19.5, fonts.bold, SOFT_TEXT);

  drawCentered(page, proposalDate, 127, 17.5, fonts.bold, TEXT);
}


function drawProductInfoPage(page: PDFPage, fonts: PdfFonts, item: QuoteItem) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Şablondaki örnek ürün bilgileri tamamen temizlenir; ürün içeriği catalog verisinden yeniden çizilir.
  page.drawRectangle({ x: 0, y: 64, width: pageWidth, height: pageHeight - 64, color: rgb(1, 1, 1) });

  const name = productDisplayName(item).toLocaleUpperCase('tr-TR');
  const desc = productDisplayDescription(item);
  const specs = productSpecs(item).slice(0, 8);
  const rules = pricingRulesForItem(item);

  page.drawText(name, { x: 44, y: 720, size: name.length > 24 ? 22 : 26, font: fonts.bold, color: rgb(0.02, 0.52, 0.84) });
  page.drawText(desc, { x: 44, y: 690, size: desc.length > 36 ? 16 : 19, font: fonts.regular, color: rgb(0.02, 0.52, 0.84) });

  const badgeText = isRecurring(item) ? 'Kasa POS Entegrasyonu & Katma Değerli Hizmetler' : 'Ürün Bilgi Sayfası';
  page.drawRectangle({ x: 44, y: 630, width: 215, height: 54, color: BLUE });
  chunkText(badgeText, 24).slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x: 58, y: 660 - index * 18, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  });

  page.drawRectangle({ x: 44, y: 455, width: 507, height: 136, color: rgb(0.96, 0.985, 1) });
  page.drawRectangle({ x: 44, y: 455, width: 507, height: 136, borderColor: rgb(0.78, 0.89, 0.96), borderWidth: 0.8 });
  page.drawText('Özellikler', { x: 62, y: 562, size: 15, font: fonts.bold, color: DARK_BLUE });

  let specY = 532;
  const leftSpecs = specs.slice(0, 4);
  const rightSpecs = specs.slice(4, 8);
  leftSpecs.forEach((spec) => {
    page.drawText('•', { x: 62, y: specY, size: 10, font: fonts.bold, color: BLUE });
    drawFitted(page, spec, 78, specY, 210, 9.5, fonts.regular, TEXT);
    specY -= 24;
  });
  specY = 532;
  rightSpecs.forEach((spec) => {
    page.drawText('•', { x: 315, y: specY, size: 10, font: fonts.bold, color: BLUE });
    drawFitted(page, spec, 331, specY, 190, 9.5, fonts.regular, TEXT);
    specY -= 24;
  });

  const tableX = 64;
  const tableY = 196;
  const tableW = 467;
  const headerH = 34;
  const rowH = 38;
  const rows = rules.length ? rules.slice(0, 5) : [{ min_qty: toNumber(item.quantity) || 1, max_qty: null, unit_price: toNumber(item.unit_price) }];
  const tableH = headerH + rows.length * rowH;
  const colW = [tableW * 0.54, tableW * 0.23, tableW * 0.23];

  page.drawRectangle({ x: tableX, y: tableY, width: tableW, height: tableH, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: tableX, y: tableY + tableH - headerH, width: tableW, height: headerH, color: BLUE });
  page.drawRectangle({ x: tableX, y: tableY, width: tableW, height: tableH, borderColor: LINE, borderWidth: 0.8 });
  page.drawLine({ start: { x: tableX + colW[0], y: tableY }, end: { x: tableX + colW[0], y: tableY + tableH }, thickness: 0.7, color: LINE });
  page.drawLine({ start: { x: tableX + colW[0] + colW[1], y: tableY }, end: { x: tableX + colW[0] + colW[1], y: tableY + tableH }, thickness: 0.7, color: LINE });

  const headers = ['Ürün', 'Adet', 'Fiyat'];
  let hx = tableX;
  headers.forEach((header, index) => {
    page.drawText(header, { x: hx + (colW[index] - textWidth(fonts.bold, header, 11)) / 2, y: tableY + tableH - 22, size: 11, font: fonts.bold, color: rgb(1, 1, 1) });
    hx += colW[index];
  });

  rows.forEach((rule: any, index) => {
    const y = tableY + tableH - headerH - rowH * (index + 1);
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 0.7, color: LINE });
    if (index === 0) drawFitted(page, productDisplayName(item), tableX + 12, y + 14, colW[0] - 24, 12.5, fonts.bold, DARK_BLUE);
    drawCenteredInBox(page, qtyRangeLabel(toNumber(rule.min_qty), rule.max_qty == null ? null : toNumber(rule.max_qty)), tableX + colW[0], y + 14, colW[1], 10.5, fonts.regular);
    drawRight(page, money(toNumber(rule.unit_price)), tableX + tableW - 24, y + 14, 10.5, fonts.regular, TEXT);
  });

  page.drawText('info@paxturkiye.com | www.paxturkiye.com', { x: 245, y: 38, size: 7.5, font: fonts.regular, color: SOFT_TEXT });
}

function pricingGroupKey(item: QuoteItem) {
  const code = productVisualCode(item) || findCatalogProduct(item)?.code || cleanProductName(item) || productDescription(item);
  return fileKey(code) || fileKey(productDisplayName(item));
}

function groupItemsByProduct(items: QuoteItem[]) {
  const groups = new Map<string, QuoteItem[]>();
  for (const item of items) {
    const key = pricingGroupKey(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.values());
}

function drawQuoteSummaryPage(page: PDFPage, fonts: PdfFonts, customerName: string, items: QuoteItem[], pageNo = 1, pageCount = 1) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // 11. sayfa fiyat alani tamamen yeniden cizilir. Template'ten gelen ornek tablo/metin temizlenir;
  // footer ve alt sol gorsel efekt korunur. Bos satir/grid cizilmez.
  page.drawRectangle({ x: 0, y: 70, width: pageWidth, height: pageHeight - 70, color: rgb(1, 1, 1) });

  const mainProduct = items.find((item) => !isRecurring(item)) ?? items[0];
  const mainName = mainProduct ? productDisplayName(mainProduct) : 'PAX Ürün';
  const mainDesc = mainProduct ? productDisplayDescription(mainProduct) : 'EFT POS';
  const continuation = pageCount > 1 ? ` (${pageNo}/${pageCount})` : '';

  const title = `${customerName} İÇİN ${mainName}`.toLocaleUpperCase('tr-TR');
  const titleLines = chunkText(title, 42).slice(0, 2);
  titleLines.forEach((line, index) => {
    page.drawText(line, {
      x: 28,
      y: 724 - index * 25,
      size: index === 0 ? 20.5 : 18.2,
      font: fonts.bold,
      color: rgb(0.02, 0.52, 0.84),
    });
  });

  page.drawText(`${mainDesc} Fiyat Teklifi${continuation}`, {
    x: 28,
    y: titleLines.length > 1 ? 668 : 694,
    size: 17,
    font: fonts.regular,
    color: rgb(0.02, 0.52, 0.84),
  });

  const rowItems = items.slice(0, 8);
  const visibleRows = Math.max(rowItems.length, 1);
  const tableX = 28;
  const tableW = pageWidth - tableX * 2;
  const colW = [92, 132, 55, 105, tableW - 92 - 132 - 55 - 105];
  const headerH = 34;
  const rowH = visibleRows > 5 ? 28 : 32;
  const summaryRowH = 32;
  const tableTop = titleLines.length > 1 ? 628 : 642;
  const dataH = rowH * visibleRows;
  // Ana tablo cercevesi sadece baslik + veri satirlari icin cizilir.
  page.drawRectangle({ x: tableX, y: tableTop - headerH, width: tableW, height: headerH, color: BLUE });
  page.drawRectangle({ x: tableX, y: tableTop - headerH - dataH, width: tableW, height: headerH + dataH, borderColor: LINE, borderWidth: 0.8 });

  let x = tableX;
  const headers = ['Model Adı', 'Açıklama', 'Adet', 'Birim\nFiyat', 'Toplam Fiyat'];
  headers.forEach((header, index) => {
    if (index > 0) {
      page.drawLine({ start: { x, y: tableTop - headerH - dataH }, end: { x, y: tableTop }, thickness: 0.7, color: LINE });
    }
    const parts = header.split('\\n');
    parts.forEach((part, partIndex) => {
      const size = index === 4 ? 9.7 : 10.4;
      page.drawText(part, {
        x: x + (colW[index] - textWidth(fonts.bold, part, size)) / 2,
        y: tableTop - 21 - partIndex * 11,
        size,
        font: fonts.bold,
        color: rgb(1, 1, 1),
      });
    });
    x += colW[index];
  });

  const bodyTop = tableTop - headerH;
  for (let i = 0; i <= visibleRows; i += 1) {
    const y = bodyTop - i * rowH;
    page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 0.7, color: LINE });
  }

  rowItems.forEach((item, index) => {
    const y = bodyTop - rowH * index - rowH + 11;
    const model = cleanProductName(item);
    const desc = productDescription(item);
    const qty = String(toNumber(item.quantity));
    const unit = money(toNumber(item.unit_price));
    const total = money(toNumber(item.total_price) || toNumber(item.quantity) * toNumber(item.unit_price));

    drawFitted(page, model, tableX + 9, y, colW[0] - 16, 9.3, fonts.regular, TEXT);
    drawFitted(page, desc, tableX + colW[0] + 9, y, colW[1] - 16, 9.3, fonts.regular, TEXT);
    drawCenteredInBox(page, qty, tableX + colW[0] + colW[1], y, colW[2], 9.6, fonts.regular);
    drawRight(page, unit, tableX + colW[0] + colW[1] + colW[2] + colW[3] - 10, y, 9.6, fonts.regular, TEXT);
    drawRight(page, total, tableX + tableW - 10, y, 9.6, fonts.regular, TEXT);
  });

  const summary = totals(items);
  const summaryX = tableX + colW[0] + colW[1] + colW[2];
  const summaryLabelW = colW[3];
  const summaryValueW = colW[4];
  const summaryTop = bodyTop - dataH;
  const totalLabels = [
    ['ARA TOPLAM', money(summary.subtotal)],
    ['TOPLAM(KDV)', money(summary.vat)],
    ['GENEL TOPLAM', money(summary.grandTotal)],
  ];

  totalLabels.forEach(([label, value], index) => {
    const yTop = summaryTop - summaryRowH * index;
    const y = yTop - 21;
    page.drawRectangle({ x: summaryX, y: yTop - summaryRowH, width: summaryLabelW, height: summaryRowH, color: rgb(0.91, 0.95, 0.98) });
    page.drawRectangle({ x: summaryX, y: yTop - summaryRowH, width: summaryLabelW + summaryValueW, height: summaryRowH, borderColor: LINE, borderWidth: 0.7 });
    page.drawLine({ start: { x: summaryX + summaryLabelW, y: yTop - summaryRowH }, end: { x: summaryX + summaryLabelW, y: yTop }, thickness: 0.7, color: LINE });
    page.drawText(label, { x: summaryX + 7, y, size: 8.8, font: index === 2 ? fonts.bold : fonts.regular, color: TEXT });
    drawRight(page, value, tableX + tableW - 10, y, 9.5, index === 2 ? fonts.bold : fonts.regular, TEXT);
  });

  // Sartlar referanstaki gibi alt bolumde sabitlenir.
  const termsY = 220;
  page.drawText('Şartlar ve Koşullar:', { x: 28, y: termsY, size: 13.2, font: fonts.bold, color: DARK_BLUE });
  const terms = [
    'Yukarıdaki fiyatlara KDV dahil değildir.',
    'Saha hizmetleri, projelere ve fiyatlamalara dahil değildir.',
    'Yukarıda yer alan ürünler dışında ilave bir istek olursa ayrıca değerlendirilecektir.',
    'Ödeme şeklimiz peşindir.',
    'Ürünler, üretici hatalarına karşı kullanıcı hataları, pil ve adaptör hariç 2 yıl garanti kapsamındadır.',
    'Sipariş tarihine göre temin süresi değişmektedir. Standart teslimat süremiz 12 haftadır. Sipariş onayı sonrası net teslim tarihi için lütfen bizlerden bilgi alınız.',
    'Teklifimiz 15 gün süre ile geçerlidir.',
  ];

  let y = termsY - 27;
  for (const term of terms) {
    const wrapped = chunkText(term, 88);
    wrapped.forEach((line, lineIndex) => {
      page.drawText(`${lineIndex === 0 ? '• ' : '  '}${line}`, { x: 28, y, size: 7.7, font: fonts.regular, color: TEXT });
      y -= 15;
    });
  }
}

async function addPricingPagesForProducts(args: {
  outputDoc: PDFDocument;
  templateDoc: PDFDocument;
  fonts: PdfFonts;
  customerName: string;
  items: QuoteItem[];
}) {
  const pricingTemplateIndex = Math.min(10, args.templateDoc.getPageCount() - 1);
  const groups = groupItemsByProduct(args.items);

  for (const group of groups) {
    const chunks: QuoteItem[][] = [];
    for (let i = 0; i < group.length; i += 8) chunks.push(group.slice(i, i + 8));
    const safeChunks = chunks.length ? chunks : [group];

    for (let index = 0; index < safeChunks.length; index += 1) {
      const page = await copyTemplatePage({ source: args.templateDoc, target: args.outputDoc, index: pricingTemplateIndex });
      drawQuoteSummaryPage(page, args.fonts, args.customerName, safeChunks[index], index + 1, safeChunks.length);
    }
  }
}

function drawCenteredInBox(page: PDFPage, text: string, x: number, y: number, width: number, size: number, font: PDFFont) {
  page.drawText(text, { x: x + (width - textWidth(font, text, size)) / 2, y, size, font, color: TEXT });
}

async function copyTemplatePage(args: { source: PDFDocument; target: PDFDocument; index: number }) {
  const [copied] = await args.target.copyPages(args.source, [args.index]);
  args.target.addPage(copied);
  return copied;
}

function safeFileName(value: string) {
  return safeText(value).replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_.-]+/g, '_') || 'teklif';
}

function getTemplatePath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', 'PAX_TURKIYE_EFT_POS_TEKLIF_SABLONU_clean_cover.pdf'),
    path.join(process.cwd(), 'public', 'templates', 'PAX_TURKIYE_EFT_POS_TEKLIF_SABLONU.pdf'),
    path.join(process.cwd(), 'public', 'templates', 'pax-teklif-template.pdf'),
  ];
  return candidates;
}

async function enrichQuoteItemsWithDbProductCodes(admin: ReturnType<typeof createPgAdminClient>, items: QuoteItem[]) {
  const productIds = Array.from(new Set(items.map((item) => safeText(item.product_id)).filter(Boolean)));
  if (!productIds.length) return items;

  try {
    const { data, error } = await admin
      .from('quote_products')
      .select('id,code,name,description,product_type,category,is_recurring,billing_period')
      .in('id', productIds);

    if (error || !data) return items;

    const productMap = new Map((data as any[]).map((product) => [safeText(product.id), product]));
    return items.map((item) => {
      const product = productMap.get(safeText(item.product_id));
      if (!product) return item;
      return {
        ...item,
        db_product_code: safeText(product.code),
        product_code_snapshot: safeText(product.code) || item.product_code_snapshot,
        product_name_snapshot: safeText(item.product_name_snapshot) || safeText(product.name),
        description_snapshot: safeText(item.description_snapshot) || safeText(product.description),
        product_type: safeText(item.product_type) || safeText(product.product_type),
        category: safeText(item.category) || safeText(product.category),
        is_recurring: typeof item.is_recurring === 'boolean' ? item.is_recurring : Boolean(product.is_recurring),
        billing_period: safeText(item.billing_period) || safeText(product.billing_period),
      } satisfies QuoteItem;
    });
  } catch {
    return items;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const me = await requireCrmAccessOrThrow();
    const { quoteId } = await params;

    const admin = createPgAdminClient();
    const quote = await getQuoteDetailById(admin, quoteId);

    if (!quote) {
      return NextResponse.json({ message: 'Teklif bulunamadı.' }, { status: 404 });
    }


    let templateBytes: Uint8Array | null = null;
    let lastTemplateError: unknown = null;
    for (const candidate of getTemplatePath()) {
      try {
        templateBytes = await fs.readFile(candidate);
        break;
      } catch (error) {
        lastTemplateError = error;
      }
    }

    if (!templateBytes) {
      console.error('PAX teklif template bulunamadi:', lastTemplateError);
      return NextResponse.json({ message: 'PAX teklif PDF şablonu bulunamadı.' }, { status: 500 });
    }

    const templateDoc = await PDFDocument.load(templateBytes);
    const outputDoc = await PDFDocument.create();
    const fonts = await loadFonts(outputDoc);

    const templatePages = templateDoc.getPageCount();
    if (templatePages < 5) {
      return NextResponse.json({ message: 'PAX teklif şablonu en az 5 sayfa olmalı.' }, { status: 500 });
    }

    const customerName = safeText((quote as any).customer?.musteri || 'Müşteri');
    const customerNameUpper = customerName.toLocaleUpperCase('tr-TR');
    const proposalDate = trDate((quote as any).proposal_date || (quote as any).created_at || (quote as any).updated_at);
    const quoteNo = safeText((quote as any).quote_no || quoteId);
    const rawItems = (((quote as any).items ?? []) as QuoteItem[]).filter((item) => toNumber(item.quantity) > 0);
    const enrichedItems = await enrichQuoteItemsWithDbProductCodes(admin, rawItems);
    const usableItems = enrichedItems.length ? enrichedItems : [{ product_code_snapshot: 'A80', product_name_snapshot: 'PAX A80', description_snapshot: 'Android EFT POS', quantity: 0, unit_price: 0, total_price: 0 }];

    // 1) Yeni teklif şablonunun ilk 3 kurumsal sayfası aynen korunur.
    const cover = await copyTemplatePage({ source: templateDoc, target: outputDoc, index: 0 });
    drawCover(cover, fonts, customerNameUpper, proposalDate);
    if (templatePages >= 3) {
      await copyTemplatePage({ source: templateDoc, target: outputDoc, index: 1 });
      await copyTemplatePage({ source: templateDoc, target: outputDoc, index: 2 });
    }

    // 2) Şablondaki 4. ürün sayfasının yerine her ürünün kendi ürün bilgi sayfası eklenir.
    // public/templates/product-pages klasöründe quote_products.code ile aynı isimde duran PDF/PNG/JPG sayfa aynen yerleştirilir.
    const hardwareItems = usableItems.filter((item) => !isRecurring(item));
    const productPages = hardwareItems.length ? hardwareItems : usableItems.slice(0, 1);
    const addedProductPageKeys = new Set<string>();
    for (const item of productPages) {
      const key = fileKey(productVisualCode(item) || findCatalogProduct(item)?.code || cleanProductName(item));
      if (addedProductPageKeys.has(key)) continue;
      addedProductPageKeys.add(key);
      await addProductVisualPage({
        outputDoc,
        templateDoc,
        templateProductPageIndex: Math.min(3, templatePages - 1),
        item,
      });
    }

    // 3) Yeni şablonun 5-10. sayfaları sabit bilgilendirme sayfalarıdır, birebir korunur.
    if (templatePages >= 12) {
      for (let pageIndex = 4; pageIndex <= 9; pageIndex += 1) {
        await copyTemplatePage({ source: templateDoc, target: outputDoc, index: pageIndex });
      }
    } else {
      for (let pageIndex = 2; pageIndex < Math.min(templatePages, 4); pageIndex += 1) {
        await copyTemplatePage({ source: templateDoc, target: outputDoc, index: pageIndex });
      }
    }

    // 4) Fiyatlandırma artık tek birleşik tablo değildir.
    // Her farklı ürün için yeni şablonun 11. sayfası formatında ayrı fiyat sayfası oluşturulur.
    await addPricingPagesForProducts({
      outputDoc,
      templateDoc,
      fonts,
      customerName: customerNameUpper,
      items: usableItems,
    });

    // 5) Yeni şablonun 12. kapanış sayfası en sona aynen eklenir.
    await copyTemplatePage({ source: templateDoc, target: outputDoc, index: templatePages >= 12 ? 11 : templatePages - 1 });

    const output = await outputDoc.save();

    return new NextResponse(Buffer.from(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFileName(quoteNo)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('quote pax pdf error:', error);
    const status = Number(error?.status || 500);
    return NextResponse.json(
      { message: error?.message || 'PDF oluşturulamadı.' },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
