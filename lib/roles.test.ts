import { describe, expect, it } from 'vitest';
import {
  canManageParameters,
  canManageRequests,
  canViewCRM,
  hasPermission,
  normalizeRole,
} from './roles';

describe('enterprise role permissions', () => {
  it('fails closed for unknown and missing roles', () => {
    expect(normalizeRole('manager')).toBeNull();
    expect(hasPermission('manager', 'customer.read')).toBe(false);
    expect(hasPermission(undefined, 'request.read.own')).toBe(false);
  });

  it('keeps basic users inside their own request scope', () => {
    expect(hasPermission('user', 'request.create')).toBe(true);
    expect(hasPermission('user', 'request.read.own')).toBe(true);
    expect(hasPermission('user', 'request.read.all')).toBe(false);
    expect(canManageRequests('user')).toBe(false);
    expect(canViewCRM('user')).toBe(false);
  });

  it('preserves account manager read visibility while writes stay scoped', () => {
    expect(canViewCRM('account_manager')).toBe(true);
    expect(hasPermission('account_manager', 'customer.update.own')).toBe(true);
    expect(hasPermission('account_manager', 'customer.update.any')).toBe(false);
    expect(hasPermission('account_manager', 'quote.status.any')).toBe(false);
    expect(hasPermission('account_manager', 'report.read')).toBe(false);
    expect(hasPermission('account_manager', 'customer.read.any')).toBe(true);
    expect(hasPermission('account_manager', 'quote.read.any')).toBe(true);
    expect(hasPermission('account_manager', 'report.read.all')).toBe(true);
  });

  it('preserves ITSM read access while keeping user administration separated', () => {
    expect(canManageRequests('itsm')).toBe(true);
    expect(canManageParameters('itsm')).toBe(true);
    expect(canViewCRM('itsm')).toBe(true);
    expect(hasPermission('itsm', 'admin.users.manage')).toBe(false);
    expect(hasPermission('itsm', 'activity.read.any')).toBe(true);
  });

  it('separates catalog management from ordinary quote access', () => {
    expect(hasPermission('admin', 'quote.catalog.manage')).toBe(true);
    expect(hasPermission('account_manager', 'quote.catalog.manage')).toBe(false);
    expect(hasPermission('account_manager', 'quote.create')).toBe(true);
  });

  it('keeps database backup available to current admin roles', () => {
    expect(hasPermission('super_admin', 'admin.backup.execute')).toBe(true);
    expect(hasPermission('admin', 'admin.backup.execute')).toBe(true);
  });

  it('keeps global reports behind an explicit scope permission', () => {
    expect(hasPermission('admin', 'report.read.all')).toBe(true);
    expect(hasPermission('super_admin', 'report.read.all')).toBe(true);
    expect(hasPermission('itsm', 'report.read.all')).toBe(true);
    expect(hasPermission('account_manager', 'report.read.all')).toBe(true);
  });

  it('reserves AD/OIDC activation for super admins', () => {
    expect(hasPermission('super_admin', 'admin.identity.manage')).toBe(true);
    expect(hasPermission('admin', 'admin.identity.manage')).toBe(false);
    expect(hasPermission('itsm', 'admin.identity.manage')).toBe(false);
  });
});
