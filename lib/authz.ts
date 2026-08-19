import 'server-only';
import { cache } from 'react';
import { getSessionTokenFromCookies, getUserBySessionToken } from '@/lib/auth';
import {
  normalizeRole,
  type AllowedRole,
  type Permission,
  permissionsForRole,
  ALL_PERMISSIONS,
  ROLE_PRIORITY,
} from '@/lib/roles';
import { db } from '@/lib/db';
import { userHasPermission } from '@/lib/permissions';

export type AllowedUser = {
  id: string;
  email: string;
  role: AllowedRole;
  full_name: string | null;
  permissions?: Permission[];
};

export type OwnedResource = {
  owner_user_id?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  sorumlu?: string | null;
};

function authError(code: 'UNAUTHORIZED' | 'FORBIDDEN', status: 401 | 403) {
  return Object.assign(new Error(code), { code, status });
}

// AD session'lar (auth_source = 'active_directory') için authorization kaynağı
// allowed_users.role DEĞİL, login anında session'a yazılan effective_roles
// snapshot'ıdır (multi-group union — bkz. lib/auth/oidc.ts resolveEnterpriseUser).
// Legacy session'lar (effective_roles null) doğal TTL'e kadar allowed_users.role
// compatibility fallback'i kullanmaya devam eder — bu, kararlaştırılan geçiş
// politikasının bir parçasıdır, güvenlik açığı değildir.
async function permissionsForRoleSet(roles: AllowedRole[]): Promise<Permission[]> {
  if (roles.includes('super_admin')) return Array.from(ALL_PERMISSIONS);
  if (!roles.length) return [];
  const result = await db.query(
    `
      select coalesce(array_agg(distinct rp.permission_key) filter (where rp.granted = true), '{}') as permissions
      from public.rbac_roles rr
      left join public.rbac_role_permissions rp on rp.role_key = rr.role_key
      where rr.role_key = any($1) and rr.is_active = true
    `,
    [roles],
  );
  const row = result.rows[0];
  return Array.isArray(row?.permissions)
    ? row.permissions.filter((permission: unknown): permission is Permission => typeof permission === 'string')
    : [];
}

const getAllowedUserOrThrowBase = cache(async (): Promise<AllowedUser> => {
  const sessionToken = await getSessionTokenFromCookies();
  if (!sessionToken) throw authError('UNAUTHORIZED', 401);

  const sessionUser = await getUserBySessionToken(sessionToken);
  if (!sessionUser?.email) throw authError('UNAUTHORIZED', 401);

  const isAdSession = sessionUser.authSource === 'active_directory'
    && Array.isArray(sessionUser.effectiveRoles) && sessionUser.effectiveRoles.length > 0;

  if (isAdSession) {
    const idResult = await db.query(
      `select id, email, full_name, is_active from public.allowed_users where id = $1 limit 1`,
      [sessionUser.id],
    );
    const allowed = idResult.rows[0];
    if (!allowed || !allowed.is_active) throw authError('FORBIDDEN', 403);
    const effectiveRoles = (sessionUser.effectiveRoles ?? [])
      .map((role) => normalizeRole(role))
      .filter((role): role is AllowedRole => Boolean(role));
    if (!effectiveRoles.length) throw authError('FORBIDDEN', 403);
    const primaryRole = effectiveRoles.includes('super_admin')
      ? 'super_admin'
      : effectiveRoles.slice().sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))[0];
    return {
      id: String(allowed.id),
      email: String(allowed.email),
      role: primaryRole,
      full_name: allowed.full_name ? String(allowed.full_name) : null,
      permissions: await permissionsForRoleSet(effectiveRoles),
    };
  }

  // Legacy session compatibility fallback: allowed_users.role tek rol kaynağı.
  let result;
  try {
    result = await db.query(
      `
        select au.id, au.email, au.role, au.full_name, au.is_active,
          coalesce(array_agg(rp.permission_key) filter (where rp.granted = true), '{}') as permissions
        from public.allowed_users au
        left join public.rbac_roles rr on rr.role_key = au.role and rr.is_active = true
        left join public.rbac_role_permissions rp on rp.role_key = rr.role_key
        where au.id = $1
        group by au.id, au.email, au.role, au.full_name, au.is_active
        limit 1
      `,
      [sessionUser.id],
    );
  } catch (error) {
    if ((error as { code?: string })?.code !== '42P01') throw error;
    result = await db.query(
      `select id, email, role, full_name, is_active from public.allowed_users where id = $1 limit 1`,
      [sessionUser.id],
    );
  }

  const allowed = result.rows[0];
  const role = normalizeRole(allowed?.role);
  if (!allowed || !allowed.is_active || !role) throw authError('FORBIDDEN', 403);

  return {
    id: String(allowed.id),
    email: String(allowed.email),
    role,
    full_name: allowed.full_name ? String(allowed.full_name) : null,
    // super_admin daima tam yetkili: DB'deki rbac_role_permissions kaydı
    // yanlışlıkla silinse/eksik seed edilse bile kod seviyesinde sabitlenir.
    permissions: role === 'super_admin'
      ? Array.from(ALL_PERMISSIONS)
      : Array.isArray(allowed.permissions)
        ? allowed.permissions.filter((permission: unknown): permission is Permission => typeof permission === 'string')
        : Array.from(permissionsForRole(role)),
  };
});

