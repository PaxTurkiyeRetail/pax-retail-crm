import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

async function findAuthUserIdByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 10; i++) {
    const res = await admin.auth.admin.listUsers({ page, perPage });
    if (res.error) return null;
    const found = res.data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;
    if (!res.data.users || res.data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

const VALID_ROLES = ['super_admin', 'account_manager', 'itsm', 'admin', 'user'] as const;

export async function PATCH(_req: Request, ctx: { params: Promise<{ email: string }> }) {
  try { await requireAdminOrThrow(); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }

  const { email } = await ctx.params;
  const body = await _req.json().catch(() => ({}));
  const payload: Record<string, unknown> = {};
  if (typeof body?.is_active === 'boolean') payload.is_active = body.is_active;
  if (typeof body?.full_name === 'string' && body.full_name.trim()) payload.full_name = body.full_name.trim();
  if (typeof body?.role === 'string') {
    if (!VALID_ROLES.includes(body.role as any)) return NextResponse.json({ message: 'Geçersiz rol' }, { status: 400 });
    payload.role = body.role;
  }
  if (!Object.keys(payload).length) return NextResponse.json({ message: 'Güncellenecek alan yok' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const upd = await admin.from('allowed_users').update(payload).eq('email', email);
  if (upd.error) return NextResponse.json({ message: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ email: string }> }) {
  try { await requireAdminOrThrow(); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }
  const { email } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const del = await admin.from('allowed_users').delete().eq('email', email);
  if (del.error) return NextResponse.json({ message: del.error.message }, { status: 400 });
  const uid = await findAuthUserIdByEmail(admin, email);
  if (uid) {
    const d2 = await admin.auth.admin.deleteUser(uid);
    if (d2.error) return NextResponse.json({ message: 'Allowlist silindi ama Auth user silinemedi: ' + d2.error.message }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
