export type AllowedRole =
  | 'super_admin'
  | 'account_manager'
  | 'itsm'
  | 'admin'
  | 'user';

export function normalizeRole(role: string | null | undefined): AllowedRole | null {
  if (!role) return null;
  const value = String(role).trim().toLowerCase();
  const normalized = value.replace(/[\s-]+/g, '_');

  if (normalized === 'super_admin' || normalized === 'superadmin') return 'super_admin';
  if (normalized === 'account_manager' || normalized === 'accountmanager') return 'account_manager';
  if (normalized === 'itsm') return 'itsm';
  if (normalized === 'admin' || normalized === 'administrator') return 'admin';
  if (normalized === 'user' || normalized === 'kullanici' || normalized === 'kullanıcı') return 'user';
  return null;
}

export function isAdminLike(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function canManageRequests(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null;
}

export function canViewUsers(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function canViewCRM(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin' || normalized === 'account_manager' || normalized === 'user' || normalized === 'itsm';
}

export function canViewActivities(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null;
}

export function canViewReports(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin' || normalized === 'account_manager' || normalized === 'itsm' || normalized === 'user';
}

export function canCreateTechnicalActivities(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin' || normalized === 'itsm';
}
