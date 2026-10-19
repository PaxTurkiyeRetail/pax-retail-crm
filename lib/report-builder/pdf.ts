// ANTETLİ PDF — sayfa tanımı + widget sonuçları → A4 PDF (pdf-lib + fontkit; yeni paket yok).
//  * Antet: PNG/JPG her sayfaya tam sayfa arka plan; tek sayfalık PDF ise vektör olarak gömülür.
//  * İçerik: kenar boşlukları + antet güvenli alanı (mm) içinde akar; widget'lar (y,x) sırasında,
//    tam genişlikte. "PDF'te gizle" atlanır, "yeni sayfada başlat" sayfa kırar.
//  * Tablolar sayfa kırılımında başlık satırını tekrarlar. Bar/line/pie vektör çizilir.
//  * Türkçe gömülü font (DejaVuSans; yoksa sistem Arial). Saf modül: DB bilmez.
import { dataBarExtent } from './visual-format';
import fs from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import {
  isDataWidget, type ColorToken, type DataWidget, type LetterheadSettings, type PageDefinition, type PageWidget,
} from '@/lib/report-builder/page-types';
import { formatCell, pivot, resolvePivotColumn, matchConditionalRule as matchRule, resolveConditionalRule, PREV_SUFFIX, type ReportResult, type ResultRow } from '@/lib/report-builder/result';
import type { ColumnMeta } from '@/lib/report-builder/types';

export const MM = 72 / 25.4;
const A4 = { w: 595.28, h: 841.89 };

export const TOKEN_RGB: Record<ColorToken, RGB> = {
  primary: rgb(0.15, 0.39, 0.92),
  success: rgb(0.09, 0.64, 0.29),
  warning: rgb(0.92, 0.7, 0.03),
  danger: rgb(0.86, 0.15, 0.15),
  info: rgb(0.03, 0.57, 0.7),
  neutral: rgb(0.42, 0.45, 0.5),
  accent: rgb(0.49, 0.23, 0.93),
};
const TEXT = rgb(0.12, 0.13, 0.15);
const MUTED = rgb(0.45, 0.47, 0.5);
const LINE = rgb(0.85, 0.86, 0.88);
const HEAD_BG = rgb(0.95, 0.96, 0.97);
const tint = (c: RGB, a: number) => rgb(1 - (1 - c.red) * a, 1 - (1 - c.green) * a, 1 - (1 - c.blue) * a);

export type WidgetData = { result?: ReportResult; forecast?: ReportResult; error?: string };
export type LetterheadAsset = { settings: LetterheadSettings; bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' | 'application/pdf'; lockOrientation?: boolean };
export type PdfFonts = { regular: Uint8Array; bold: Uint8Array };

export type RenderPdfInput = {
  page: PageDefinition;
  data: Record<string, WidgetData>;
  letterhead?: LetterheadAsset | null;
  fonts: PdfFonts;
  /** Europe/Istanbul tarih (YYYY-MM-DD) — başlık ve dosya adı. */
  date: string;
  /** Antet yoksa varsayılan yön; sayfa tanımındaki pdf.orientation önceliklidir. */
  orientation?: 'portrait' | 'landscape';
};

const FONT_CANDIDATES: Array<[string, string]> = [
  [path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'), path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf')],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
  ['C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'],
];

/** Türkçe karakterli gömülü font; mevcut sunum PDF'iyle aynı kaynak (public/fonts). */
export async function loadPdfFonts(): Promise<PdfFonts> {
  for (const [r, b] of FONT_CANDIDATES) {
    try {
      const [regular, bold] = await Promise.all([fs.readFile(r), fs.readFile(b)]);
      return { regular, bold };
    } catch { /* sıradaki aday */ }
  }
  throw Object.assign(new Error('PDF fontu bulunamadı (public/fonts/DejaVuSans.ttf)'), { status: 500 });
}

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
/** rapor-adi_2026-10-19.pdf */
export function pdfFileName(title: string, date: string): string {
  const slug = title.replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c]).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'rapor';
  return `${slug}_${date}.pdf`;
}

export { matchRule as matchConditionalRule };

