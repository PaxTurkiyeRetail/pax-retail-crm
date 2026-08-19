export type AllowedRole =
  | 'super_admin'
  | 'account_manager'
  | 'itsm'
  | 'admin'
  | 'user';

export type Permission =
  | 'admin.users.manage'
  | 'admin.parameters.manage'
  | 'admin.backup.execute'
  | 'admin.rbac.manage'
  | 'admin.identity.manage'
  | 'customer.read'
  | 'customer.read.any'
  | 'customer.create'
  | 'customer.update.own'
  | 'customer.update.any'
  | 'customer.assign'
  | 'customer.classification.manage'
  | 'activity.read'
  | 'activity.read.any'
  | 'activity.create'
  | 'activity.update.own'
  | 'activity.update.any'
  | 'activity.technical.create'
  | 'quote.read'
  | 'quote.read.any'
  | 'quote.create'
  | 'quote.update.own'
  | 'quote.update.any'
  | 'quote.status.own'
  | 'quote.status.any'
  | 'quote.catalog.manage'
  | 'forecast.read'
  | 'forecast.read.any'
  | 'forecast.write.own'
  | 'forecast.write.any'
  | 'report.read'
  | 'report.read.own'
  | 'report.read.team'
  | 'report.read.all'
  | 'request.create'
  | 'request.read.own'
  | 'request.read.all'
  | 'request.comment.own'
  | 'request.comment.all'
  | 'request.manage'
  | 'screen.crm.dashboard.view'
  | 'screen.crm.customers.view'
  | 'screen.crm.activities.view'
  | 'screen.crm.quotes.view'
  | 'screen.crm.forecast.view'
  | 'screen.crm.blocker_impact.view'
  | 'screen.crm.sales_radar.view'
  | 'screen.reports.view'
  | 'screen.requests.view'
  | 'screen.admin.users.view'
  | 'screen.admin.parameters.view'
  | 'screen.admin.identity.view'
  | 'screen.admin.rbac.view'
  | 'screen.admin.backup.view'
  | 'screen.crm.nova_core.view'
  | 'screen.crm.sales_process.view'
  | 'screen.crm.customer_status_guide.view'
  | 'screen.crm.approvals.view'
  | 'screen.reports.user_activity.view';

export const ALL_PERMISSIONS: readonly Permission[] = [
  'admin.users.manage',
  'admin.parameters.manage',
  'admin.backup.execute',
  'admin.rbac.manage',
  'admin.identity.manage',
  'customer.read',
  'customer.read.any',
  'customer.create',
  'customer.update.own',
  'customer.update.any',
  'customer.assign',
  'customer.classification.manage',
  'activity.read',
  'activity.read.any',
  'activity.create',
  'activity.update.own',
  'activity.update.any',
  'activity.technical.create',
  'quote.read',
  'quote.read.any',
  'quote.create',
  'quote.update.own',
  'quote.update.any',
  'quote.status.own',
  'quote.status.any',
  'quote.catalog.manage',
  'forecast.read',
  'forecast.read.any',
  'forecast.write.own',
  'forecast.write.any',
  'report.read',
  'report.read.own',
  'report.read.team',
  'report.read.all',
  'request.create',
  'request.read.own',
  'request.read.all',
  'request.comment.own',
  'request.comment.all',
  'request.manage',
  'screen.crm.dashboard.view',
  'screen.crm.customers.view',
  'screen.crm.activities.view',
  'screen.crm.quotes.view',
  'screen.crm.forecast.view',
  'screen.crm.blocker_impact.view',
  'screen.crm.sales_radar.view',
  'screen.reports.view',
  'screen.requests.view',
  'screen.admin.users.view',
  'screen.admin.parameters.view',
  'screen.admin.identity.view',
  'screen.admin.rbac.view',
  'screen.admin.backup.view',
  'screen.crm.nova_core.view',
  'screen.crm.sales_process.view',
  'screen.crm.customer_status_guide.view',
  'screen.crm.approvals.view',
  'screen.reports.user_activity.view',
];

