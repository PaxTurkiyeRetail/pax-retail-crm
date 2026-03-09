export type AllowedRole =
  | 'super_admin'
  | 'account_manager'
  | 'itsm'
  | 'admin'
  | 'user';

export function normalizeRole(role: string | null | undefined): AllowedRole | null {
  if (!role) return null;
  const value = String(role).trim().toLowerCase();
  if (value === 'super_admin' || value === 'account_manager' || value === 'itsm' || value === 'admin' || value === 'user') {
    return value as AllowedRole;
  }
  return null;
}

export function isAdminLike(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function canViewUsers(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function canViewCRM(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin' || normalized === 'account_manager' || normalized === 'user';
}

export function canViewActivities(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null;
}

export function canViewReports(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin' || normalized === 'account_manager' || normalized === 'itsm';
}
