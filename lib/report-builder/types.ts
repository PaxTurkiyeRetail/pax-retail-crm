// Rapor Geliştirme Aracı — rapor tanımı şeması (tek kaynak).
// Kullanıcı SQL yazmaz; yalnız dataset/alan anahtarları ve değerler gönderir.
// Anahtarlar burada yalnız biçim olarak doğrulanır, beyaz liste kontrolü derleyicidedir.
import { z } from 'zod';

export const MAX_ROW_LIMIT = 5000;
export const DEFAULT_ROW_LIMIT = 500;

const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, 'Geçersiz alan anahtarı');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const scalar = z.union([z.string().max(500), z.number().finite(), z.boolean()]);

export const DEPARTMENT_VALUES = ['all', 'Retail', 'Vertical', 'Bank'] as const;
export type Department = (typeof DEPARTMENT_VALUES)[number];

export const TIME_GRAINS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type TimeGrain = (typeof TIME_GRAINS)[number];

export const RELATIVE_PRESETS = [
  'today', 'last_7_days', 'last_30_days', 'last_90_days',
  'this_week', 'last_week', 'this_month', 'last_month',
  'this_quarter', 'last_quarter', 'this_year', 'last_year', 'ytd',
] as const;
export type RelativePreset = (typeof RELATIVE_PRESETS)[number];

export const FILTER_OPS = ['eq', 'neq', 'in', 'not_in', 'contains', 'starts_with', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'not_null'] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const dimensionRefSchema = z.object({
  field: key,
  grain: z.enum(TIME_GRAINS).optional(),
});

export const filterSchema = z.object({
  field: key,
  op: z.enum(FILTER_OPS),
  value: z.union([scalar, z.array(scalar).max(200)]).optional(),
});

export const dateRangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('relative'), preset: z.enum(RELATIVE_PRESETS), field: key.optional() }),
  z.object({ type: z.literal('absolute'), from: isoDate, to: isoDate, field: key.optional() }),
]);

// Hesaplanmış alan: ölçüler arası güvenli aritmetik ağacı (ham ifade yok).
export type CalcExpr =
  | { measure: string }
  | { const: number }
  | { op: 'add' | 'sub' | 'mul' | 'div' | 'pct'; left: CalcExpr; right: CalcExpr };

export const calcExprSchema: z.ZodType<CalcExpr> = z.lazy(() =>
  z.union([
    z.object({ measure: key }),
    z.object({ const: z.number().finite() }),
    z.object({ op: z.enum(['add', 'sub', 'mul', 'div', 'pct']), left: calcExprSchema, right: calcExprSchema }),
  ]),
);

export const calculatedFieldSchema = z.object({
  key: key,
  label: z.string().min(1).max(80),
  expr: calcExprSchema.optional(),
  /** Güvenli formül dili (lib/report-builder/formula.ts). expr ile birlikte verilemez. */
  formula: z.string().min(1).max(500).optional(),
  format: z.enum(['number', 'money', 'percent']).optional(),
}).refine((c) => (c.expr ? 1 : 0) + (c.formula ? 1 : 0) === 1, { message: 'Hesaplanmış alan: expr veya formula (yalnız biri) gerekli' });

export const VIZ_TYPES = ['table', 'pivot', 'kpi', 'bar', 'line', 'pie', 'heatmap'] as const;
export type VizType = (typeof VIZ_TYPES)[number];

export const visualizationSchema = z.object({
  type: z.enum(VIZ_TYPES),
  /** pivot/heatmap: sütuna açılacak kırılım. */
  pivotColumn: key.optional(),
  stacked: z.boolean().optional(),
});

export const reportDefinitionSchema = z.object({
  version: z.literal(1).default(1),
  dataset: key,
  measures: z.array(key).min(1).max(12),
  dimensions: z.array(dimensionRefSchema).max(4).default([]),
  filters: z.array(filterSchema).max(20).default([]),
  dateRange: dateRangeSchema.optional(),
  /** Varsayılan departman filtresi (musteriler.is_kolu). 'all' = tümü. */
  department: z.enum(DEPARTMENT_VALUES).optional(),
  calculated: z.array(calculatedFieldSchema).max(6).default([]),
  sort: z.array(z.object({ field: key, dir: z.enum(['asc', 'desc']) })).max(4).default([]),
  limit: z.number().int().min(1).max(MAX_ROW_LIMIT).default(DEFAULT_ROW_LIMIT),
  compare: z.enum(['none', 'previous_period', 'yoy']).default('none'),
  visualization: visualizationSchema.default({ type: 'table' }),
});

export type ReportDefinitionInput = z.input<typeof reportDefinitionSchema>;
export type ReportDefinition = z.output<typeof reportDefinitionSchema>;
export type DimensionRef = z.infer<typeof dimensionRefSchema>;
export type ReportFilter = z.infer<typeof filterSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

export class ReportDefinitionError extends Error {
  status = 400 as const;
  code = 'INVALID_REPORT_DEFINITION' as const;
  constructor(message: string, public issues: string[] = [message]) {
    super(message);
  }
}

export function parseReportDefinition(input: unknown): ReportDefinition {
  const parsed = reportDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'tanım'}: ${issue.message}`);
    throw new ReportDefinitionError('Rapor tanımı geçersiz', issues);
  }
  return parsed.data;
}

// Satır kapsamı: yetki filtresinin girdisi (derleyici saf kalır, kullanıcı oturumu bilmez).
export type RowScope =
  | { kind: 'all' }
  | { kind: 'own'; userId: string; email: string; fullName: string | null };

export type ColumnMeta = {
  key: string;
  label: string;
  role: 'dimension' | 'measure' | 'calculated';
  type: 'string' | 'number' | 'date' | 'boolean';
  format?: 'number' | 'money' | 'percent' | 'date';
  grain?: TimeGrain;
};
