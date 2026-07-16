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


function cleanEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export async function GET() {
  try {
    await requireAdminOrThrow();
    await ensureWeeklyTargetColumns();
    const result = await db.query(`
      select email, full_name, role, is_active,
        weekly_target_sales_physical,
        weekly_target_sales_online,
        weekly_target_sales_phone,
        weekly_target_sales_email,
        weekly_target_technical_physical,
        weekly_target_technical_online,
        weekly_target_total_activities,
        weekly_target_unique_customers
      from public.allowed_users
      order by coalesce(full_name, email) asc
    `);
    return NextResponse.json({ users: result.rows }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow();
    await ensureWeeklyTargetColumns();
    const body = await req.json().catch(() => ({}));
    const email = cleanEmail(body?.email);
    const fullName = String(body?.full_name ?? '').trim();
    const role = String(body?.role ?? 'user').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();
    const weeklyTargets = WEEKLY_TARGET_COLUMNS.map((column) => toWeeklyTarget(body?.[column]));

    if (!email) return NextResponse.json({ message: 'Email zorunlu' }, { status: 400 });
    if (!fullName) return NextResponse.json({ message: 'Ad Soyad zorunlu' }, { status: 400 });
    if (!VALID_ROLES.includes(role as any)) return NextResponse.json({ message: 'Geçersiz rol' }, { status: 400 });
    if (!password) return NextResponse.json({ message: 'Şifre zorunlu' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `
        insert into public.allowed_users (
          email, full_name, role, is_active, password_hash,
          weekly_target_sales_physical, weekly_target_sales_online, weekly_target_sales_phone, weekly_target_sales_email,
          weekly_target_technical_physical, weekly_target_technical_online, weekly_target_total_activities, weekly_target_unique_customers
        )
        values ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (email) do update set
          full_name = excluded.full_name,
          role = excluded.role,
          is_active = true,
          password_hash = excluded.password_hash,
          weekly_target_sales_physical = excluded.weekly_target_sales_physical,
          weekly_target_sales_online = excluded.weekly_target_sales_online,
          weekly_target_sales_phone = excluded.weekly_target_sales_phone,
          weekly_target_sales_email = excluded.weekly_target_sales_email,
          weekly_target_technical_physical = excluded.weekly_target_technical_physical,
          weekly_target_technical_online = excluded.weekly_target_technical_online,
          weekly_target_total_activities = excluded.weekly_target_total_activities,
          weekly_target_unique_customers = excluded.weekly_target_unique_customers
      `,
      [email, fullName, role, passwordHash, ...weeklyTargets]
    );

    return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Kullanıcı oluşturulamadı' }, { status: e?.status || 500 });
  }
}
