import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { UserActivityPresentationPayload, UserActivityPresentationRow } from '@/lib/user-activity-presentation';

const PAGE = { width: 841.89, height: 595.28 };
const COLORS = {
  navy: rgb(0.035, 0.055, 0.18),
  red: rgb(0.82, 0.05, 0.1),
  blue: rgb(0.07, 0.55, 0.9),
  text: rgb(0.12, 0.15, 0.22),
  muted: rgb(0.42, 0.46, 0.54),
  line: rgb(0.87, 0.89, 0.93),
  soft: rgb(0.96, 0.97, 0.985),
  white: rgb(1, 1, 1),
  green: rgb(0.08, 0.55, 0.29),
  orange: rgb(0.92, 0.48, 0.08),
};

function drawBrand(page: PDFPage, bold: PDFFont, regular: PDFFont, x: number, y: number, dark = false) {
  page.drawCircle({ x: x + 10, y: y + 13, size: 10, color: COLORS.blue });
  page.drawCircle({ x: x + 15, y: y + 18, size: 7, color: COLORS.red, opacity: 0.88 });
  page.drawText('PAX', { x: x + 31, y: y + 10, size: 21, font: bold, color: dark ? COLORS.white : COLORS.navy });
  page.drawText('TÜRKİYE', { x: x + 32, y: y + 1, size: 6.5, font: regular, color: dark ? rgb(0.82, 0.85, 0.94) : COLORS.muted });
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const value = String(text ?? '');
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out.trim()}…`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 3) {
  const words = String(text ?? '-').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (!lines.length) lines.push('-');
  const consumed = lines.join(' ').length;
  if (consumed < String(text ?? '').trim().length) {
    lines[lines.length - 1] = fitText(lines[lines.length - 1], font, size, maxWidth - 2);
  }
  return lines.slice(0, maxLines);
}

function drawFooter(page: PDFPage, regular: PDFFont, pageNo: number, total: number) {
  page.drawLine({ start: { x: 28, y: 26 }, end: { x: PAGE.width - 28, y: 26 }, thickness: 0.6, color: COLORS.line });
  page.drawText('PAX Türkiye · Gizli / Yönetim Kullanımı', { x: 28, y: 12, size: 7.5, font: regular, color: COLORS.muted });
  const label = `Sayfa ${pageNo} / ${total}`;
  page.drawText(label, { x: PAGE.width - 28 - regular.widthOfTextAtSize(label, 7.5), y: 12, size: 7.5, font: regular, color: COLORS.muted });
}

function drawKpi(page: PDFPage, bold: PDFFont, regular: PDFFont, x: number, y: number, w: number, label: string, value: number) {
  page.drawRectangle({ x, y, width: w, height: 72, color: COLORS.white, borderColor: rgb(0.83, 0.86, 0.92), borderWidth: 0.7 });
  page.drawRectangle({ x, y: y + 68, width: w, height: 4, color: COLORS.red });
  page.drawText(value.toLocaleString('tr-TR'), { x: x + 14, y: y + 31, size: 23, font: bold, color: COLORS.navy });
  page.drawText(fitText(label, regular, 8.5, w - 28), { x: x + 14, y: y + 14, size: 8.5, font: regular, color: COLORS.muted });
}

function statusColor(value: string) {
  if (value === 'Tamamlandı' || value === 'Evet') return COLORS.green;
  if (value === 'Devam Ediyor') return COLORS.blue;
  if (value === 'İhtiyaç Duyulmadı') return COLORS.muted;
  return COLORS.orange;
}

function drawTableHeader(page: PDFPage, bold: PDFFont, x: number, y: number, widths: number[]) {
  const headers = ['No', 'Firma Adı', 'Sektör', 'Kasa Firması', 'Fiziki Ziyaret', 'Online Görüşme', 'POC', 'Entegrasyon Durumu'];
  let cursor = x;
  for (let index = 0; index < headers.length; index += 1) {
    page.drawRectangle({ x: cursor, y: y - 28, width: widths[index], height: 28, color: COLORS.navy, borderColor: COLORS.white, borderWidth: 0.35 });
    const lines = wrapText(headers[index], bold, 7.2, widths[index] - 8, 2);
    lines.forEach((line, lineIndex) => page.drawText(line, { x: cursor + 4, y: y - 11 - lineIndex * 8, size: 7.2, font: bold, color: COLORS.white }));
    cursor += widths[index];
  }
  return y - 28;
}

function drawTableRow(page: PDFPage, regular: PDFFont, bold: PDFFont, row: UserActivityPresentationRow, x: number, y: number, widths: number[], rowIndex: number) {
  const fontSize = 7.4;
  const lineHeight = 9;
  const values = [
    String(row.no),
    row.firma_adi,
    row.sektor,
    row.kasa_firmasi,
    String(row.fiziki_ziyaret_adedi),
    String(row.online_gorusme_adedi),
    row.poc_durumu,
    row.entegrasyon_durumu,
  ];
  const wrapped = values.map((value, index) => wrapText(value, index === 1 ? bold : regular, fontSize, widths[index] - 8, index === 7 ? 2 : 3));
  const lineCount = Math.max(...wrapped.map((lines) => lines.length));
  const height = Math.max(26, lineCount * lineHeight + 10);
  let cursor = x;
  for (let index = 0; index < values.length; index += 1) {
    page.drawRectangle({
      x: cursor,
      y: y - height,
      width: widths[index],
      height,
      color: rowIndex % 2 === 0 ? COLORS.white : COLORS.soft,
      borderColor: COLORS.line,
      borderWidth: 0.45,
    });
    const cellFont = index === 1 ? bold : regular;
    const centered = index === 0 || index === 4 || index === 5 || index === 6;
    wrapped[index].forEach((line, lineIndex) => {
      const textWidth = cellFont.widthOfTextAtSize(line, fontSize);
      const textX = centered ? cursor + Math.max(4, (widths[index] - textWidth) / 2) : cursor + 4;
      page.drawText(line, {
        x: textX,
        y: y - 13 - lineIndex * lineHeight,
        size: fontSize,
        font: cellFont,
        color: index === 6 || index === 7 ? statusColor(values[index]) : COLORS.text,
      });
    });
    cursor += widths[index];
  }
  return { y: y - height, height };
}

export async function generateUserActivityPresentationPdf(payload: UserActivityPresentationPayload) {
  if (!payload.rows.length) throw Object.assign(new Error('Seçilen kullanıcı ve tarih aralığı için aktivite bulunamadı.'), { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf')),
    fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf')),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  pdf.setTitle(`Kullanıcı Aktivite Sunumu - ${payload.filters.user_name}`);
  pdf.setAuthor('PAX Türkiye CRM');
  pdf.setSubject('Yönetim Kullanımı');
  pdf.setCreator('PAX CRM');

  const cover = pdf.addPage([PAGE.width, PAGE.height]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.soft });
  cover.drawRectangle({ x: 0, y: PAGE.height - 180, width: PAGE.width, height: 180, color: COLORS.navy });
  cover.drawRectangle({ x: 0, y: PAGE.height - 186, width: PAGE.width, height: 6, color: COLORS.red });
  drawBrand(cover, bold, regular, 42, PAGE.height - 73, true);
  cover.drawText('KULLANICI AKTİVİTE SUNUMU', { x: 42, y: PAGE.height - 121, size: 25, font: bold, color: COLORS.white });
  cover.drawText('Firma temasları, POC ve entegrasyon görünümü', { x: 42, y: PAGE.height - 145, size: 11, font: regular, color: rgb(0.78, 0.82, 0.92) });
  cover.drawText('GİZLİ · YÖNETİM KULLANIMI', { x: PAGE.width - 213, y: PAGE.height - 62, size: 8, font: bold, color: rgb(1, 0.56, 0.58) });

  cover.drawText(payload.filters.user_name, { x: 42, y: 361, size: 20, font: bold, color: COLORS.navy });
  cover.drawText(payload.filters.user_email || 'Geçmiş kullanıcı kaydı', { x: 42, y: 342, size: 9.5, font: regular, color: COLORS.muted });
  cover.drawText(payload.filters.date_range_label, { x: 42, y: 315, size: 12, font: bold, color: COLORS.red });
  cover.drawText('Mevcut CRM geçmiş kayıtları dahil edilmiştir.', { x: 42, y: 296, size: 8.5, font: regular, color: COLORS.muted });

  const kpis = [
    ['Toplam Aktivite', payload.summary.totalActivities],
    ['Temas Edilen Firma', payload.summary.distinctCustomers],
    ['Fiziki Ziyaret', payload.summary.physicalVisits],
    ['Online Görüşme', payload.summary.onlineMeetings],
    ['POC Yapılan Firma', payload.summary.pocCustomers],
    ['Tamamlanan Entegrasyon', payload.summary.completedIntegrations],
  ] as const;
  const gap = 12;
  const cardWidth = (PAGE.width - 84 - gap * 2) / 3;
  kpis.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    drawKpi(cover, bold, regular, 42 + col * (cardWidth + gap), 204 - row * 88, cardWidth, label, value);
  });
  if (payload.data_quality.warning) {
    cover.drawText(fitText(payload.data_quality.warning, regular, 7.2, PAGE.width - 84), { x: 42, y: 58, size: 7.2, font: regular, color: COLORS.orange });
  }
  cover.drawText(`Rapor oluşturma: ${new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'long', timeStyle: 'short' }).format(new Date(payload.generated_at))}`, {
    x: 42, y: 43, size: 8, font: regular, color: COLORS.muted,
  });

  const widths = [30, 170, 100, 115, 75, 75, 70, 150];
  let page: PDFPage | null = null;
  let y = 0;
  let rowIndex = 0;
  const startNewTablePage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.white });
    drawBrand(page, bold, regular, 28, PAGE.height - 55, false);
    page.drawText('Kullanıcı Aktivite Sunumu', { x: 190, y: PAGE.height - 37, size: 14, font: bold, color: COLORS.navy });
    page.drawText(`${payload.filters.user_name} · ${payload.filters.date_range_label}`, { x: 190, y: PAGE.height - 53, size: 8.5, font: regular, color: COLORS.muted });
    page.drawRectangle({ x: 28, y: PAGE.height - 78, width: 785, height: 3, color: COLORS.red });
    y = drawTableHeader(page, bold, 28, PAGE.height - 95, widths);
  };

  startNewTablePage();
  for (const row of payload.rows) {
    const predictedLines = Math.max(
      wrapText(row.firma_adi, bold, 7.4, widths[1] - 8, 3).length,
      wrapText(row.sektor, regular, 7.4, widths[2] - 8, 3).length,
      wrapText(row.kasa_firmasi, regular, 7.4, widths[3] - 8, 3).length,
      wrapText(row.entegrasyon_durumu, regular, 7.4, widths[7] - 8, 2).length,
    );
    const predictedHeight = Math.max(26, predictedLines * 9 + 10);
    if (y - predictedHeight < 42) startNewTablePage();
    const result = drawTableRow(page!, regular, bold, row, 28, y, widths, rowIndex);
    y = result.y;
    rowIndex += 1;
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => drawFooter(pdfPage, regular, index + 1, pages.length));
  const bytes = await pdf.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