type Ctx = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  size: { w: number; h: number };
  box: { left: number; right: number; top: number; bottom: number };
  page: PDFPage;
  y: number;
  pages: PDFPage[];
  decorate: (p: PDFPage) => void;
  accent: RGB;
  fontSize?: number;
  wordWrap?: boolean;
};

function fit(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

export function wrapPdfText(font: Pick<PDFFont,'widthOfTextAtSize'>, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else {
        if (line) out.push(line);
        line='';
        for(const character of word) {
          if(line && font.widthOfTextAtSize(line+character,size)>maxW) {out.push(line);line='';}
          line+=character;
        }
      }
    }
    out.push(line);
  }
  return out;
}
const wrap=wrapPdfText;
export function pdfColumnWidths(total:number,weights:(number|undefined)[]) {
  const n=weights.length;
  if(!n)return [];
  const defaults=weights.map((v,i)=>v&&v>0?v:i===0&&n>1?2:1);
  const sum=defaults.reduce((a,b)=>a+b,0);
  return defaults.map(v=>total*v/sum);
}

function newPage(c: Ctx) {
  c.page = c.doc.addPage([c.size.w, c.size.h]);
  c.pages.push(c.page);
  c.decorate(c.page);
  c.y = c.box.top;
}
const ensure = (c: Ctx, need: number) => {
  if (c.y - need < c.box.bottom && c.y < c.box.top) newPage(c);
};
const width = (c: Ctx) => c.box.right - c.box.left;

function drawTitle(c: Ctx, w: PageWidget) {
  if (!w.title || w.style.showTitle === false) return;
  ensure(c, 30);
  c.page.drawText(fit(c.bold, w.title, 11, width(c)), { x: c.box.left, y: c.y - 11, size: 11, font: c.bold, color: TEXT });
  c.y -= 18;
}

function visibleColumns(w: DataWidget, result: ReportResult): Array<ColumnMeta & { label: string }> {
  const settings = new Map(w.style.columns.map((s) => [s.key, s]));
  return result.columns.filter((col) => !settings.get(col.key)?.hidden).map((col) => {
    const s = settings.get(col.key);
    const fmt = s?.format && s.format !== 'compact' ? s.format : col.format;
    return { ...col, label: s?.label || col.label, format: fmt };
  });
}

