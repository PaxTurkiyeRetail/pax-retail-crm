import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireIdentityAccessOrThrow, resolveRolePermissionsFromDb } from '@/lib/authz';
import { apiErrorResponse, ApiError } from '@/lib/http/api-error';
import { getUserGroupIds } from '@/lib/auth/graph';
import { normalizeRole, ROLE_PRIORITY, ALL_PERMISSIONS, type AllowedRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireIdentityAccessOrThrow();
    const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase();
    if (!email) throw new ApiError('VALIDATION_ERROR', 'email parametresi zorunlu.', 400);

    const userResult = await db.query(
      `select id, email, role as stored_role from public.allowed_users where lower(email) = $1 limit 1`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) throw new ApiError('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', 404);

    const identityResult = await db.query(
      `select tenant_id, subject, object_id, last_login_at from public.auth_identities
       where user_id = $1 and provider = 'active_directory'
       order by last_login_at desc nulls last
       limit 1`,
      [user.id],
    );
    const identity = identityResult.rows[0];

    if (!identity?.tenant_id || !identity?.object_id) {
      return NextResponse.json({
        email: user.email,
        adLinked: false,
        groups: [],
        matchedMappings: [],
        effectiveRoles: [],
        permissions: [],
        note: 'Bu kullanıcı için AD kimlik eşleşmesi bulunamadı (henüz AD ile giriş yapmamış olabilir, ya da eski subject-only kayıt object_id içermiyor — tekrar giriş gerekir).',
      });
    }

    let groupIds: string[] = [];
    let graphError: string | null = null;
    try {
      groupIds = await getUserGroupIds(identity.tenant_id, identity.object_id);
    } catch (error) {
      graphError = error instanceof Error ? error.message : 'Graph sorgusu başarısız.';
    }

    let matchedMappings: Array<{ id: string; group_id: string; role: string }> = [];
    if (groupIds.length) {
      const mappingResult = await db.query(
        `select id, group_id, role from public.auth_group_role_mappings
         where tenant_id = $1 and group_id = any($2) and is_active = true`,
        [identity.tenant_id, groupIds],
      );
      matchedMappings = mappingResult.rows;
    }

    // Multi-group union: birden fazla role eşlenen kullanıcı, eşleşen bütün rollerin
    // permission union'ını alır — tek "bestRole" modeli authorization için kullanılmaz
    // (bkz. lib/auth/oidc.ts resolveEnterpriseUser ile birebir aynı mantık).
    const effectiveRoles = Array.from(new Set(
      matchedMappings.map((row) => normalizeRole(row.role)).filter((r): r is AllowedRole => Boolean(r)),
    )).sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);

    const permissions = effectiveRoles.includes('super_admin')
      ? Array.from(ALL_PERMISSIONS)
      : Array.from(new Set((await Promise.all(effectiveRoles.map((role) => resolveRolePermissionsFromDb(role)))).flat()));

    return NextResponse.json({
      email: user.email,
      adLinked: true,
      tenantId: identity.tenant_id,
      lastLoginAt: identity.last_login_at,
      groups: groupIds,
      matchedMappings,
      effectiveRoles,
      permissions,
      storedRole: user.stored_role,
      roleDrift: effectiveRoles.length > 0 && !effectiveRoles.includes(normalizeRole(user.stored_role) as AllowedRole),
      graphError,
    });
  } catch (error) {
    return apiErrorResponse(error, 'Etkili yetkiler hesaplanamadı.');
  }
}
