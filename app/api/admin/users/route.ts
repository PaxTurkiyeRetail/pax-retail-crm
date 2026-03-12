import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const VALID_ROLES = ['super_admin', 'account_manager', 'itsm', 'admin', 'user'] as const;
type ValidRole = typeof VALID_ROLES[number];

export async function GET() {
  try { await requireAdminOrThrow(); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('allowed_users').select('email, full_name, role, is_active').order('email', { ascending: true });
  if (error) return NextResponse.json({ message: 'DB hatası' }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: Request) {
  try { await requireAdminOrThrow(); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }
  const body = await req.json().catch(() => ({}));
  const email = body?.email as string | undefined;
  const full_name = body?.full_name as string | undefined;
  const role = body?.role as ValidRole | undefined;
  const password = body?.password as string | undefined;
  if (!email || !full_name || !role || !password) return NextResponse.json({ message: 'email, full_name, role, password gerekli' }, { status: 400 });
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ message: 'Geçersiz rol' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) return NextResponse.json({ message: created.error.message }, { status: 400 });

  const ins = await admin.from('allowed_users').insert({ email, full_name, role, is_active: true });
  if (ins.error) {
    const uid = created.data.user?.id;
    if (uid) await admin.auth.admin.deleteUser(uid);
    return NextResponse.json({ message: ins.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