function drawTable(c: Ctx, headers: string[], rows: string[][], opts: { numeric: boolean[]; widths?:(number|undefined)[]; align?:('left'|'center'|'right'|undefined)[]; wordWrap?:(boolean|undefined)[]; fill?: (r: number, col: number) => RGB | null; colorText?: (r: number, col: number) => RGB | null; bar?: (r:number,col:number)=>{start:number;width:number;color:RGB}|null; density: string }) {
  const fs = c.fontSize ?? (opts.density === 'compact' ? 7 : opts.density === 'comfortable' ? 9 : 8);
  const lineH=fs*1.25;
  const pad=opts.density==='compact'?3:4;
  const W = width(c);
  if(!headers.length)return;
  const widths=pdfColumnWidths(W,headers.map((_,i)=>opts.widths?.[i]));
  if(widths.some(w=>w<fs+6)) {
    const capacity=Math.max(2,Math.floor(W/(fs+12)));
    if(headers.length>capacity) {
      const firstNumeric=opts.numeric.findIndex(Boolean);
      const leading=Math.max(0,Math.min(firstNumeric<0?1:firstNumeric,Math.floor(capacity/2)));
      const chunkSize=capacity-leading;
      for(let start=leading;start<headers.length;start+=chunkSize){
        const indices=[...Array.from({length:leading},(_,i)=>i),...Array.from({length:Math.min(chunkSize,headers.length-start)},(_,i)=>start+i)];
        if(start>leading)newPage(c);
        note(c,`Geniş tablo · sütunlar ${start+1}–${Math.min(headers.length,start+chunkSize)} / ${headers.length}`);
        drawTable(c,indices.map(i=>headers[i]),rows.map(row=>indices.map(i=>row[i])),{...opts,numeric:indices.map(i=>opts.numeric[i]),widths:indices.map(i=>opts.widths?.[i]),align:indices.map(i=>opts.align?.[i]),wordWrap:indices.map(i=>opts.wordWrap?.[i]),fill:opts.fill?(r,i)=>opts.fill!(r,indices[i]):undefined,colorText:opts.colorText?(r,i)=>opts.colorText!(r,indices[i]):undefined,bar:opts.bar?(r,i)=>opts.bar!(r,indices[i]):undefined});
      }
      return;
    }
    throw new Error('PDF sütunu metin için çok dar; genişliği artırın veya sütunu gizleyin');
  }
  const colX = (i: number) => c.box.left+widths.slice(0,i).reduce((a,b)=>a+b,0);
  const colW = (i: number) => widths[i];
  const lines=(text:string,i:number,font:PDFFont)=> (opts.wordWrap?.[i]??c.wordWrap??true)?wrap(font,text,fs,Math.max(1,colW(i)-6)):[fit(font,text,fs,Math.max(1,colW(i)-6))];
  const heads=headers.map((h,i)=>wrap(c.bold,h,fs,Math.max(1,colW(i)-6)));
  const headerH=Math.max(...heads.map(h=>h.length))*lineH+pad*2;
  const drawLine=(text:string,i:number,y:number,font:PDFFont,color:RGB)=>{
    const align=opts.align?.[i]??(opts.numeric[i]?'right':'left');
    const tw=font.widthOfTextAtSize(text,fs);
    const x=align==='right'?colX(i)+colW(i)-3-tw:align==='center'?colX(i)+(colW(i)-tw)/2:colX(i)+3;
    c.page.drawText(text,{x,y,size:fs,font,color});
  };
  const header = () => {
    c.page.drawRectangle({ x: c.box.left, y: c.y-headerH, width:W,height:headerH,color:HEAD_BG });
    heads.forEach((cells,i)=>cells.forEach((t,j)=>drawLine(t,i,c.y-pad-fs-j*lineH,c.bold,TEXT)));
    c.y-=headerH;
  };
  if(headerH+lineH+pad*2>c.box.top-c.box.bottom)throw new Error('PDF sütunları çok dar; sütun sayısını azaltın veya yatay yön seçin');
  ensure(c, headerH+lineH+pad*2);
  header();
  rows.forEach((row, r) => {
    const fonts=row.map((_,i)=>i===0&&r===rows.length-1&&row[0]==='Toplam'?c.bold:c.regular);
    const cells=row.map((text,i)=>lines(text,i,fonts[i]));
    const maxLines=Math.max(1,...cells.map(v=>v.length));
    let offset=0;
    while(offset<maxLines) {
      const fullHeight=(maxLines-offset)*lineH+pad*2;
      if(c.y-fullHeight<c.box.bottom && c.y<c.box.top-headerH-0.01) {newPage(c);header();}
      const capacity=Math.max(1,Math.floor((c.y-c.box.bottom-pad*2)/lineH));
      const count=Math.min(maxLines-offset,capacity);
      const rowH=count*lineH+pad*2;
      cells.forEach((cell,i)=>{
        const bg=opts.fill?.(r,i);
        if(bg)c.page.drawRectangle({x:colX(i),y:c.y-rowH,width:colW(i),height:rowH,color:bg});
        const bar=opts.bar?.(r,i);if(bar&&bar.width>0)c.page.drawRectangle({x:colX(i)+colW(i)*bar.start,y:c.y-rowH+1,width:colW(i)*bar.width,height:Math.max(1,rowH-2),color:tint(bar.color,.18)});
        cell.slice(offset,offset+count).forEach((text,j)=>drawLine(text,i,c.y-pad-fs-j*lineH,fonts[i],opts.colorText?.(r,i)??TEXT));
      });
      c.page.drawLine({start:{x:c.box.left,y:c.y-rowH},end:{x:c.box.right,y:c.y-rowH},thickness:0.4,color:LINE});
      c.y-=rowH;offset+=count;
      if(offset<maxLines){newPage(c);header();}
    }
  });
  c.y -= 10;
}

