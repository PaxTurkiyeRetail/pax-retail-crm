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

function toWeeklyTarget(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

// Yalnız is_active (emergency CRM access block) ve iş hedefleri buradan
// değiştirilebilir. role/password/secondary_roles bilinçli olarak
// desteklenmiyor: rol otoritesi tek kaynak AD grup eşlemesidir
// (auth_group_role_mappings → lib/auth/oidc.ts), burada manuel override edilemez.
export async function PATCH(req: Request, ctx: { params: Promise<{ email: string }> }) {
  try {
    await requireAdminOrThrow();
    const { email } = await ctx.params;
    const body = await req.json().catch(() => ({}));

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

    if (!fields.length) {
      return NextResponse.json({ message: 'Güncellenecek alan yok' }, { status: 400 });
    }

    values.push(email.toLowerCase());
    await db.query(`update public.allowed_users set ${fields.join(', ')} where lower(email) = $${values.length}`, values);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
