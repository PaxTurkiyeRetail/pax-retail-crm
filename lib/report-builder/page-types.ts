// SAYFA (DASHBOARD) TANIMI — designer'ın kaydettiği layout JSON şeması.
// Widget'lar ya bir rapor tanımı (inline `query`) ya da metin/filtre/sekme gibi sunum öğesidir.
// Renkler serbest hex DEĞİL: yalnız tema token'ları (COLOR_TOKENS).
import { z } from 'zod';
import { COLOR_TOKENS, conditionalRuleSchema, DEPARTMENT_VALUES, reportDefinitionSchema, ReportDefinitionError, type Department } from '@/lib/report-builder/types';

/** Departman çözümü: görüntüleyen seçimi > widget sorgusunun kendi değeri > sayfa varsayılanı. */
export function resolveDepartment(pageDefault: Department, widgetValue: Department | undefined, viewerValue: unknown): Department {
  if (typeof viewerValue === 'string' && (DEPARTMENT_VALUES as readonly string[]).includes(viewerValue)) return viewerValue as Department;
  if (widgetValue && widgetValue !== 'all') return widgetValue;
  return pageDefault;
}

export const GRID_COLUMNS = 12;
export { COLOR_TOKENS, conditionalRuleSchema, type ColorToken, type ConditionalRule } from '@/lib/report-builder/types';
export const BREAKPOINTS = ['lg', 'md', 'sm'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];
/** Breakpoint başına sütun sayısı: masaüstü 12, tablet 6, mobil 1 (otomatik tek sütun). */
export const BREAKPOINT_COLUMNS: Record<Breakpoint, number> = { lg: 12, md: 6, sm: 1 };

const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const shortText = z.string().max(200);

export const gridItemSchema = z.object({
  x: z.number().int().min(0).max(GRID_COLUMNS - 1),
  y: z.number().int().min(0).max(500),
  w: z.number().int().min(1).max(GRID_COLUMNS),
  h: z.number().int().min(1).max(40),
}).refine((g) => g.x + g.w <= GRID_COLUMNS, { message: 'Widget grid dışına taşıyor' });
export type GridItem = z.infer<typeof gridItemSchema>;

export const layoutSchema = z.object({
  lg: gridItemSchema,
  md: gridItemSchema.optional(),
  /** sm verilmezse mobilde sıra = lg (y, x) sırası, tam genişlik. */
  sm: gridItemSchema.optional(),
});

export const numberFormatSchema = z.enum(['number', 'money', 'percent', 'compact']);


export const columnSettingSchema = z.object({
  key: z.string().max(80),
  label: shortText.optional(),
  hidden: z.boolean().optional(),
  format: numberFormatSchema.optional(),
});

export const widgetStyleSchema = z.object({
  accent: z.enum(COLOR_TOKENS).optional(),
  density: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  showTitle: z.boolean().default(true),
  columns: z.array(columnSettingSchema).max(40).default([]),
  conditional: z.array(conditionalRuleSchema).max(20).default([]),
  numberFormat: numberFormatSchema.optional(),
});

export const pdfOptionsSchema = z.object({
  hideInPdf: z.boolean().default(false),
  pageBreakBefore: z.boolean().default(false),
});

export const DATA_WIDGET_TYPES = ['kpi', 'kpi_strip', 'table', 'pivot', 'bar', 'line', 'pie', 'heatmap'] as const;

const widgetBase = {
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  title: shortText.default(''),
  layout: layoutSchema,
  style: widgetStyleSchema.default({ density: 'normal', showTitle: true, columns: [], conditional: [] }),
  pdf: pdfOptionsSchema.default({ hideInPdf: false, pageBreakBefore: false }),
  /** Sekme widget'ındaki sekme anahtarı; boşsa her zaman görünür. */
  tab: key.optional(),
};

export const dataWidgetSchema = z.object({
  ...widgetBase,
  type: z.enum(DATA_WIDGET_TYPES),
  query: reportDefinitionSchema,
  /** heatmap: tahmin (sarı) değerleri için ikinci sorgu; gerçekleşen (yeşil) = query. */
  forecastQuery: reportDefinitionSchema.optional(),
  /** Sayfa filtrelerinden hangileri bu widget'a uygulanır (boş = hepsi, alan eşleşirse). */
  ignorePageFilters: z.boolean().default(false),
});