function renderFlatTable(c: Ctx, w: DataWidget, result: ReportResult) {
  const cols = visibleColumns(w, result);
  const rows = result.rows.map((r) => cols.map((col) => {const rule=resolveConditionalRule(w.style.conditional,col,r[col.key],result.columns,r);return formatCell(col,r[col.key])+(rule?.label?' · '+rule.label:'');}));
  drawTable(c, cols.map((col) => col.label), rows, {
    numeric: cols.map((col) => col.type === 'number'),
    density: w.style.density,
    widths:cols.map(col=>w.style.columns.find(s=>s.key===col.key)?.width),
    align:cols.map(col=>w.style.columns.find(s=>s.key===col.key)?.align),
    wordWrap:cols.map(col=>w.style.columns.find(s=>s.key===col.key)?.wordWrap),
    bar:(r,i)=>{const col=cols[i];if(!w.style.columns.find(setting=>setting.key===col.key)?.dataBar)return null;const extent=dataBarExtent(result.rows.map(row=>row[col.key]),result.rows[r][col.key]);return extent?{...extent,color:TOKEN_RGB[w.style.accent??'primary']}:null;},
    fill:(r,i)=>{const tok=matchRule(w.style.conditional,cols[i],result.rows[r][cols[i].key],result.columns,result.rows[r]);return tok?tint(TOKEN_RGB[tok],.12):null;},
    colorText: (r, i) => {
      const tok = matchRule(w.style.conditional, cols[i], result.rows[r][cols[i].key], result.columns,result.rows[r]);
      return tok ? TOKEN_RGB[tok] : null;
    },
  });
  if (result.truncated) note(c, `Sonuç satır limitiyle kesildi (${result.rows.length}).`);
}

function renderPivot(c: Ctx, w: DataWidget, result: ReportResult, forecast?: ReportResult) {
  const pivotKey = resolvePivotColumn(result.columns, w.query.visualization.pivotColumn)?.key;
  const measure = result.columns.find((col) => col.role !== 'dimension');
  const pt = pivotKey && measure ? pivot(result.columns, result.rows, pivotKey, measure.key) : null;
  if (!pt) return renderFlatTable(c, w, result);
  const pivotCol = result.columns.find((col) => col.key === pivotKey)!;
  // Heatmap: tahmin (forecast) aynı satır/sütun anahtarlarıyla eşlenir; gerçekleşen yoksa sarı gösterilir.
  let fc: Map<string, number> | null = null;
  if (w.type === 'heatmap' && forecast) {
    const fPivot = forecast.columns.find((col) => col.role === 'dimension' && col.type === 'date')?.key;
    const fMeasure = forecast.columns.find((col) => col.role !== 'dimension');
    const fp = fPivot && fMeasure ? pivot(forecast.columns, forecast.rows, fPivot, fMeasure.key) : null;
    if (fp) {
      fc = new Map();
      fp.rows.forEach((row) => row.cells.forEach((v, i) => { if (v !== null) fc!.set(`${row.key.join('|')}::${fp.columnValues[i]}`, v); }));
    }
  }
  const heads = [...pt.rowDims.map((d) => d.label), ...pt.columnValues.map((v) => formatCell(pivotCol, v)), 'Toplam'];
  const kind: Array<Array<'actual' | 'forecast' | null>> = [];
  const cellRule=(ri:number,ci:number)=>{const pr=pt.rows[ri];if(!pr||ci<0||ci>=pt.columnValues.length)return null;const candidates=result.rows.filter(row=>String(row[pivotCol.key]??'—')===pt.columnValues[ci]&&pt.rowDims.every((d,j)=>String(row[d.key]??'—')===pr.key[j]));return resolveConditionalRule(w.style.conditional,measure!,pr.cells[ci],result.columns,candidates.length===1?candidates[0]:undefined);};
  const rows = pt.rows.map((row,ri) => {
    const k: Array<'actual' | 'forecast' | null> = row.key.map(() => null);
    const cells = row.cells.map((v, i) => {
      if (v !== null) { k.push('actual'); const rule=cellRule(ri,i);return formatCell(measure!,v)+(rule?.label?' · '+rule.label:''); }
      const f = fc?.get(`${row.key.join('|')}::${pt.columnValues[i]}`);
      if (f !== undefined) { k.push('forecast'); return formatCell(measure!, f); }
      k.push(null);
      return '';
    });
    k.push(null);
    kind.push(k);
    return [...row.key.map((v, i) => formatCell(pt.rowDims[i], v)), ...cells, formatCell(measure!, row.total)];
  });
  const totalRow = ['Toplam', ...pt.rowDims.slice(1).map(() => ''), ...pt.columnTotals.map((v) => formatCell(measure!, v)), formatCell(measure!, pt.grandTotal)];
  rows.push(totalRow);
  kind.push(totalRow.map(() => null));
  const dimN = pt.rowDims.length;
  drawTable(c, heads, rows, {
    numeric: heads.map((_, i) => i >= dimN),
    density: w.style.density,
    widths:heads.map((_,i)=>w.style.columns.find(s=>s.key===(i<dimN?pt.rowDims[i].key:measure!.key))?.width),
    align:heads.map((_,i)=>w.style.columns.find(s=>s.key===(i<dimN?pt.rowDims[i].key:measure!.key))?.align),
    wordWrap:heads.map((_,i)=>w.style.columns.find(s=>s.key===(i<dimN?pt.rowDims[i].key:measure!.key))?.wordWrap),
    colorText:(r,i)=>{const rule=kind[r]?.[i]==='actual'?cellRule(r,i-dimN):null;return rule?TOKEN_RGB[rule.color]:null;},
    fill:(r,i)=>{const rule=kind[r]?.[i]==='actual'?cellRule(r,i-dimN):null;if(rule)return tint(TOKEN_RGB[rule.color],.12);return w.type==='heatmap'?(kind[r]?.[i]==='actual'?tint(TOKEN_RGB.success,.22):kind[r]?.[i]==='forecast'?tint(TOKEN_RGB.warning,.3):null):null;} ,
  });
  if (w.type === 'heatmap') note(c, fc ? 'Yeşil: gerçekleşen · Sarı: tahmin' : 'Yeşil: gerçekleşen');
}

