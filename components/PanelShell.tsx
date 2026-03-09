'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import { canViewActivities, canViewCRM, canViewReports, canViewUsers, type AllowedRole } from '@/lib/roles';

const ICONS: Record<string, string> = {
  Müşteriler: '▤',
  Aktiviteler: '◍',
  Raporlar: '▥',
  Kullanıcılar: '◈',
};

function roleLabel(role: AllowedRole) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  if (role === 'admin') return 'Admin';
  return 'Kullanıcı';
}

export default function PanelShell({ role, children }: { role: AllowedRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const items = useMemo(() => ([
    ...(canViewCRM(role) ? [{ href: '/crm', label: 'Müşteriler' }] : []),
    ...(canViewActivities(role) ? [{ href: '/crm/activities', label: 'Aktiviteler' }] : []),
    ...(canViewReports(role) ? [{ href: '/crm/reports', label: 'Raporlar' }] : []),
    ...(canViewUsers(role) ? [{ href: '/admin/users', label: 'Kullanıcılar' }] : []),
  ]), [role]);

  return (
    <div className="panel-shell">
      <style jsx>{`
        .panel-shell { min-height: 100vh; background: linear-gradient(180deg, #eef4fb 0%, #f4f7fb 100%); color: #0f172a; }
        .panel-topbar { position: sticky; top: 0; z-index: 40; display: none; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%); color: #0f172a; border-bottom: 1px solid #d9e4ef; backdrop-filter: blur(14px); }
        .menu-btn { border: 1px solid #c7d4e3; background: #fff; color: #0f172a; border-radius: 12px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
        .panel-body { display: grid; grid-template-columns: 292px minmax(0, 1fr); min-height: 100vh; }
        .panel-sidebar { padding: 22px 18px; display: grid; grid-template-rows: auto auto 1fr auto; gap: 18px; position: sticky; top: 0; height: 100vh; background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%); color: #0f172a; border-right: 1px solid #d9e4ef; box-shadow: 24px 0 44px rgba(15,23,42,.08); }
        .panel-logo { display: grid; gap: 8px; padding: 18px; border-radius: 22px; background: #ffffff; border: 1px solid #d9e4ef; }
        .panel-logo strong { font-size: 28px; font-weight: 900; letter-spacing: -.04em; color: #0f172a; }
        .panel-badge { display: inline-flex; align-items: center; width: fit-content; border-radius: 999px; padding: 9px 14px; background: #e8f1fb; color: #1e3a8a; border: 1px solid #bfd4ea; font-size: 12px; font-weight: 900; }
        .panel-nav { display: grid; gap: 10px; align-content: start; }
        .panel-link, .panel-link:visited { text-decoration: none; color: #334155; padding: 12px 14px; border-radius: 16px; font-weight: 800; display: flex; align-items: center; gap: 12px; border: 1px solid #d9e4ef; background: #ffffff; transition: all .16s ease; }
        .panel-link:hover { background: #eef6ff; color: #0f172a; transform: translateY(-1px); }
        .panel-link.active, .panel-link.active:visited { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #0f172a; border-color: #93c5fd; box-shadow: 0 10px 20px rgba(15,23,42,.08); }
        .panel-link-icon { width: 38px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: #eef4fb; color: #475569; flex: 0 0 auto; }
        .panel-link.active .panel-link-icon { background: #ffffff; color: #1d4ed8; }
        .panel-footer { display: grid; gap: 12px; padding: 14px; border-radius: 18px; background: #ffffff; border: 1px solid #d9e4ef; }
        .panel-main { min-width: 0; padding: 28px 30px; }
        .panel-main-inner { width: min(100%, 1680px); margin: 0 auto; }
        .panel-overlay { display: none; }
        @media (max-width: 960px) {
          .panel-topbar { display: flex; }
          .panel-body { display: block; min-height: auto; }
          .panel-sidebar { position: fixed; left: 0; top: 0; bottom: 0; height: 100dvh; width: min(84vw, 320px); z-index: 60; transform: translateX(-104%); transition: transform .18s ease; }
          .panel-sidebar.open { transform: translateX(0); }
          .panel-overlay { display: block; position: fixed; inset: 0; z-index: 50; background: rgba(15,23,42,.48); }
          .panel-main { padding: 16px 14px 22px; }
          .panel-main-inner { width: 100%; }
        }
      `}</style>

      <header className="panel-topbar">
        <strong>PAX CRM</strong>
        <button type="button" className="menu-btn" onClick={() => setMenuOpen(true)}>Menü</button>
      </header>

      <div className="panel-body">
        {menuOpen ? <button aria-label="Menüyü kapat" className="panel-overlay" onClick={() => setMenuOpen(false)} /> : null}
        <aside className={`panel-sidebar${menuOpen ? ' open' : ''}`}>
          <div className="panel-logo"><strong>PAX CRM</strong></div>
          <div className="panel-badge">{roleLabel(role)}</div>
          <nav className="panel-nav">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} className={`panel-link${active ? ' active' : ''}`}><span className="panel-link-icon">{ICONS[item.label]}</span><span>{item.label}</span></Link>;
            })}
          </nav>
          <div className="panel-footer"><LogoutButton /></div>
        </aside>
        <main className="panel-main"><div className="panel-main-inner">{children}</div></main>
      </div>
    </div>
  );
}
