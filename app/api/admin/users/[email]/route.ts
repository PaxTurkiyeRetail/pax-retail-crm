import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WEEKLY_TARGET_COLUMNS = [
  'weekly_target_sales_physical',
  'weekly_target_sales_online',
  'weekly_target_sales_phone',
  'weekly_target_sales_email',
  'weekly_target_technical_physical',
  'weekly_target_technical_online',
  'weekly_target_total_activities',
  'weekly_target_unique_customers',
] as const;

// Yıllık hedefler: alan adı → crm_target_definitions.code. Değer crm_target_values'a
// yıl periyoduyla yazılır (scope 'user'); 0 girilirse o yılın kaydı silinir (hedef yok).
const ANNUAL_TARGET_FIELDS = {
  annual_revenue_target: 'sales_revenue',
  annual_device_target: 'device_count',
} as const;

function toWeeklyTarget(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function toAnnualTarget(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function toTargetYear(value: unknown) {
  const parsed = Number(value);
  const current = new Date().getFullYear();
  if (!Number.isFinite(parsed) || parsed < 2024 || parsed > 2100) return current;
  return Math.floor(parsed);
}

// Yalnız is_active (emergency CRM access block) ve iş hedefleri buradan
// değiştirilebilir. role/password/secondary_roles bilinçli olarak
// desteklenmiyor: rol otoritesi tek kaynak AD grup eşlemesidir
// (auth_group_role_mappings → lib/auth/oidc.ts), burada manuel override edilemez.
export async function PATCH(req: Request, ctx: { params: Promise<{ email: string }> }) {
  try {
    const me = await requireAdminOrThrow();
    const { email } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const emailKey = email.toLowerCase();

    const fields: string[] = [];
    const values: any[] = [];

    if (typeof body?.is_active === 'boolean') {
      values.push(body.is_active);
      fields.push(`is_active = $${values.length}`);
    }
    if (typeof body?.full_name === 'string') {
      values.push(body.full_name.trim());
      fields.push(`full_name = $${values.length}`);
    }
    for (const column of WEEKLY_TARGET_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(body ?? {}, column)) {
        values.push(toWeeklyTarget(body?.[column]));
        fields.push(`${column} = $${values.length}`);
      }
    }

    const annualUpdates = (Object.keys(ANNUAL_TARGET_FIELDS) as Array<keyof typeof ANNUAL_TARGET_FIELDS>)
      .filter((field) => Object.prototype.hasOwnProperty.call(body ?? {}, field));

    if (!fields.length && !annualUpdates.length) {
      return NextResponse.json({ message: 'Güncellenecek alan yok' }, { status: 400 });
    }

    if (fields.length) {
      values.push(emailKey);
      await db.query(`update public.allowed_users set ${fields.join(', ')} where lower(email) = $${values.length}`, values);
    }

    if (annualUpdates.length) {
      const userRow = await db.query('select id from public.allowed_users where lower(email) = $1 limit 1', [emailKey]);
      const userId = String(userRow.rows[0]?.id ?? '');
      if (!userId) return NextResponse.json({ message: 'Kullanıcı bulunamadı' }, { status: 404 });

      const year = toTargetYear(body?.target_year);
      const periodStart = `${year}-01-01`;
      const periodEnd = `${year}-12-31`;

      for (const field of annualUpdates) {
        const code = ANNUAL_TARGET_FIELDS[field];
        const target = toAnnualTarget(body?.[field]);
        const definition = await db.query('select id from public.crm_target_definitions where code = $1 limit 1', [code]);
        const definitionId = String(definition.rows[0]?.id ?? '');
        if (!definitionId) continue;

        if (target <= 0) {
          await db.query(
            `delete from public.crm_target_values
             where definition_id = $1 and scope_type = 'user' and scope_user_id = $2
               and period_type = 'year' and period_start = $3::date and period_end = $4::date`,
            [definitionId, userId, periodStart, periodEnd],
          );
          continue;
        }

        await db.query(
          `insert into public.crm_target_values
             (definition_id, scope_type, scope_user_id, period_type, period_start, period_end, target_value, created_by, updated_by)
           values ($1, 'user', $2, 'year', $3::date, $4::date, $5, $6, $6)
           on conflict (definition_id, scope_type, scope_user_id, period_type, period_start, period_end)
           do update set target_value = excluded.target_value, updated_by = excluded.updated_by, updated_at = now()`,
          [definitionId, userId, periodStart, periodEnd, target, me.id],
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
