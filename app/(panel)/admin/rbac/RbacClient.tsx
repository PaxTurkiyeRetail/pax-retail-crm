'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type Role = { role_key: string; label: string; description: string | null; is_active: boolean };
type PermissionDef = { permission_key: string; module_key: string; label: string; description: string | null };
type Mapping = { role_key: string; permission_key: string; granted: boolean };

const EDITABLE_ROLES = ['admin', 'account_manager', 'itsm', 'user'];

const MODULE_LABELS: Record<string, string> = {
  screen: 'Ekran Görünürlüğü (rol hangi menüyü görür)',
  admin: 'Yönetim İşlemleri',
  crm: 'Müşteriler',
  activity: 'Aktiviteler',
  quote: 'Teklifler',
  forecast: 'Forecast',
  report: 'Raporlar',
  request: 'Talepler',
};

const MODULE_ORDER = ['screen', 'admin', 'crm', 'activity', 'quote', 'forecast', 'report', 'request'];

export default function RbacClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/rbac', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? 'Yüklenemedi.');
      setRoles(data.roles ?? []);
      setPermissions(data.permissions ?? []);
      setMappings(data.mappings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grantedSet = useMemo(() => {
    const set = new Set<string>();
    for (const mapping of mappings) {
      if (mapping.granted) set.add(`${mapping.role_key}:${mapping.permission_key}`);
    }
    return set;
  }, [mappings]);

  const modules = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const permission of permissions) {
      const list = map.get(permission.module_key) ?? [];
      list.push(permission);
      map.set(permission.module_key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = MODULE_ORDER.indexOf(a);
      const bi = MODULE_ORDER.indexOf(b);
      return (ai === -1 ? MODULE_ORDER.length : ai) - (bi === -1 ? MODULE_ORDER.length : bi);
    });
  }, [permissions]);

  const editableRoles = roles.filter((role) => EDITABLE_ROLES.includes(role.role_key));

  async function toggle(roleKey: string, permissionKey: string, nextGranted: boolean) {
    const key = `${roleKey}:${permissionKey}`;
    setPendingKey(key);
    const previous = new Set(grantedSet);
    setMappings((current) => {
      const withoutEntry = current.filter((m) => !(m.role_key === roleKey && m.permission_key === permissionKey));
      return [...withoutEntry, { role_key: roleKey, permission_key: permissionKey, granted: nextGranted }];
    });
    try {
      const response = await fetch('/api/admin/rbac', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleKey, permissionKey, granted: nextGranted }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? 'Güncellenemedi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi.');
      setMappings((current) => {
        const withoutEntry = current.filter((m) => !(m.role_key === roleKey && m.permission_key === permissionKey));
        return [...withoutEntry, { role_key: roleKey, permission_key: permissionKey, granted: previous.has(key) }];
      });
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) return <div className="pax-card">Yükleniyor...</div>;

  return (
    <div className="pax-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error ? <div style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Yetki</th>
              {editableRoles.map((role) => (
                <th key={role.role_key} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                  {role.label}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                super_admin
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map(([moduleKey, modulePermissions]) => (
              <Fragment key={moduleKey}>
                <tr>
                  <td
                    colSpan={editableRoles.length + 2}
                    style={{ padding: '10px 12px', background: '#f9fafb', fontWeight: 700, fontSize: 13, color: '#374151' }}
                  >
                    {MODULE_LABELS[moduleKey] ?? moduleKey}
                  </td>
                </tr>
                {modulePermissions.map((permission) => (
                  <tr key={permission.permission_key}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 600 }}>{permission.label}</div>
                    </td>
                    {editableRoles.map((role) => {
                      const key = `${role.role_key}:${permission.permission_key}`;
                      const granted = grantedSet.has(key);
                      const isPending = pendingKey === key;
                      return (
                        <td key={key} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                          <input
                            type="checkbox"
                            checked={granted}
                            disabled={isPending}
                            onChange={(event) => toggle(role.role_key, permission.permission_key, event.target.checked)}
                          />
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', color: '#9ca3af' }}>
                      <input type="checkbox" checked disabled />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