const ROLE_PERMISSIONS: Readonly<Record<AllowedRole, ReadonlySet<Permission>>> = {
  super_admin: new Set(ALL_PERMISSIONS),
  admin: new Set(ALL_PERMISSIONS.filter((permission) => ![
    'admin.rbac.manage', 'admin.identity.manage',
    'screen.admin.rbac.view', 'screen.admin.identity.view',
  ].includes(permission))),
  account_manager: new Set([
    'customer.read',
    'customer.read.any',
    'customer.create',
    'customer.update.own',
    'quote.read',
    'quote.read.any',
    'quote.create',
    'quote.update.own',
    'quote.status.own',
    'activity.read',
    'activity.read.any',
    'activity.create',
    'activity.update.own',
    'forecast.read',
    'forecast.write.own',
    'report.read.all',
    'request.create',
    'request.read.own',
    'request.comment.own',
    'screen.crm.dashboard.view',
    'screen.crm.customers.view',
    'screen.crm.activities.view',
    'screen.crm.quotes.view',
    'screen.crm.forecast.view',
    'screen.crm.blocker_impact.view',
    'screen.crm.sales_radar.view',
    'screen.reports.view',
    'screen.requests.view',
    'screen.crm.nova_core.view',
    'screen.crm.sales_process.view',
    'screen.crm.customer_status_guide.view',
  ]),
  itsm: new Set([
    'admin.parameters.manage',
    'customer.read',
    'customer.read.any',
    'activity.read',
    'activity.read.any',
    'activity.create',
    'activity.update.any',
    'activity.technical.create',
    'quote.read',
    'quote.read.any',
    'forecast.read',
    'forecast.read.any',
    'report.read.all',
    'request.create',
    'request.read.all',
    'request.comment.all',
    'request.manage',
    'screen.crm.dashboard.view',
    'screen.crm.customers.view',
    'screen.crm.activities.view',
    'screen.crm.quotes.view',
    'screen.crm.forecast.view',
    'screen.reports.view',
    'screen.requests.view',
    'screen.admin.parameters.view',
    'screen.crm.nova_core.view',
    'screen.crm.sales_process.view',
    'screen.crm.customer_status_guide.view',
  ]),
  user: new Set([
    'request.create',
    'request.read.own',
    'request.comment.own',
    'screen.requests.view',
  ]),
};

export const ROLE_PRIORITY: Record<AllowedRole, number> = {
  user: 1,
  account_manager: 2,
  itsm: 3,
  admin: 4,
  super_admin: 5,
};

export function normalizeRole(role: string | null | undefined): AllowedRole | null {
  if (!role) return null;
  const value = String(role).trim().toLocaleLowerCase('tr-TR');
  const normalized = value.replace(/[\s-]+/g, '_');

  if (normalized === 'super_admin' || normalized === 'superadmin') return 'super_admin';
  if (normalized === 'account_manager' || normalized === 'accountmanager') return 'account_manager';
  if (normalized === 'itsm') return 'itsm';
  if (normalized === 'admin' || normalized === 'administrator') return 'admin';
  if (normalized === 'user' || normalized === 'kullanici' || normalized === 'kullanıcı') return 'user';
  return null;
}

export function permissionsForRole(role: string | null | undefined): ReadonlySet<Permission> {
  const normalized = normalizeRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized] : new Set<Permission>();
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}

export function hasAnyPermission(role: string | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function isAdminLike(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'super_admin' || normalized === 'admin';
}

export function canManageRequests(role: string | null | undefined): boolean {
  return hasPermission(role, 'request.manage');
}

export function canViewUsers(role: string | null | undefined): boolean {
  return hasPermission(role, 'admin.users.manage');
}

export function canManageParameters(role: string | null | undefined): boolean {
  return hasPermission(role, 'admin.parameters.manage');
}

export function canViewCRM(role: string | null | undefined): boolean {
  return hasPermission(role, 'customer.read');
}

export function canViewActivities(role: string | null | undefined): boolean {
  return hasPermission(role, 'activity.read');
}

export function canViewReports(role: string | null | undefined): boolean {
  return hasAnyPermission(role, ['report.read.own', 'report.read.team', 'report.read.all']);
}

export function canCreateTechnicalActivities(role: string | null | undefined): boolean {
  return hasPermission(role, 'activity.technical.create');
}
