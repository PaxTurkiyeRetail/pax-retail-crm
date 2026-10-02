'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { SCREEN_RULES, screenAccess, type ScreenRule } from '@/lib/screen-access-shared';

type Role = { role_key: string; label: string; description: string | null; is_active: boolean };
type PermissionDef = { permission_key: string; module_key: string; label: string; description: string | null };
type Mapping = { role_key: string; permission_key: string; granted: boolean };

const EDITABLE_ROLES = ['admin', 'account_manager', 'itsm', 'user'];

const MODULE_LABELS: Record<string, string> = {
  screen: 'Ekran Görünürlüğü',
  admin: 'Yönetim İşlemleri',
  crm: 'Müşteriler',
  activity: 'Aktiviteler',
  quote: 'Teklifler',
  forecast: 'Forecast',
  report: 'Raporlar',
  request: 'Talepler',
};

const MODULE_ORDER = ['screen', 'admin', 'crm', 'activity', 'quote', 'forecast', 'report', 'request'];

type Tab = 'screens' | 'matrix';

export default function RbacClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('screens');
  const [query, setQuery] = useState('');

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

  const permissionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of permissions) map.set(p.permission_key, p.label);
    return (key: string) => map.get(key) ?? key;
  }, [permissions]);

  const modules = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const map = new Map<string, PermissionDef[]>();
    for (const permission of permissions) {
      if (q && !`${permission.label} ${permission.permission_key} ${permission.description ?? ''}`.toLocaleLowerCase('tr').includes(q)) continue;
      const list = map.get(permission.module_key) ?? [];
      list.push(permission);
      map.set(permission.module_key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = MODULE_ORDER.indexOf(a);
      const bi = MODULE_ORDER.indexOf(b);
      return (ai === -1 ? MODULE_ORDER.length : ai) - (bi === -1 ? MODULE_ORDER.length : bi);
    });
  }, [permissions, query]);

  const editableRoles = roles.filter((role) => EDITABLE_ROLES.includes(role.role_key));
  const has = (roleKey: string) => (permission: string) => grantedSet.has(`${roleKey}:${permission}`);

  async function setGrant(roleKey: string, permissionKey: string, nextGranted: boolean) {
    const key = `${roleKey}:${permissionKey}`;
    const previous = grantedSet.has(key);
    setMappings((current) => [
      ...current.filter((m) => !(m.role_key === roleKey && m.permission_key === permissionKey)),
      { role_key: roleKey, permission_key: permissionKey, granted: nextGranted },
    ]);
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
      setMappings((current) => [
        ...current.filter((m) => !(m.role_key === roleKey && m.permission_key === permissionKey)),
        { role_key: roleKey, permission_key: permissionKey, granted: previous },
      ]);
      throw err;
    }
  }

  async function toggle(roleKey: string, permissionKey: string, nextGranted: boolean) {
    const key = `${roleKey}:${permissionKey}`;
    setPendingKey(key);
    try {
      await setGrant(roleKey, permissionKey, nextGranted);
    } catch {
      /* hata state'te */
    } finally {
      setPendingKey(null);
    }
  }

  // Ekran hücresi: görünüyorsa ekran (screen.*) yetkisini kaldırır; görünmüyorsa eksik yetkileri verir.
  async function toggleScreen(role: Role, rule: ScreenRule) {
    const access = screenAccess(rule, has(role.role_key));
    const shared = SCREEN_RULES.filter((r) => r !== rule && r.all.some((p) => p.startsWith('screen.') && rule.all.includes(p)));
    let changes: string[];
    let grant: boolean;
    if (access.visible) {
      changes = rule.all.filter((p) => p.startsWith('screen.'));
      grant = false;
    } else {
      changes = access.missing;
      grant = true;
    }
    const lines = changes.map((p) => `• ${permissionLabel(p)} (${p})`).join('\n');
    const sharedNote = !grant && shared.length ? `\n\nAynı ekran yetkisini kullanan: ${shared.map((r) => r.label).join(', ')} — onlar da kapanır.` : '';
    const message = `${role.label} rolü için "${rule.label}" ekranı ${grant ? 'AÇILACAK' : 'KAPATILACAK'}.\n\n${grant ? 'Verilecek' : 'Kaldırılacak'} yetkiler:\n${lines}${sharedNote}`;
    if (!window.confirm(message)) return;
    const key = `${role.role_key}:screen:${rule.label}`;
    setPendingKey(key);
    try {
      for (const p of changes) await setGrant(role.role_key, p, grant);
    } catch {
      /* hata state'te */
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) return <div className="tw-card p-5">Yükleniyor...</div>;

  const screenGroups = Array.from(new Set(SCREEN_RULES.map((r) => r.group)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tw-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'screens'} className={`tw-tab${tab === 'screens' ? ' tw-tab-active' : ''}`} onClick={() => setTab('screens')}>
            Kim Neyi Görür
          </button>
          <button type="button" role="tab" aria-selected={tab === 'matrix'} className={`tw-tab${tab === 'matrix' ? ' tw-tab-active' : ''}`} onClick={() => setTab('matrix')}>
            Detaylı Yetki Matrisi
          </button>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'matrix' ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Yetki ara..."
              className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-[13px] text-text outline-none focus:border-brand"
            />
          ) : null}
          <button type="button" className="tw-btn" onClick={load}>Yenile</button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">{error}</div>
      ) : null}

      {tab === 'screens' ? (
        <div className="tw-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-[13px] text-text-3">
            Her rolün sol menüde hangi ekranı gördüğü. Bir ekranın görünmesi için <b className="text-text-2">ekran yetkisi</b> ve{' '}
            <b className="text-text-2">işlem yetkisi</b> birlikte gerekir. Hücreye tıklayarak ekranı açıp kapatabilirsiniz.
          </div>
          <div className="overflow-x-auto">
            <table className="tw-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[34%]">Ekran</th>
                  {editableRoles.map((role) => (
                    <th key={role.role_key} className="text-center!">
                      {role.label}
                      <div className="mt-0.5 text-[10px] font-medium tracking-normal normal-case text-text-4">
                        {SCREEN_RULES.filter((r) => screenAccess(r, has(role.role_key)).visible).length}/{SCREEN_RULES.length} ekran
                      </div>
                    </th>
                  ))}
                  <th className="text-center!">Süper Admin</th>
                </tr>
              </thead>
              <tbody>
                {screenGroups.map((group) => (
                  <Fragment key={group}>
                    <tr>
                      <td colSpan={editableRoles.length + 2} className="bg-surface-2 py-1.5! text-[11px] font-bold tracking-wide text-text-3 uppercase">
                        {group}
                      </td>
                    </tr>
                    {SCREEN_RULES.filter((r) => r.group === group).map((rule) => (
                      <tr key={rule.label}>
                        <td>
                          <div className="font-semibold text-text">{rule.label}</div>
                          <div className="mt-0.5 text-[11px] text-text-4">
                            {[...rule.all, ...(rule.anyOf?.length ? [rule.anyOf.join(' / ')] : [])].map((p) => permissionLabel(p)).join(' + ')}
                          </div>
                          {rule.note ? <div className="mt-0.5 text-[11px] text-brand">{rule.note}</div> : null}
                        </td>
                        {editableRoles.map((role) => {
                          const access = screenAccess(rule, has(role.role_key));
                          const busy = pendingKey === `${role.role_key}:screen:${rule.label}`;
                          return (
                            <td key={role.role_key} className="text-center">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleScreen(role, rule)}
                                title={access.visible ? 'Görüyor — kapatmak için tıkla' : `Eksik: ${access.missing.map(permissionLabel).join(', ')}`}
                                className={`inline-flex h-7 min-w-[74px] cursor-pointer items-center justify-center gap-1 rounded-md border px-2 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                                  access.visible
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'border-border bg-surface text-text-4 hover:border-brand hover:text-brand'
                                }`}
                              >
                                {busy ? '...' : access.visible ? '✓ Görür' : '— Görmez'}
                              </button>
                              {!access.visible && access.missing.length < rule.all.length + (rule.anyOf?.length ? 1 : 0) ? (
                                <div className="mt-1 text-[10px] text-amber-600">Eksik: {access.missing.map(permissionLabel).join(', ')}</div>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="text-center text-[12px] font-semibold text-emerald-700">✓ Görür</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="tw-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tw-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[40%]">Yetki</th>
                  {editableRoles.map((role) => (
                    <th key={role.role_key} className="text-center!">
                      {role.label}
                      <div className="mt-0.5 text-[10px] font-medium tracking-normal normal-case text-text-4">
                        {permissions.filter((p) => grantedSet.has(`${role.role_key}:${p.permission_key}`)).length}/{permissions.length}
                      </div>
                    </th>
                  ))}
                  <th className="text-center!">Süper Admin</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={editableRoles.length + 2} className="py-6 text-center text-text-4">Eşleşen yetki yok.</td>
                  </tr>
                ) : null}
                {modules.map(([moduleKey, modulePermissions]) => (
                  <Fragment key={moduleKey}>
                    <tr>
                      <td colSpan={editableRoles.length + 2} className="bg-surface-2 py-1.5! text-[11px] font-bold tracking-wide text-text-3 uppercase">
                        {MODULE_LABELS[moduleKey] ?? moduleKey}
                      </td>
                    </tr>
                    {modulePermissions.map((permission) => (
                      <tr key={permission.permission_key}>
                        <td>
                          <div className="font-semibold text-text">{permission.label}</div>
                          <div className="mt-0.5 font-mono text-[10.5px] text-text-4">{permission.permission_key}</div>
                          {permission.description ? <div className="mt-0.5 text-[11px] text-text-3">{permission.description}</div> : null}
                        </td>
                        {editableRoles.map((role) => {
                          const key = `${role.role_key}:${permission.permission_key}`;
                          return (
                            <td key={key} className="text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-[var(--brand)]"
                                checked={grantedSet.has(key)}
                                disabled={pendingKey === key}
                                onChange={(event) => toggle(role.role_key, permission.permission_key, event.target.checked)}
                              />
                            </td>
                          );
                        })}
                        <td className="text-center">
                          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked disabled />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