function note(c: Ctx, text: string) {
  ensure(c, 12);
  c.page.drawText(fit(c.regular, text, 7, width(c)), { x: c.box.left, y: c.y - 7, size: 7, font: c.regular, color: MUTED });
  c.y -= 14;
}

function renderKpi(c: Ctx, w: DataWidget, result: ReportResult) {
  const row: ResultRow = result.rows[0] ?? {};
  const cols = visibleColumns(w, result).filter((col) => col.role !== 'dimension');
  const n = Math.max(1, cols.length);
  const gap = 8;
  const bw = (width(c) - gap * (n - 1)) / n;
  const h = 46;
  ensure(c, h + 6);
  const accent = w.style.accent ? TOKEN_RGB[w.style.accent] : c.accent;
  cols.forEach((col, i) => {
    const x = c.box.left + i * (bw + gap);
    c.page.drawRectangle({ x, y: c.y - h, width: bw, height: h, borderColor: LINE, borderWidth: 0.6, color: rgb(1, 1, 1) });
    c.page.drawRectangle({ x, y: c.y - h, width: 2.5, height: h, color: accent });
    c.page.drawText(fit(c.regular, col.label, 7.5, bw - 12), { x: x + 8, y: c.y - 13, size: 7.5, font: c.regular, color: MUTED });
    const tok = matchRule(w.style.conditional, col, row[col.key], result.columns,row);
    const label=resolveConditionalRule(w.style.conditional,col,row[col.key],result.columns,row)?.label;if(label)c.page.drawText(fit(c.regular,label,6.5,bw-12),{x:x+8,y:c.y-42,size:6.5,font:c.regular,color:TEXT});
    c.page.drawText(fit(c.bold, formatCell(col, row[col.key]), 15, bw - 12), { x: x + 8, y: c.y - 32, size: 15, font: c.bold, color: tok ? TOKEN_RGB[tok] : TEXT });
    const prev = row[col.key + PREV_SUFFIX];
    const cur = row[col.key];
    if (typeof prev === 'number' && typeof cur === 'number') {
      const pct = prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
      const label = pct === null ? `önceki: ${formatCell(col, prev)}` : `${pct >= 0 ? '▲' : '▼'} %${Math.abs(pct).toFixed(1)} · önceki ${formatCell(col, prev)}`;
      c.page.drawText(fit(c.regular, label, 6.5, bw - 12), { x: x + 8, y: c.y - 42, size: 6.5, font: c.regular, color: pct === null ? MUTED : pct >= 0 ? TOKEN_RGB.success : TOKEN_RGB.danger });
    }
  });
  c.y -= h + 12;
}

