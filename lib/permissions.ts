import { hasPermission, type AllowedRole, type Permission } from '@/lib/roles';

export type PermissionSubject = {
  role: AllowedRole;
  permissions?: readonly Permission[];
};

export function userHasPermission(user: PermissionSubject, permission: Permission) {
  return user.permissions ? user.permissions.includes(permission) : hasPermission(user.role, permission);
}
