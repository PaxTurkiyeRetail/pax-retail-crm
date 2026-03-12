'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import { canViewActivities, canViewCRM, canViewReports, canViewUsers, isAdminLike, type AllowedRole } from '@/lib/roles';

function roleLabel(role: AllowedRole) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  if (role === 'admin') return 'Admin';
  return 'Kullanıcı';
}

type IconKey = 'customers' | 'activity' | 'approval' | 'reports' | 'admin';
type NavItem = { href: string; label: string; iconKey: IconKey; exact?: boolean };

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function IconWrap({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return <span className={`nav-icon${active ? ' active' : ''}`}>{children}</span>;
}

function CustomersIcon({ active = false }: { active?: boolean }) {
  return <IconWrap active={active}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-1.1c0-1.73 0-2.6-.37-3.26a3.6 3.6 0 0 0-1.46-1.46c-.66-.37-1.53-.37-3.27-.37H9.1c-1.74 0-2.61 0-3.27.37-.63.35-1.11.83-1.46 1.46C4 17.3 4 18.17 4 19.9V21" /><path d="M10 11a3.75 3.75 0 1 0 0-7.5A3.75 3.75 0 0 0 10 11Z" /><path d="M18.5 9.2a2.9 2.9 0 1 0 0-5.8" /><path d="M20 21v-1.1c0-1.45-.27-2.24-.78-2.8-.4-.44-.96-.76-1.72-.96" /></svg></IconWrap>;
}
function ActivityIcon({ active = false }: { active?: boolean }) {
  return <IconWrap active={active}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4.2l2.3-6 4.2 12 2.1-6H21" /></svg></IconWrap>;
}
function ApprovalIcon({ active = false }: { active?: boolean }) {
  return <IconWrap active={active}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m8.7 12.3 2.3 2.3 4.8-5" /><path d="M8.4 3h7.2c1.19 0 1.78 0 2.24.23.41.21.74.54.95.95.23.46.23 1.05.23 2.24v10.82c0 .79 0 1.18-.16 1.42-.14.23-.37.39-.64.46-.3.08-.67-.07-1.43-.38L12 17.7l-4.79 2.04c-.76.31-1.13.46-1.43.38a1 1 0 0 1-.64-.46c-.16-.24-.16-.63-.16-1.42V6.42c0-1.19 0-1.78.23-2.24.21-.41.54-.74.95-.95C6.62 3 7.21 3 8.4 3Z" /></svg></IconWrap>;
}
function ReportsIcon({ active = false }: { active?: boolean }) {
  return <IconWrap active={active}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 20h12" /><path d="M7 16V8" /><path d="M12 16V4" /><path d="M17 16v-6" /></svg></IconWrap>;
}
function AdminIcon({ active = false }: { active?: boolean }) {
  return <IconWrap active={active}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 19.2 7v5c0 4.25-2.42 6.95-7.2 8.5C7.22 18.95 4.8 16.25 4.8 12V7z" /><path d="M9.4 11.7 11 13.3l3.6-3.6" /></svg></IconWrap>;
}
function MenuIcon() { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>; }
function ChevronIcon({ collapsed }: { collapsed: boolean }) { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{collapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}</svg>; }

export default function PanelShell({ role, children }: { role: AllowedRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => { try { setCollapsed(window.localStorage.getItem('pax-sidebar-collapsed') === '1'); } catch {} }, []);
  useEffect(() => { try { window.localStorage.setItem('pax-sidebar-collapsed', collapsed ? '1' : '0'); } catch {} }, [collapsed]);

  const items = useMemo<NavItem[]>(() => {
    return [
      ...(canViewCRM(role) ? [{ href: '/crm', label: 'Müşteriler', iconKey: 'customers' as const, exact: true }] : []),
      ...(canViewActivities(role) ? [{ href: '/crm/activities', label: 'Aktiviteler', iconKey: 'activity' as const }] : []),
      ...(canViewReports(role) ? [{ href: '/crm/reports', label: 'Raporlar', iconKey: 'reports' as const }] : []),
      ...(isAdminLike(role) ? [{ href: '/crm/approvals', label: 'Onaylar', iconKey: 'approval' as const }] : []),
      ...(canViewUsers(role) ? [{ href: '/admin/users', label: 'Kullanıcılar', iconKey: 'admin' as const }] : []),
    ];
  }, [role]);

  return (
    <div className="panel-shell">
      <style jsx>{`
        .panel-shell {
          min-height: 100vh;
          color: #0f172a;
          background: #f3f5f9;
        }
        .layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: ${collapsed ? '96px' : '284px'} minmax(0, 1fr);
          gap: 20px;
          padding: 16px;
          transition: grid-template-columns 160ms ease;
        }
        .sidebar {
          position: sticky;
          top: 16px;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 32px);
          max-height: calc(100vh - 32px);
          padding: 16px;
          background: #ffffff;
          border: 1px solid #d9e0ea;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
          z-index: 20;
          overflow: hidden;
        }
        .sidebar-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .toggle-btn {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          border: 1px solid #d8e1ec;
          background: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
        }
        .toggle-btn:hover { background: #f8fafc; }
        .brand-card {
          flex: 1;
          min-width: 0;
          padding: 18px;
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid #d9e3ef;
        }
        .brand-title {
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
        .brand-subtitle {
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 600;
        }
        .role-chip {
          display: inline-flex;
          align-items: center;
          min-height: 38px;
          width: fit-content;
          padding: 0 14px;
          margin: 4px 0 18px 2px;
          border-radius: 999px;
          color: #1d4ed8;
          background: #eef4ff;
          border: 1px solid #cddafc;
          font-size: 13px;
          font-weight: 800;
        }
        .nav {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 54px;
          padding: 8px 10px;
          border-radius: 16px;
          color: #334155;
          text-decoration: none;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
          position: relative;
          border: 1px solid transparent;
        }
        .nav-link:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #e2e8f0;
        }
        .nav-link.active {
          background: #eef4ff;
          color: #1d4ed8;
          border-color: #cddafc;
        }
        .nav-icon {
          width: 38px;
          height: 38px;
          min-width: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #f8fafc;
          color: inherit;
          flex: 0 0 auto;
          border: 1px solid #e2e8f0;
        }
        .nav-icon.active {
          background: #dbeafe;
          border-color: #bfdbfe;
        }
        .nav-label {
          min-width: 0;
          font-size: 15px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-spacer { flex: 1; }
        .sidebar-footer {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
        }
        .main {
          min-width: 0;
          padding: 4px 4px 20px 0;
        }
        .main-inner {
          width: min(100%, 1600px);
          margin: 0 auto;
        }
        .mobile-topbar, .overlay, .tooltip-bubble { display: none; }

        .collapsed .brand-card,
        .collapsed .role-chip,
        .collapsed .nav-label { display: none; }
        .collapsed .sidebar-top { justify-content: center; }
        .collapsed .nav-link { justify-content: center; padding: 8px 0; }
        .collapsed .sidebar-footer { padding-top: 10px; }
        .collapsed .nav-link[data-tooltip]:hover .tooltip-bubble {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 10px;
          background: #0f172a;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          z-index: 80;
          box-shadow: 0 12px 26px rgba(2, 8, 23, 0.18);
        }
        .collapsed .nav-link[data-tooltip]:hover .tooltip-bubble::before {
          content: '';
          position: absolute;
          left: -6px;
          top: 50%;
          transform: translateY(-50%) rotate(45deg);
          width: 12px;
          height: 12px;
          background: #0f172a;
          border-radius: 2px;
        }
        @media (max-width: 1024px) {
          .mobile-topbar {
            position: sticky;
            top: 0;
            z-index: 40;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-height: 72px;
            padding: 12px 16px;
            background: rgba(243, 245, 249, 0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid #dde5ef;
          }
          .mobile-brand strong { color: #0f172a; font-size: 16px; }
          .mobile-brand span { color: #64748b; font-size: 11px; font-weight: 700; }
          .layout { display: block; min-height: auto; padding: 0; }
          .sidebar {
            position: fixed;
            top: 12px;
            left: 12px;
            width: min(84vw, 284px);
            min-height: calc(100vh - 24px);
            max-height: calc(100vh - 24px);
            transform: translateX(-110%);
            transition: transform 180ms ease;
          }
          .sidebar.open { transform: translateX(0); }
          .overlay {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 45;
            background: rgba(15, 23, 42, 0.22);
            border: 0;
          }
          .collapsed .brand-card,
          .collapsed .role-chip,
          .collapsed .nav-label { display: initial; }
          .collapsed .nav-link { justify-content: flex-start; padding: 8px 10px; }
          .main { padding: 16px 14px 24px; }
        }
      `}</style>

      <header className="mobile-topbar">
        <div className="mobile-brand">
          <strong>PAX CRM</strong>
          <span>{roleLabel(role)}</span>
        </div>
        <button type="button" className="toggle-btn" aria-label="Menüyü aç" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
      </header>

      <div className={`layout${collapsed ? ' collapsed' : ''}`}>
        {menuOpen ? <button aria-label="Menüyü kapat" className="overlay" onClick={() => setMenuOpen(false)} /> : null}

        <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
          <div className="sidebar-top">
            {!collapsed ? (
              <div className="brand-card">
                <div className="brand-title">PAX Türkiye CRM</div>
                <div className="brand-subtitle">Kurumsal müşteri, aktivite ve rapor yönetimi</div>
              </div>
            ) : null}
            <button type="button" className="toggle-btn" aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} onClick={() => setCollapsed((prev) => !prev)}>
              <ChevronIcon collapsed={collapsed} />
            </button>
          </div>

          {!collapsed ? <div className="role-chip">{roleLabel(role)}</div> : null}

          <nav className="nav" aria-label="Yan menü">
            {items.map((item) => {
              const active = isItemActive(pathname, item);
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className={`nav-link${active ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  data-tooltip={collapsed ? item.label : undefined}
                >
                  {item.iconKey === 'customers' ? <CustomersIcon active={active} /> : item.iconKey === 'activity' ? <ActivityIcon active={active} /> : item.iconKey === 'approval' ? <ApprovalIcon active={active} /> : item.iconKey === 'admin' ? <AdminIcon active={active} /> : <ReportsIcon active={active} />}
                  {!collapsed ? <span className="nav-label">{item.label}</span> : null}
                  {collapsed ? <span className="tooltip-bubble">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-spacer" />

          <div className="sidebar-footer">
            <LogoutButton compact={collapsed} />
          </div>
        </aside>

        <main className="main">
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