function chartSeries(result: ReportResult) {
  const dim = result.columns.find((col) => col.role === 'dimension');
  const measure = result.columns.find((col) => col.role !== 'dimension');
  if (!measure) return null;
  const points = result.rows.slice(0, 60).map((r) => ({ label: dim ? formatCell(dim, r[dim.key]) : measure.label, value: Number(r[measure.key] ?? 0) || 0 }));
  return { measure, points };
}

function renderBarLine(c: Ctx, w: DataWidget, result: ReportResult) {
  const s = chartSeries(result);
  if (!s || !s.points.length) return note(c, 'Veri yok');
  const H = 170;
  ensure(c, H + 10);
  const left = c.box.left + 40;
  const W = c.box.right - left;
  const top = c.y;
  const base = c.y - H + 22;
  const plotH = H - 30;
  const max = Math.max(...s.points.map((p) => p.value), 0) || 1;
  const min = Math.min(...s.points.map((p) => p.value), 0);
  const span = max - min || 1;
  const yOf = (v: number) => base + ((v - min) / span) * plotH;
  for (let i = 0; i <= 4; i++) {
    const v = min + (span * i) / 4;
    const y = yOf(v);
    c.page.drawLine({ start: { x: left, y }, end: { x: c.box.right, y }, thickness: 0.3, color: LINE });
    const t = formatCell(s.measure, Math.round(v));
    c.page.drawText(fit(c.regular, t, 6, 36), { x: c.box.left, y: y - 2, size: 6, font: c.regular, color: MUTED });
  }
  const color = w.style.accent ? TOKEN_RGB[w.style.accent] : c.accent;
  const step = W / s.points.length;
  const labelEvery = Math.max(1, Math.ceil(s.points.length / 14));
  s.points.forEach((p, i) => {
    const cx = left + step * i + step / 2;
    if (w.type === 'bar') {
      const bw = Math.max(2, step * 0.62);
      const y0 = yOf(Math.max(0, min));
      c.page.drawRectangle({ x: cx - bw / 2, y: Math.min(y0, yOf(p.value)), width: bw, height: Math.abs(yOf(p.value) - y0), color });
    } else if (i > 0) {
      const prev = s.points[i - 1];
      c.page.drawLine({ start: { x: cx - step, y: yOf(prev.value) }, end: { x: cx, y: yOf(p.value) }, thickness: 1.4, color });
    }
    if (w.type === 'line') c.page.drawCircle({ x: cx, y: yOf(p.value), size: 1.8, color });
    if (i % labelEvery === 0) {
      const t = fit(c.regular, p.label, 6, step * labelEvery - 2);
      c.page.drawText(t, { x: cx - c.regular.widthOfTextAtSize(t, 6) / 2, y: base - 12, size: 6, font: c.regular, color: MUTED });
    }
  });
  c.y = top - H - 6;
}

const PIE_TOKENS: ColorToken[] = ['primary', 'success', 'warning', 'danger', 'info', 'accent', 'neutral'];