export const textWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal('text'),
  variant: z.enum(['heading', 'paragraph', 'note']).default('paragraph'),
  text: z.string().max(4000).default(''),
});

export const filterWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal('filter'),
  /** Kontrol ettiği sayfa filtresi anahtarı. */
  filterKey: key,
});

export const tabsWidgetSchema = z.object({
  ...widgetBase,
  type: z.literal('tabs'),
  tabs: z.array(z.object({ key, label: z.string().min(1).max(60) })).min(1).max(12),
});

export const widgetSchema = z.discriminatedUnion('type', [
  dataWidgetSchema.extend({ type: z.literal('kpi') }),
  dataWidgetSchema.extend({ type: z.literal('kpi_strip') }),
  dataWidgetSchema.extend({ type: z.literal('table') }),
  dataWidgetSchema.extend({ type: z.literal('pivot') }),
  dataWidgetSchema.extend({ type: z.literal('bar') }),
  dataWidgetSchema.extend({ type: z.literal('line') }),
  dataWidgetSchema.extend({ type: z.literal('pie') }),
  dataWidgetSchema.extend({ type: z.literal('heatmap') }),
  textWidgetSchema,
  filterWidgetSchema,
  tabsWidgetSchema,
]);
export type PageWidget = z.infer<typeof widgetSchema>;
export type DataWidget = Extract<PageWidget, { query: unknown }>;

/** Sayfa filtresi: aynı alan adına sahip dataset'lere uygulanır (field yoksa widget'ta atlanır). */
export const pageFilterSchema = z.object({
  key,
  label: z.string().min(1).max(60),
  kind: z.enum(['date_range', 'select', 'text']),
  field: key.optional(),
  options: z.array(z.string().max(80)).max(50).optional(),
  defaultValue: z.unknown().optional(),
});
export type PageFilter = z.infer<typeof pageFilterSchema>;

export const pageDefinitionSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  theme: z.object({
    accent: z.enum(COLOR_TOKENS).default('primary'),
    density: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  }).default({ accent: 'primary', density: 'normal' }),
  filters: z.array(pageFilterSchema).max(10).default([]),
  /** Sayfa bazlı varsayılan departman (Retail/Vertical/Bank/Tümü). Görüntüleyen `values.department` ile değiştirebilir. */
  department: z.enum(DEPARTMENT_VALUES).default('all'),
  widgets: z.array(widgetSchema).max(60),
  pdf: z.object({
    orientation: z.enum(['portrait', 'landscape']).optional(),
    letterheadId: z.string().uuid().optional(),
  }).default({}),
}).superRefine((page, ctx) => {
  const ids = new Set<string>();
  const filterKeys = new Set(page.filters.map((f) => f.key));
  const tabKeys = new Set(page.widgets.flatMap((w) => (w.type === 'tabs' ? w.tabs.map((t) => t.key) : [])));
  page.widgets.forEach((w, i) => {
    if (ids.has(w.id)) ctx.addIssue({ code: 'custom', path: ['widgets', i, 'id'], message: 'Widget id tekrarlanmış' });
    ids.add(w.id);
    if (w.type === 'filter' && !filterKeys.has(w.filterKey)) ctx.addIssue({ code: 'custom', path: ['widgets', i, 'filterKey'], message: 'Tanımsız sayfa filtresi' });
    if (w.tab && !tabKeys.has(w.tab)) ctx.addIssue({ code: 'custom', path: ['widgets', i, 'tab'], message: 'Tanımsız sekme' });
  });
});
export type PageDefinition = z.infer<typeof pageDefinitionSchema>;

