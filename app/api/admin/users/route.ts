import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';

const VALID_ROLES = ['super_admin', 'account_manager', 'itsm', 'admin', 'user'] as const;

export async function GET() {
  try {
    await requireAdminOrThrow();
    const res = await db.query(`select email, full_name, role, is_active from public.allowed_users order by full_name asc nulls last, email asc`);
    return NextResponse.json({ users: res.rows });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow();
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const fullName = String(body?.full_name ?? '').trim();
    const password = String(body?.password ?? '');
    const role = String(body?.role ?? '').trim();

    if (!email || !fullName || !password || !role) return NextResponse.json({ message: 'Eksik alan' }, { status: 400 });
    if (!VALID_ROLES.includes(role as any)) return NextResponse.json({ message: 'Geçersiz rol' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `
      insert into public.allowed_users (email, full_name, role, is_active, password_hash)
      values ($1, $2, $3, true, $4)
      on conflict (email) do update
      set full_name = excluded.full_name,
          role = excluded.role,
          is_active = true,
          password_hash = excluded.password_hash
      `,
      [email, fullName, role, passwordHash]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? 'İşlem başarısız' }, { status: 400 });
  }
}
