// Arayüz etiketleri (Türkçe).
import type { Department, FilterOp, RelativePreset, TimeGrain, VizType } from '@/lib/report-builder/types';

export const DEPARTMENT_LABEL: Record<Department, string> = { all: 'Tümü', Retail: 'Retail', Vertical: 'Vertical', Bank: 'Bank' };

export const PRESET_LABEL: Record<RelativePreset, string> = {
  today: 'Bugün', last_7_days: 'Son 7 gün', last_30_days: 'Son 30 gün', last_90_days: 'Son 90 gün',
  this_week: 'Bu hafta', last_week: 'Geçen hafta', this_month: 'Bu ay', last_month: 'Geçen ay',
  this_quarter: 'Bu çeyrek', last_quarter: 'Geçen çeyrek', this_year: 'Bu yıl', last_year: 'Geçen yıl', ytd: 'Yıl başından beri',
};

export const GRAIN_LABEL: Record<TimeGrain, string> = { day: 'Gün', week: 'Hafta', month: 'Ay', quarter: 'Çeyrek', year: 'Yıl' };

export const OP_LABEL: Record<FilterOp, string> = {
  eq: '=', neq: '≠', in: 'içinde', not_in: 'içinde değil', contains: 'içerir', starts_with: 'ile başlar',
  gt: '>', gte: '≥', lt: '<', lte: '≤', between: 'arası', is_null: 'boş', not_null: 'dolu',
};

export const VIZ_LABEL: Record<VizType, string> = { table: 'Tablo', pivot: 'Pivot', kpi: 'KPI', bar: 'Bar', line: 'Çizgi', pie: 'Pasta', heatmap: 'Isı tablosu' };