export function parsePageDefinition(input: unknown): PageDefinition {
  const r = pageDefinitionSchema.safeParse(input);
  if (!r.success) {
    throw new ReportDefinitionError('Geçersiz sayfa tanımı', r.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || 'sayfa'}: ${i.message}`));
  }
  return r.data;
}

export function isDataWidget(w: PageWidget): w is DataWidget {
  return (DATA_WIDGET_TYPES as readonly string[]).includes(w.type);
}

/** Breakpoint düzeni: md/sm verilmemişse lg'den türetilir; sm her zaman tek sütun ve (y,x) sırası. */
export function resolveLayout(widgets: PageWidget[], bp: Breakpoint): Array<{ id: string; x: number; y: number; w: number; h: number }> {
  const cols = BREAKPOINT_COLUMNS[bp];
  if (bp === 'lg') return widgets.map((w) => ({ id: w.id, ...w.layout.lg }));
  const sorted = [...widgets].sort((a, b) => a.layout.lg.y - b.layout.lg.y || a.layout.lg.x - b.layout.lg.x);
  if (bp === 'sm') {
    let y = 0;
    return sorted.map((w) => {
      const h = w.layout.sm?.h ?? w.layout.lg.h;
      const item = { id: w.id, x: 0, y, w: 1, h };
      y += h;
      return item;
    });
  }
  return widgets.map((w) => {
    if (w.layout.md) return { id: w.id, ...w.layout.md, w: Math.min(w.layout.md.w, cols) };
    const scale = cols / GRID_COLUMNS;
    const width = Math.max(1, Math.min(cols, Math.round(w.layout.lg.w * scale)));
    const x = Math.min(cols - width, Math.round(w.layout.lg.x * scale));
    return { id: w.id, x, y: w.layout.lg.y, w: width, h: w.layout.lg.h };
  });
}

/**
 * Sayfa filtresi değerlerini widget sorgusuna uygular. Alan dataset'te yoksa filtre atlanır;
 * değer doğrulaması derleyicide yapılır (tip zorlama + parametre).
 */
export function applyPageFilters(
  query: z.infer<typeof reportDefinitionSchema>,
  filters: PageFilter[],
  values: Record<string, unknown>,
  hasField: (field: string) => boolean,
): z.infer<typeof reportDefinitionSchema> {
  const out = { ...query, filters: [...query.filters] };
  for (const f of filters) {
    const v = Object.prototype.hasOwnProperty.call(values, f.key) ? values[f.key] : f.defaultValue;
    if (v === undefined || v === null || v === '') continue;
    if (f.kind === 'date_range') {
      const preset = typeof v === 'string' ? v : null;
      const obj = typeof v === 'object' && v ? (v as { from?: string; to?: string }) : null;
      const field = f.field && hasField(f.field) ? f.field : out.dateRange?.field;
      if (preset) out.dateRange = { type: 'relative', preset: preset as never, ...(field ? { field } : {}) };
      else if (obj?.from && obj?.to) out.dateRange = { type: 'absolute', from: obj.from, to: obj.to, ...(field ? { field } : {}) };
      continue;
    }
    if (!f.field || !hasField(f.field)) continue;
    if (out.filters.length >= 20) break;
    out.filters.push(f.kind === 'text'
      ? { field: f.field, op: 'contains', value: String(v) }
      : Array.isArray(v) ? { field: f.field, op: 'in', value: v as string[] } : { field: f.field, op: 'eq', value: v as string });
  }
  return reportDefinitionSchema.parse(out);
}

/** Tek rapor tanımını tek widget'lı sayfaya sarar (rapor → PDF). */
export function definitionToPage(query: unknown, title: string): PageDefinition {
  const q = reportDefinitionSchema.parse(query);
  const type = q.visualization.type === 'kpi' ? 'kpi_strip' : q.visualization.type;
  return parsePageDefinition({ version: 1, title, widgets: [{ id: 'report', type, query: q, layout: { lg: { x: 0, y: 0, w: 12, h: 8 } } }] });
}

// ---------------------------------------------------------------------------
// Antet (letterhead) ayarları — görsel bytea'da, bu şema yalnız metadata.
// ---------------------------------------------------------------------------
export const marginsSchema = z.object({
  top: z.number().min(0).max(100),
  right: z.number().min(0).max(100),
  bottom: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
});
export type MarginsMm = z.infer<typeof marginsSchema>;

export const letterheadSettingsSchema = z.object({
  name: z.string().min(1).max(120),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  /** Sayfa kenar boşlukları (içerik bu çerçevede). */
  margins: marginsSchema.default({ top: 15, right: 15, bottom: 15, left: 15 }),
  /** Antet görselinin dolu olduğu, içeriğin girmemesi gereken üst/alt bantlar (mm). */
  safeArea: z.object({ top: z.number().min(0).max(150), bottom: z.number().min(0).max(150) }).default({ top: 0, bottom: 0 }),
  showTitle: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showPageNumbers: z.boolean().default(true),
  footerText: z.string().max(300).default(''),
  isDefault: z.boolean().default(false),
});
export type LetterheadSettings = z.infer<typeof letterheadSettingsSchema>;
