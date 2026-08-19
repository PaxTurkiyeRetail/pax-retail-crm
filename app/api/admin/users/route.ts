import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Kullanıcı create/delete/password/manuel rol atama akışları kaldırıldı.
// Roller yalnız AD grup üyeliğinden türetilir (auth_group_role_mappings,
// lib/auth/oidc.ts). Bu ekran sadece görüntüleme + is_active (emergency block)
// için var; allowed_users.role ve secondary_roles buradan asla değiştirilmez.
export async function GET() {
  try {
    await requireAdminOrThrow();
    const result = await db.query(`
      select
        au.email, au.full_name, au.role, au.secondary_roles, au.is_active,
        au.weekly_target_sales_physical,
        au.weekly_target_sales_online,
        au.weekly_target_sales_phone,
        au.weekly_target_sales_email,
        au.weekly_target_technical_physical,
        au.weekly_target_technical_online,
        au.weekly_target_total_activities,
        au.weekly_target_unique_customers,
        ai.provider as auth_provider,
        ai.tenant_id as auth_tenant_id,
        ai.last_login_at as auth_last_login_at
      from public.allowed_users au
      left join lateral (
        select provider, tenant_id, last_login_at
        from public.auth_identities
        where user_id = au.id
        order by last_login_at desc nulls last
        limit 1
      ) ai on true
      order by coalesce(au.full_name, au.email) asc
    `);
    return NextResponse.json({ users: result.rows }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
