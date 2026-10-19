import { PDFDocument, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { compileReport } from '@/lib/report-builder/compiler';
import { getDataset } from '@/lib/report-builder/datasets';
import {
  applyPageFilters, isDataWidget, letterheadSettingsSchema, parsePageDefinition, resolveDepartment, resolveLayout,
} from '@/lib/report-builder/page-types';
import {
  loadPdfFonts, matchConditionalRule, pdfFileName, pdfWidgetOrder, renderPagePdf, validateLetterheadFile, type WidgetData,
} from '@/lib/report-builder/pdf';
import type { ReportResult } from '@/lib/report-builder/result';
import { PAGE_TEMPLATES, getPageTemplate } from '@/lib/report-builder/templates';
import { ReportDefinitionError, reportDefinitionSchema } from '@/lib/report-builder/types';

const TODAY = '2026-10-19';

describe('departman (musteriler.is_kolu)', () => {
  it('tüm datasetlerde Departman boyutu var', async () => {
    const { DATASETS } = await import('@/lib/report-builder/datasets');
    for (const ds of Object.values(DATASETS)) expect(ds.dimensions.department?.label, ds.key).toBe('Departman');
  });
  it('department parametreyle derlenir, all filtre eklemez', () => {
    const base = { dataset: 'sales', measures: ['sale_count'] };
    const c = compileReport(reportDefinitionSchema.parse({ ...base, department: 'Bank' }), { scope: { kind: 'all' }, today: TODAY });
    expect(c.sql).toMatch(/is_kolu/);
    expect(c.params).toContain('Bank');
    expect(c.sql).not.toContain("'Bank'");
    const all = compileReport(reportDefinitionSchema.parse({ ...base, department: 'all' }), { scope: { kind: 'all' }, today: TODAY });
    expect(all.params).not.toContain('Bank');
    expect(() => reportDefinitionSchema.parse({ ...base, department: "Retail' or 1=1" })).toThrow();
  });
  it('öncelik: görüntüleyen > widget > sayfa', () => {
    expect(resolveDepartment('Retail', undefined, undefined)).toBe('Retail');
    expect(resolveDepartment('Retail', 'Bank', undefined)).toBe('Bank');
    expect(resolveDepartment('Retail', 'Bank', 'all')).toBe('all');
    expect(resolveDepartment('Retail', undefined, 'hack')).toBe('Retail');
    expect(getPageTemplate('retail_operasyon')!.department).toBe('Retail');
  });
});

function fakeResult(columns: ReportResult['columns'], rows: ReportResult['rows']): ReportResult {
  return { columns, rows, truncated: false, range: null, compareRange: null, durationMs: 1 };
}

/** Derlenmiş sütun meta'sından sahte satır üretir (DB'siz PDF testi). */
function fakeData(page: ReturnType<typeof parsePageDefinition>, rowCount = 3): Record<string, WidgetData> {
  const data: Record<string, WidgetData> = {};
  for (const w of page.widgets.filter(isDataWidget)) {
    const build = (q: typeof w.query) => {
      const { columns } = compileReport(q, { scope: { kind: 'all' }, today: TODAY });
      const rows = Array.from({ length: rowCount }, (_, i) => Object.fromEntries(columns.map((c) => [
        c.key,
        c.type === 'number' ? (i + 1) * 10 : c.type === 'date' ? `2026-0${(i % 9) + 1}-01` : c.type === 'boolean' ? true : `Değer ${i} — çğıöşü İĞŞ`,
      ])));
      return fakeResult(columns, rows);
    };
    data[w.id] = { result: build(w.query), forecast: w.forecastQuery ? build(w.forecastQuery) : undefined };
  }
  return data;
}

describe('sayfa şeması', () => {
  it('grid dışı ve tekrar eden id reddedilir', () => {
    const base = { version: 1, title: 'T', widgets: [] as unknown[] };
    const text = (id: string, x: number, w: number) => ({ id, type: 'text', text: 'a', layout: { lg: { x, y: 0, w, h: 1 } } });
    expect(() => parsePageDefinition({ ...base, widgets: [text('a', 8, 6)] })).toThrow(ReportDefinitionError);
    expect(() => parsePageDefinition({ ...base, widgets: [text('a', 0, 6), text('a', 6, 6)] })).toThrow(ReportDefinitionError);
    expect(() => parsePageDefinition({ ...base, widgets: [{ ...text('a', 0, 6), style: { accent: '#ff0000' } }] })).toThrow(ReportDefinitionError);
    expect(parsePageDefinition({ ...base, widgets: [text('a', 0, 6), text('b', 6, 6)] }).widgets).toHaveLength(2);
  });
  it('mobilde tek sütun, tablette ölçekli', () => {
    const page = parsePageDefinition({
      version: 1, title: 'T',
      widgets: [
        { id: 'b', type: 'text', layout: { lg: { x: 6, y: 0, w: 6, h: 2 } } },
        { id: 'a', type: 'text', layout: { lg: { x: 0, y: 0, w: 6, h: 3 } } },
      ],
    });
    const sm = resolveLayout(page.widgets, 'sm');
    expect(sm.map((i) => [i.id, i.x, i.w, i.y])).toEqual([['a', 0, 1, 0], ['b', 0, 1, 3]]);
    const md = resolveLayout(page.widgets, 'md');
    expect(md.find((i) => i.id === 'b')).toMatchObject({ x: 3, w: 3 });
  });
  it('sayfa filtresi yalnız alanı olan dataset’e uygulanır', () => {
    const page = getPageTemplate('retail_operasyon')!;
    const w = page.widgets.filter(isDataWidget).find((x) => x.id === 'kasapos_heat')!;
    const ds = getDataset(w.query.dataset)!;
    const has = (f: string) => Object.prototype.hasOwnProperty.call(ds.dimensions, f);
    const q = applyPageFilters(w.query, page.filters, { owner: 'Ali', period: 'last_year' }, has);
    expect(q.filters.some((f) => f.field === 'owner' && f.value === 'Ali')).toBe(true);
    expect(q.dateRange).toMatchObject({ type: 'relative', preset: 'last_year' });
    const q2 = applyPageFilters(w.query, [{ key: 'x', label: 'X', kind: 'select', field: 'nope' }], { x: 'a' }, has);
    expect(q2.filters).toHaveLength(w.query.filters.length);
  });
  it('koşullu biçim eşleşir', () => {
    const rules = [{ column: 'c', op: 'lt' as const, value: 20, color: 'danger' as const }, { column: 'c', op: 'between' as const, value: 20, value2: 50, color: 'warning' as const }];
    expect(matchConditionalRule(rules, 'c', 5)).toBe('danger');
    expect(matchConditionalRule(rules, 'c', 30)).toBe('warning');
    expect(matchConditionalRule(rules, 'c', 80)).toBeNull();
    expect(matchConditionalRule(rules, 'c', '5')).toBeNull();
  });
});

describe('şablonlar: mevcut raporlar tanım JSON’uyla üretilebilir', () => {
  for (const [key, t] of Object.entries(PAGE_TEMPLATES)) {
    it(`${key}: her widget sorgusu derlenir (own kapsamıyla da)`, () => {
      const page = t.build();
      const widgets = page.widgets.filter(isDataWidget);
      expect(widgets.length).toBeGreaterThan(1);
      for (const w of widgets) {
        for (const q of [w.query, w.forecastQuery].filter(Boolean)) {
          const own = compileReport(q!, { scope: { kind: 'own', userId: 'u1', email: 'a@b.c', fullName: 'A' }, today: TODAY });
          expect(own.sql).toContain('$');
          expect(own.params).toContain('u1');
        }
      }
    });
  }
});

describe('antetli PDF', () => {
  it('dosya adı Türkçe karakterleri sadeleştirir', () => {
    expect(pdfFileName('Retail Operasyon Paneli — Ekim/Çeyrek', TODAY)).toBe('retail-operasyon-paneli-ekimceyrek_2026-10-19.pdf');
    expect(pdfFileName('***', TODAY)).toBe('rapor_2026-10-19.pdf');
  });

  it('PDF antet + Retail şablonu → çok sayfalı PDF, tablo başlığı tekrarlanır, gizli widget atlanır', async () => {
    const fonts = await loadPdfFonts();
    // Tek sayfalık antet PDF'i (vektör) üret.
    const lhDoc = await PDFDocument.create();
    const lp = lhDoc.addPage([595.28, 841.89]);
    lp.drawRectangle({ x: 0, y: 800, width: 595.28, height: 41.89, color: rgb(0.1, 0.3, 0.8) });
    const lhBytes = await lhDoc.save();
    expect(await validateLetterheadFile(lhBytes, 'application/pdf')).toBe('application/pdf');

    const page = getPageTemplate('retail_operasyon')!;
    const order = pdfWidgetOrder(page);
    expect(order.some((w) => w.id === 'f_period')).toBe(false);

    const settings = letterheadSettingsSchema.parse({ name: 'Kurumsal', margins: { top: 12, right: 12, bottom: 12, left: 12 }, safeArea: { top: 20, bottom: 10 }, footerText: 'PAX Türkiye · Gizli' });
    const bytes = await renderPagePdf({ page, data: fakeData(page, 120), letterhead: { settings, bytes: lhBytes, mimeType: 'application/pdf' }, fonts, date: TODAY });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBeGreaterThan(2);
    expect(out.getTitle()).toBe('Retail Operasyon Paneli');
  }, 30_000);

  it('PNG antet ve antetsiz yatay sayfa', async () => {
    const fonts = await loadPdfFonts();
    // 1x1 PNG
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    expect(await validateLetterheadFile(png, 'image/png')).toBe('image/png');
    const page = getPageTemplate('kasapos_entegrasyon')!;
    const settings = letterheadSettingsSchema.parse({ name: 'L', orientation: 'landscape' });
    const a = await renderPagePdf({ page, data: fakeData(page), letterhead: { settings, bytes: png, mimeType: 'image/png' }, fonts, date: TODAY });
    const doc = await PDFDocument.load(a);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    const b = await renderPagePdf({ page, data: {}, fonts, date: TODAY });
    expect((await PDFDocument.load(b)).getPageCount()).toBe(1);
  }, 30_000);

  it('antet dosya doğrulaması: sahte imza ve çok sayfalı PDF reddedilir', async () => {
    await expect(validateLetterheadFile(new TextEncoder().encode('<svg></svg>'), 'image/png')).rejects.toThrow();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    await expect(validateLetterheadFile(png, 'application/pdf')).rejects.toThrow();
    const two = await PDFDocument.create();
    two.addPage(); two.addPage();
    await expect(validateLetterheadFile(await two.save(), 'application/pdf')).rejects.toThrow('tek sayfa');
  });

  it('aşırı kenar boşluğu reddedilir', async () => {
    const fonts = await loadPdfFonts();
    const page = getPageTemplate('kasapos_entegrasyon')!;
    const settings = letterheadSettingsSchema.parse({ name: 'L', margins: { top: 100, right: 15, bottom: 100, left: 15 }, safeArea: { top: 100, bottom: 0 } });
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    await expect(renderPagePdf({ page, data: {}, fonts, date: TODAY, letterhead: { settings, bytes: png, mimeType: 'image/png' } })).rejects.toThrow('kenar');
  });
});
