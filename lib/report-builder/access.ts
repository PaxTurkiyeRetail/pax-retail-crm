// Rapor builder yetki kararları (saf). Business authorization action permission'a bağlıdır;
// screen.* yalnız sayfa guard'ında kullanılır (lib/authz.ts notu ile aynı ayrım).
import type { Permission } from '@/lib/roles';
import type { DatasetDef } from '@/lib/report-builder/datasets';
import type { RowScope } from '@/lib/report-builder/types';

export type ReportUser = {
  id: string;
  email: string;
  full_name: string | null;
  permissions: readonly Permission[];
};

export const REPORT_BUILDER_READ: readonly Permission[] = ['report.read.all', 'report.read.team', 'report.read.own'];

export function canUseReportBuilder(user: Pick<ReportUser, 'permissions'>) {
  return REPORT_BUILDER_READ.some((p) => user.permissions.includes(p));
}

export function canAccessDataset(user: Pick<ReportUser, 'permissions'>, dataset: Pick<DatasetDef, 'permission' | 'requiredPermissions'>) {
  return canUseReportBuilder(user) && user.permissions.includes(dataset.permission) && (dataset.requiredPermissions ?? []).every(p => user.permissions.includes(p));
}

/**
 * report.read.all → tüm satırlar. report.read.team → takım modeli henüz yok; güvenli tarafta
 * "own" uygulanır (DESIGN.md §3.4). report.read.own → yalnız sahibi olduğu kayıtlar.
 */
export function resolveRowScope(user: ReportUser): RowScope | null {
  if (user.permissions.includes('report.read.all')) return { kind: 'all' };
  if (user.permissions.includes('report.read.team') || user.permissions.includes('report.read.own')) {
    return { kind: 'own', userId: user.id, email: user.email, fullName: user.full_name };
  }
  return null;
}

/** Rapor tanımı paylaşım/düzenleme kuralları. */
export type DefinitionAccessRow = {
  owner_user_id: string;
  visibility: 'private' | 'roles' | 'everyone';
  shared_roles: string[] | null;
};

export function canViewDefinition(user: ReportUser & { roles?: readonly string[] }, row: DefinitionAccessRow) {
  if (row.owner_user_id === user.id) return true;
  if (user.permissions.includes('admin.users.manage')) return true;
  if (row.visibility === 'everyone') return true;
  if (row.visibility === 'roles') return (row.shared_roles ?? []).some((r) => (user.roles ?? []).includes(r));
  return false;
}

// Migration'da seed edilen yeni anahtarlar (lib/roles.ts Permission union'ına eklenmedi —
// mevcut dosyalara dokunulmaması için string olarak kontrol edilir; admin.users.manage yedektir).
export const REPORT_DESIGN_PERMISSION = 'report.builder.design';
export const LETTERHEAD_MANAGE_PERMISSION = 'report.letterhead.manage';
const hasRaw = (user: Pick<ReportUser, 'permissions'>, key: string) => (user.permissions as readonly string[]).includes(key);

/** Sayfa tasarımcısında düzenleme modu (görüntüleme yalnız canUseReportBuilder ister). */
export function canDesignPages(user: Pick<ReportUser, 'permissions'>) {
  return canUseReportBuilder(user) && (hasRaw(user, REPORT_DESIGN_PERMISSION) || hasRaw(user, 'admin.users.manage'));
}

export function canManageLetterheads(user: Pick<ReportUser, 'permissions'>) {
  return hasRaw(user, LETTERHEAD_MANAGE_PERMISSION) || hasRaw(user, 'admin.users.manage');
}

export function canEditDefinition(user: ReportUser, row: Pick<DefinitionAccessRow, 'owner_user_id'>) {
  return row.owner_user_id === user.id || user.permissions.includes('admin.users.manage');
}