function normalizeIdentity(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

export function isResourceOwner(user: AllowedUser, resource: OwnedResource): boolean {
  if (resource.owner_user_id && String(resource.owner_user_id) === user.id) return true;

  const ownerEmail = normalizeIdentity(resource.owner_email);
  if (ownerEmail && ownerEmail === normalizeIdentity(user.email)) return true;

  const ownerName = normalizeIdentity(resource.owner_name ?? resource.sorumlu);
  return Boolean(ownerName && user.full_name && ownerName === normalizeIdentity(user.full_name));
}

export function assertOwnedResourceAccess(args: {
  user: AllowedUser;
  resource: OwnedResource;
  ownPermission: Permission;
  anyPermission: Permission;
}) {
  if (userHasPermission(args.user, args.anyPermission)) return;
  if (userHasPermission(args.user, args.ownPermission) && isResourceOwner(args.user, args.resource)) return;
  throw authError('FORBIDDEN', 403);
}

export async function getSessionEmailOrNull(): Promise<string | null> {
  try {
    return (await getAllowedUserOrThrowBase()).email;
  } catch {
    return null;
  }
}

export async function requireAllowedUserOrThrow() {
  return getAllowedUserOrThrowBase();
}

// Business/API authorization (action-level permission, customer.read/quote.create vb).
// screen.*.view HİÇBİR ZAMAN bu fonksiyonlara karışmaz — API route'ları bunu çağırır,
// data erişim kararı yalnız action permission'a bağlıdır.
export async function requirePermissionOrThrow(permission: Permission) {
  const allowed = await getAllowedUserOrThrowBase();
  if (!userHasPermission(allowed, permission)) throw authError('FORBIDDEN', 403);
  return allowed;
}

export async function requireAnyPermissionOrThrow(permissions: readonly Permission[]) {
  const allowed = await getAllowedUserOrThrowBase();
  if (!permissions.some((permission) => userHasPermission(allowed, permission))) throw authError('FORBIDDEN', 403);
  return allowed;
}

// Ekran görünürlüğü katmanı: SADECE page.tsx server component guard'larında ve nav'da
// kullanılır. API route'larından asla çağrılmaz — business authorization'dan tamamen
// ayrıdır (ekranı görmek ≠ veriyi görmek/değiştirmek).
export async function requireScreenAccessOrThrow(screenPermission: Permission) {
  const allowed = await getAllowedUserOrThrowBase();
  if (!userHasPermission(allowed, screenPermission)) throw authError('FORBIDDEN', 403);
  return allowed;
}

export async function requireAdminOrThrow() {
  return requirePermissionOrThrow('admin.users.manage');
}

export async function requireBackupAccessOrThrow() {
  return requirePermissionOrThrow('admin.backup.execute');
}

export async function requireQuoteCatalogAccessOrThrow() {
  return requirePermissionOrThrow('quote.catalog.manage');
}

export async function requireActivityReadOrThrow() {
  return requirePermissionOrThrow('activity.read');
}

export async function requireActivityCreateOrThrow() {
  return requirePermissionOrThrow('activity.create');
}

export async function requireRequestsAccessOrThrow() {
  return requireAnyPermissionOrThrow(['request.create', 'request.read.own', 'request.read.all']);
}

export async function requireSystemParametersAccessOrThrow() {
  return requirePermissionOrThrow('admin.parameters.manage');
}

export async function requireCrmAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!userHasPermission(allowed, 'customer.read')) throw authError('FORBIDDEN', 403);
  return allowed;
}

export async function requireReportsAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  // Mevcut rapor uçları şirket geneli toplulaştırma yapıyor. Satır kapsamı
  // uygulanana kadar own/team yetkisini burada kabul etmek veri sızıntısı olur.
  if (!userHasPermission(allowed, 'report.read.all')) throw authError('FORBIDDEN', 403);
  return allowed;
}

export async function requireUsersAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!userHasPermission(allowed, 'admin.users.manage')) throw authError('FORBIDDEN', 403);
  return allowed;
}

export async function requireIdentityAccessOrThrow() {
  return requirePermissionOrThrow('admin.identity.manage');
}

// AD grup eşlemesinden türetilmiş rastgele bir rol için RBAC izin setini DB'den
// (rbac_role_permissions) hesaplar — Etkili Kullanıcı Yetkileri görünümünün,
// gerçek oturum açan kullanıcının aldığı yetkilerle birebir aynı kaynaktan
// (getAllowedUserOrThrowBase ile aynı sorgu mantığı) hesaplanmasını garanti eder.
export async function resolveRolePermissionsFromDb(role: AllowedRole): Promise<Permission[]> {
  if (role === 'super_admin') return Array.from(ALL_PERMISSIONS);
  const result = await db.query(
    `
      select coalesce(array_agg(rp.permission_key) filter (where rp.granted = true), '{}') as permissions
      from public.rbac_roles rr
      left join public.rbac_role_permissions rp on rp.role_key = rr.role_key
      where rr.role_key = $1 and rr.is_active = true
    `,
    [role],
  );
  const row = result.rows[0];
  return Array.isArray(row?.permissions)
    ? row.permissions.filter((permission: unknown): permission is Permission => typeof permission === 'string')
    : [];
}

export { isAdminLike } from '@/lib/roles';
export { userHasPermission } from '@/lib/permissions';