function renderPie(c: Ctx, w: DataWidget, result: ReportResult) {
  const s = chartSeries(result);
  if (!s) return note(c, 'Veri yok');
  const pts = s.points.filter((p) => p.value > 0).slice(0, 12);
  const total = pts.reduce((a, p) => a + p.value, 0);
  if (!total) return note(c, 'Veri yok');
  const H = 150;
  ensure(c, H + 10);
  const r = 60;
  const cx = c.box.left + r + 10;
  const cy = c.y - H / 2;
  let a0 = -Math.PI / 2;
  pts.forEach((p, i) => {
    const a1 = a0 + (p.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    // drawSvgPath'te y ekseni aşağı doğru: sin işareti ters.
    const x0 = r * Math.cos(a0); const y0 = r * Math.sin(a0);
    const x1 = r * Math.cos(a1); const y1 = r * Math.sin(a1);
    const d = pts.length === 1
      ? `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`
      : `M 0 0 L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    c.page.drawSvgPath(d, { x: cx, y: cy, color: TOKEN_RGB[PIE_TOKENS[i % PIE_TOKENS.length]], borderColor: rgb(1, 1, 1), borderWidth: 0.8 });
    a0 = a1;
  });
  const lx = cx + r + 24;
  pts.forEach((p, i) => {
    const y = c.y - 14 - i * 11;
    c.page.drawRectangle({ x: lx, y: y - 1, width: 7, height: 7, color: TOKEN_RGB[PIE_TOKENS[i % PIE_TOKENS.length]] });
    const t = `${p.label} — ${formatCell(s.measure, p.value)} (%${((p.value / total) * 100).toFixed(1)})`;
    c.page.drawText(fit(c.regular, t, 7, c.box.right - lx - 12), { x: lx + 11, y, size: 7, font: c.regular, color: TEXT });
  });
  c.y -= H + 6;
}

function renderText(c: Ctx, w: Extract<PageWidget, { type: 'text' }>) {
  const size = w.variant === 'heading' ? 14 : w.variant === 'note' ? 7.5 : 9;
  const font = w.variant === 'heading' ? c.bold : c.regular;
  const lines = wrap(font, w.text || w.title, size, width(c));
  for (const line of lines) {
    ensure(c, size + 4);
    c.page.drawText(line, { x: c.box.left, y: c.y - size, size, font, color: w.variant === 'note' ? MUTED : TEXT });
    c.y -= size + 4;
  }
  c.y -= 6;
}

/** Widget'ları PDF akış sırasına dizer: (y, x); sekmeler PDF'te sırayla açılır. */
export function pdfWidgetOrder(page: PageDefinition): PageWidget[] {
  return [...page.widgets]
    .filter((w) => !w.pdf.hideInPdf && w.type !== 'filter' && w.type !== 'tabs')
    .sort((a, b) => a.layout.lg.y - b.layout.lg.y || a.layout.lg.x - b.layout.lg.x);
}

export async function renderPagePdf(input: RenderPdfInput): Promise<Uint8Array> {
  const lh = input.letterhead?.settings;
  const orientation = input.letterhead?.lockOrientation ? lh?.orientation ?? 'portrait' : input.page.pdf.orientation ?? lh?.orientation ?? input.orientation ?? 'portrait';
  const size = orientation === 'landscape' ? { w: A4.h, h: A4.w } : { ...A4 };
  const requested=input.page.pdf.marginsMm;
  const baseMargins=lh?.margins ?? {top:15,right:15,bottom:15,left:15};
  const margins=requested?(lh?{top:Math.max(baseMargins.top,requested.top),right:Math.max(baseMargins.right,requested.right),bottom:Math.max(baseMargins.bottom,requested.bottom),left:Math.max(baseMargins.left,requested.left)}:requested):baseMargins;
  const safe = lh?.safeArea ?? { top: 0, bottom: 0 };
  const showTitle = lh?.showTitle ?? true;
  const showDate = lh?.showDate ?? true;
  const showPageNumbers = lh?.showPageNumbers ?? true;
  const footerText = lh?.footerText ?? '';

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(input.page.title);
  doc.setCreator('CRM Rapor Aracı');
  doc.setProducer('pdf-lib');
  const regular = await doc.embedFont(input.fonts.regular, { subset: true });
  const bold = await doc.embedFont(input.fonts.bold, { subset: true });

  let decorate: (p: PDFPage) => void = () => {};
  if (input.letterhead) {
    const { bytes, mimeType } = input.letterhead;
    if (mimeType === 'application/pdf') {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
      if (src.getPageCount() < 1) throw Object.assign(new Error('Antet PDF boş'), { status: 400 });
      const [embedded] = await doc.embedPdf(src, [0]);
      decorate = (p) => p.drawPage(embedded, { x: 0, y: 0, width: size.w, height: size.h });
    } else {
      const img = mimeType === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      decorate = (p) => p.drawImage(img, { x: 0, y: 0, width: size.w, height: size.h });
    }
  }

  const box = {
    left: margins.left * MM,
    right: size.w - margins.right * MM,
    top: size.h - (margins.top + safe.top) * MM,
    bottom: (margins.bottom + safe.bottom) * MM + (showPageNumbers || footerText ? 14 : 0),
  };
  if (box.top - box.bottom < 120 || box.right - box.left < 200) throw Object.assign(new Error('Antet kenar boşlukları içerik için çok büyük'), { status: 400 });

  const c: Ctx = {
    doc, regular, bold, size, box, page: undefined as unknown as PDFPage, y: box.top, pages: [], decorate,
    accent: TOKEN_RGB[input.page.theme.accent],
    fontSize:input.page.pdf.fontSize,
    wordWrap:input.page.pdf.wordWrap,
  };
  newPage(c);

  if (showTitle) {
    c.page.drawText(fit(bold, input.page.title, 16, width(c)), { x: box.left, y: c.y - 16, size: 16, font: bold, color: TEXT });
    c.y -= 22;
    const sub = [input.page.subtitle, showDate ? input.date.split('-').reverse().join('.') : null].filter(Boolean).join(' · ');
    if (sub) { c.page.drawText(fit(regular, sub, 8, width(c)), { x: box.left, y: c.y - 8, size: 8, font: regular, color: MUTED }); c.y -= 14; }
    c.page.drawLine({ start: { x: box.left, y: c.y }, end: { x: box.right, y: c.y }, thickness: 1, color: c.accent });
    c.y -= 12;
  }

  for (const w of pdfWidgetOrder(input.page)) {
    if (w.pdf.pageBreakBefore && c.y < box.top) newPage(c);
    if (w.type === 'text') { if(!(showTitle&&input.page.pdf.hideRepeatedTitle!==false&&w.variant==='heading'&&w.text.trim()===input.page.title.trim()))renderText(c, w); continue; }
    if (!isDataWidget(w)) continue;
    if(!(showTitle && input.page.pdf.hideRepeatedTitle!==false && w.title.trim()===input.page.title.trim()))drawTitle(c, w);
    const d = input.data[w.id];
    if (!d || d.error || !d.result) { note(c, d?.error ? `Hata: ${d.error}` : 'Veri yok'); continue; }
    switch (w.type) {
      case 'kpi': case 'kpi_strip': renderKpi(c, w, d.result); break;
      case 'bar': case 'line': renderBarLine(c, w, d.result); break;
      case 'pie': renderPie(c, w, d.result); break;
      case 'pivot': case 'heatmap': renderPivot(c, w, d.result, d.forecast); break;
      default: renderFlatTable(c, w, d.result);
    }
  }

  const total = c.pages.length;
  c.pages.forEach((p, i) => {
    const y = (margins.bottom + safe.bottom) * MM;
    if (footerText) p.drawText(fit(regular, footerText, 7, (box.right - box.left) * 0.7), { x: box.left, y, size: 7, font: regular, color: MUTED });
    if (showPageNumbers) {
      const t = `${i + 1} / ${total}`;
      p.drawText(t, { x: box.right - regular.widthOfTextAtSize(t, 7), y, size: 7, font: regular, color: MUTED });
    }
  });
  return doc.save();
}

/** Yükleme doğrulaması: imza (magic bytes) mime ile uyuşmalı; PDF tek sayfa olmalı. */
export async function validateLetterheadFile(bytes: Uint8Array, declared: string): Promise<'image/png' | 'image/jpeg' | 'application/pdf'> {
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPdf = bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  const mime = isPng ? 'image/png' : isJpg ? 'image/jpeg' : isPdf ? 'application/pdf' : null;
  if (!mime) throw Object.assign(new Error('Desteklenmeyen dosya: PNG, JPG veya PDF yükleyin'), { status: 400 });
  if (declared && declared !== mime && !(declared === 'image/jpg' && mime === 'image/jpeg')) {
    throw Object.assign(new Error('Dosya içeriği uzantı/tip ile uyuşmuyor'), { status: 400 });
  }
  if (mime === 'application/pdf') {
    const src = await PDFDocument.load(bytes).catch(() => null);
    if (!src) throw Object.assign(new Error('PDF okunamadı (şifreli veya bozuk)'), { status: 400 });
    if (src.getPageCount() !== 1) throw Object.assign(new Error('Antet PDF tek sayfa olmalı'), { status: 400 });
  }
  return mime;
}
