import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_ROLES = ['super_admin', 'admin', 'account_manager', 'itsm', 'user'] as const;

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

async function ensureWeeklyTargetColumns() {
  await db.query(`
    alter table public.allowed_users
      add column if not exists weekly_target_sales_physical integer not null default 0,
      add column if not exists weekly_target_sales_online integer not null default 0,
      add column if not exists weekly_target_sales_phone integer not null default 0,
      add column if not exists weekly_target_sales_email integer not null default 0,
      add column if not exists weekly_target_technical_physical integer not null default 0,
      add column if not exists weekly_target_technical_online integer not null default 0,
      add column if not exists weekly_target_total_activities integer not null default 0,
      add column if not exists weekly_target_unique_customers integer not null default 0
  `);
}


export async function PATCH(req: Request, ctx: { params: Promise<{ email: string }> }) {
  try {
    await requireAdminOrThrow();
    await ensureWeeklyTargetColumns();
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
    if (typeof body?.role === 'string') {
      if (!VALID_ROLES.includes(body.role as any)) {
        return NextResponse.json({ message: 'Geçersiz rol' }, { status: 400 });
      }
      values.push(body.role);
      fields.push(`role = $${values.length}`);
    }
    if (typeof body?.password === 'string' && body.password.trim()) {
      const passwordHash = await bcrypt.hash(body.password.trim(), 10);
      values.push(passwordHash);
      fields.push(`password_hash = $${values.length}`);
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

export async function DELETE(_req: Request, ctx: { params: Promise<{ email: string }> }) {
  try {
    await requireAdminOrThrow();
    await ensureWeeklyTargetColumns();
    const { email } = await ctx.params;
    const userResult = await db.query(`select id from public.allowed_users where lower(email) = lower($1) limit 1`, [email]);
    const userId = userResult.rows[0]?.id;
    if (userId) {
      await db.query(`delete from public.user_sessions where user_id = $1`, [userId]);
    }
    await db.query(`delete from public.allowed_users where lower(email) = lower($1)`, [email]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
