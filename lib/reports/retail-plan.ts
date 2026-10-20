import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/http/api-error';
import type { Permission } from '@/lib/roles';

export type RetailPlanOpportunity = {
  id: string; referenceKey: string; sourceName: string; updatedAt: string;
  customerId?: string; productId?: string; firm: string; model: string; qty: number; month: number;
  channel: string; prob: number; note: string; owner: string;
  saleType: 'sale' | 'rental' | 'bank'; businessModel: 'sale' | 'rental' | 'bank';
  source: 'retail_plan'; unitPrice: number | null; rentalMonthlyPrice: number | null; includeInRetailPlan: boolean;
};

export const canEditRetailPlan = (user: { permissions?: readonly Permission[] }) => (user.permissions ?? []).includes('forecast.write.any');
const selectColumns = `id::text,reference_key,source_name,plan_year,plan_month,customer_id::text,firm_name,product_code,quantity,business_model,probability,note,unit_price,rental_monthly_price,is_active,updated_at::text`;
function mapRow(row: Record<string, unknown>): RetailPlanOpportunity {
  const businessModel = row.business_model as RetailPlanOpportunity['businessModel'];
  return {
    id: String(row.id), referenceKey: String(row.reference_key), sourceName: String(row.source_name), updatedAt: String(row.updated_at),
    customerId: row.customer_id == null ? undefined : String(row.customer_id), firm: String(row.firm_name), model: String(row.product_code),
    qty: Number(row.quantity), month: Number(row.plan_month), channel: businessModel === 'bank' ? 'Banka' : 'Retail Planı',
    prob: Number(row.probability), note: String(row.note ?? ''), owner: '', saleType: businessModel, businessModel, source: 'retail_plan',
    unitPrice: row.unit_price == null ? null : Number(row.unit_price), rentalMonthlyPrice: row.rental_monthly_price == null ? null : Number(row.rental_monthly_price),
    includeInRetailPlan: row.is_active === true,
  };
}

export async function loadRetailPlan(years: number[]): Promise<Map<number, RetailPlanOpportunity[]>> {
  const result = new Map<number, RetailPlanOpportunity[]>(years.map(year => [year, []]));
  if (!years.length) return result;
  const { rows } = await db.query(`select ${selectColumns} from public.crm_retail_plan_entries where is_active=true and plan_year=any($1::int[]) order by plan_year,reference_key`, [years]);
  for (const row of rows) result.get(Number(row.plan_year))?.push(mapRow(row));
  return result;
}

export const retailPlanPatchSchema = z.object({
  expectedUpdatedAt: z.string().min(1).max(80),
  planMonth: z.number().int().min(1).max(12).optional(),
  quantity: z.number().int().min(0).max(100000).optional(),
  productCode: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/).transform(s => s.toUpperCase()).optional(),
  businessModel: z.enum(['sale', 'rental', 'bank']).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  note: z.string().max(4000).optional(),
  unitPrice: z.number().finite().min(0).max(1000000).nullable().optional(),
  rentalMonthlyPrice: z.number().finite().min(0).max(1000000).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 1, 'En az bir plan alanı gönderin');

export async function patchRetailPlan(user: { id: string; permissions?: readonly Permission[] }, id: string, input: z.infer<typeof retailPlanPatchSchema>) {
  if (!canEditRetailPlan(user)) throw new ApiError('FORBIDDEN', 'Retail planını düzenleme yetkiniz yok.', 403);
  // Never update source provenance, customer mapping, labels, year, or canonical Forecast rows.
  const fields = { planMonth: 'plan_month', quantity: 'quantity', productCode: 'product_code', businessModel: 'business_model', probability: 'probability', note: 'note', unitPrice: 'unit_price', rentalMonthlyPrice: 'rental_monthly_price', isActive: 'is_active' } as const;
  const values: unknown[] = [id, input.expectedUpdatedAt, user.id];
  const assignments = Object.entries(fields).filter(([key]) => Object.hasOwn(input, key)).map(([key, column]) => {
    values.push(input[key as keyof typeof fields]); return `${column}=$${values.length}`;
  });
  const { rows } = await db.query(`update public.crm_retail_plan_entries set ${assignments.join(',')},updated_at=clock_timestamp(),updated_by=$3 where id=$1::uuid and updated_at=$2::timestamptz returning ${selectColumns}`, values);
  if (!rows[0]) throw new ApiError('PLAN_CONFLICT', 'Plan başka biri tarafından güncellendi veya bulunamadı; yenileyin.', 409);
  return mapRow(rows[0]);
}
