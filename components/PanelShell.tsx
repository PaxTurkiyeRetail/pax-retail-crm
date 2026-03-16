'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LayoutGrid,
  Menu,
  Target,
  Users,
} from 'lucide-react';
import { canViewActivities, canViewCRM, canViewReports, canViewUsers, isAdminLike, type AllowedRole } from '@/lib/roles';

function roleLabel(role: AllowedRole) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  if (role === 'admin') return 'Admin';
  return 'Kullanıcı';
}

type IconKey = 'dashboard' | 'activity' | 'customers' | 'approval' | 'weekly' | 'management' | 'salesRadar' | 'users';
type NavItem = { href: string; label: string; iconKey: IconKey; exact?: boolean; badge?: string };
type NavNode = NavItem;
type NavGroup = { title: string; items: NavNode[] };

function isItemActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ActivityFieldIcon() {
  return (
    <IconBase>
      <path d="M7 4h8l2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M9 9h6" />
      <path d="M9 13h3" />
      <path d="M15.5 14.5l1.5 1.5 3-3" />
    </IconBase>
  );
}

function WeeklyActivityIcon() {
  return (
    <IconBase>
      <path d="M4 20h16" />
      <path d="M7 16v-3" />
      <path d="M12 16V8" />
      <path d="M17 16v-5" />
      <path d="M6 7h12" />
    </IconBase>
  );
}

function NavIcon({ iconKey }: { iconKey: IconKey }) {
  const props = { size: 18, strokeWidth: 1.5 };
  if (iconKey === 'dashboard') return <LayoutGrid {...props} />;
  if (iconKey === 'activity') return <ActivityFieldIcon />;
  if (iconKey === 'customers') return <Building2 {...props} />;
  if (iconKey === 'approval') return <ClipboardCheck {...props} />;
  if (iconKey === 'weekly') return <WeeklyActivityIcon />;
  if (iconKey === 'management') return <BarChart3 {...props} />;
  if (iconKey === 'salesRadar') return <Target {...props} />;
  return <Users {...props} />;
}

export default function PanelShell({ role, fullName, email, children }: { role: AllowedRole; fullName?: string | null; email?: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('pax-sidebar-collapsed') === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('pax-sidebar-collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  const groups = useMemo<NavGroup[]>(() => {
    const overview: NavNode[] = [];
    const operations: NavNode[] = [];
    const insights: NavNode[] = [];
    const system: NavNode[] = [];

    if (canViewCRM(role)) overview.push({ href: '/crm', label: 'Dashboard', iconKey: 'dashboard', exact: true });
    if (canViewActivities(role)) operations.push({ href: '/crm/activities', label: 'Aktiviteler', iconKey: 'activity' });
    if (canViewCRM(role)) operations.push({ href: '/crm/customers', label: 'Müşteriler', iconKey: 'customers' });
    if (canViewReports(role)) {
      insights.push({ href: '/crm/reports/weekly-activities', label: 'Haftalık Aktiviteler', iconKey: 'weekly' });
      insights.push({ href: '/crm/reports/management', label: 'Yönetim Raporu', iconKey: 'management' });
      insights.push({ href: '/crm/sales-radar', label: 'Sales Radar', iconKey: 'salesRadar' });
    }
    if (isAdminLike(role)) system.push({ href: '/crm/approvals', label: 'Onaylar', iconKey: 'approval' });
    if (canViewUsers(role)) system.push({ href: '/admin/users', label: 'Kullanıcılar', iconKey: 'users' });

    return [
      { title: 'Genel Bakış', items: overview },
      { title: 'Operasyonlar', items: operations },
      { title: 'Analizler', items: insights },
      { title: 'Sistem', items: system },
    ].filter((g) => g.items.length > 0);
  }, [role]);

  const displayName = (fullName ?? '').trim() || 'Çağdaş Şen';

  return (
    <div className="panel-shell">
      <style jsx>{`
        .panel-shell {
          min-height: 100vh;
          color: #0f172a;
          background:
            radial-gradient(circle at top left, rgba(79, 70, 229, 0.05), transparent 22%),
            linear-gradient(180deg, #f8faff 0%, #f4f6fb 100%);
        }
        .layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: ${collapsed ? '92px' : '272px'} minmax(0, 1fr);
          gap: 24px;
          padding: 18px;
          transition: grid-template-columns 180ms ease;
        }
        .sidebar {
          position: sticky;
          top: 18px;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 36px);
          max-height: calc(100vh - 36px);
          padding: 18px 14px 14px;
          background: #ffffff;
          border: 1px solid #e9eef7;
          border-radius: 26px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 8px 24px rgba(15, 23, 42, 0.03);
          overflow: hidden;
          z-index: 40;
        }
        .sidebar-top {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .brand {
          min-width: 0;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          min-height: 72px;
          padding: 2px 0;
        }
        .brand-mark{display:none;}
        .brand-logo{
          width: 100%;
          max-width: 190px;
          height: auto;
          max-height: 64px;
          object-fit: contain;
          object-position: center;
          display:block;
        }
        .brand-copy { display: none; }

        .sidebar :global(a),
        .sidebar :global(a:hover),
        .sidebar :global(a:focus),
        .sidebar :global(a:visited) { text-decoration: none !important; }
.toggle-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid #e7ebf3;
          background: #ffffff;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .toggle-btn:hover { background: #f5f7fb; color: #0f172a; }
        .nav-scroll {
          margin-top: 12px;
          overflow: auto;
          padding-right: 2px;
          flex: 1;
        }
        .nav-group + .nav-group { margin-top: 24px; }
        .group-title {
          margin: 0 10px 10px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
        .nav {
          display: grid;
          gap: 4px;
        }
        .nav-block { display: grid; gap: 4px; }
        .nav-link,
        .nav-trigger {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          height: 46px;
          min-height: 46px;
          padding: 0 14px 0 16px;
          border-radius: 14px;
          color: #1f2937;
          text-decoration: none !important;
          line-height: 1;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          text-align: left;
          width: 100%;
          overflow: hidden;
        }
        .nav-link::before,
        .nav-trigger::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 5px;
          border-radius: 0 999px 999px 0;
          background: transparent;
          opacity: 0;
          transition: opacity 180ms ease, background 180ms ease, box-shadow 180ms ease;
        }
        .nav-link:hover,
        .nav-trigger:hover {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #0f172a;
          box-shadow: none;
          transform: none;
        }
        .nav-link.active,
        .nav-trigger.active {
          background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #93c5fd;
          color: #1d4ed8;
          font-weight: 800;
          box-shadow:
            inset 0 0 0 1px rgba(59, 130, 246, 0.22),
            0 8px 18px rgba(37, 99, 235, 0.10);
        }
        .nav-link.active::before,
        .nav-trigger.active::before {
          opacity: 1;
          background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.22);
        }
        .nav-icon {
          width: 24px;
          height: 24px;
          min-width: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          color: #64748b;
          flex: 0 0 auto;
          transform: translateY(2px);
          transition: color 180ms ease, transform 180ms ease;
        }
        .nav-icon :global(svg) {
          width: 18px;
          height: 18px;
          display: block;
          flex: 0 0 auto;
          transform: translateY(0);
        }
        .nav-link:hover .nav-icon,
        .nav-trigger:hover .nav-icon {
          color: #475569;
          transform: translateY(3px) scale(1.03);
        }
        .nav-link.active .nav-icon,
        .nav-trigger.active .nav-icon {
          color: #2563eb;
          transform: translateY(2px) scale(1.03);
          filter: drop-shadow(0 1px 0 rgba(255,255,255,0.45));
        }
        .nav-label {
          min-width: 0;
          position: relative;
          top: 0;
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          font-size: 14px;
          font-weight: 650;
          line-height: 1;
          transform: translateY(0);
          text-decoration: none !important;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          transition: color 180ms ease, transform 180ms ease;
        }
        .nav-badge {
          margin-left: auto;
          min-height: 20px;
          padding: 0 7px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #4f46e5;
          background: #ffffff;
          border: 1px solid #dfe3ff;
          flex: 0 0 auto;
        }
        .nav-caret {
          color: #94a3b8;
          transition: transform 140ms ease, color 140ms ease;
          flex: 0 0 auto;
        }
        .nav-caret.open { transform: rotate(180deg); }
        .nav-trigger:hover .nav-caret { color: #64748b; }
        .nav-trigger.active .nav-caret { color: #6366f1; }
        .nav-link:focus-visible,
        .nav-trigger:focus-visible {
          outline: none;
          border-color: #c7d2fe;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.14);
        }
        .nav-link:hover .nav-label,
        .nav-trigger:hover .nav-label {
          transform: translateX(1px);
        }
        .nav-link.active .nav-label,
        .nav-trigger.active .nav-label {
          color: #1d4ed8;
        }
        .subnav {
          margin-left: 32px;
          padding-left: 12px;
          border-left: 1px solid #e8edf6;
          display: grid;
          gap: 3px;
        }
        .subnav-link {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 34px;
          padding: 6px 10px;
          border-radius: 10px;
          color: #475569;
          text-decoration: none !important;
          line-height: 1;
          font-size: 13px;
          font-weight: 500;
          transition: background 140ms ease, color 140ms ease;
        }
        .subnav-link::before {
          content: '';
          position: absolute;
          left: -11px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          border-radius: 999px;
          background: transparent;
        }
        .subnav-link:hover {
          background: #f8fafc;
          color: #0f172a;
        }
        .subnav-link.active {
          color: #4338ca;
          background: #f8faff;
          font-weight: 600;
        }
        .subnav-link.active::before { background: #4f46e5; }
        .sidebar-footer {
          margin-top: 12px;
          padding-top: 14px;
          border-top: 1px solid #eef2f7;
          display: grid;
          gap: 6px;
          flex: 0 0 auto;
        }
        .profile-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 14px;
          background: #fbfcfe;
          border: 1px solid #edf1f7;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .profile-card:hover {
          background: #ffffff;
          border-color: #e3eaf5;
        }
        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #dfe3ff;
          flex: 0 0 auto;
        }
        .profile-copy { min-width: 0; }
        .profile-name {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-role {
          margin-top: 1px;
          font-size: 11px;
          font-weight: 500;
          color: #7c86a1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .logout-wrap :global(button) {
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          border: 1px solid #dbe3ee !important;
          background: #ffffff !important;
          color: #334155;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          justify-content: center;
          padding: 0 14px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
        }
        .logout-wrap :global(button:hover) { background: #f8fafc !important; color: #0f172a; }
        .logout-wrap :global(svg) {
          width: 20px;
          height: 20px;
        }
        .main { min-width: 0; padding: 4px 6px 24px 0; }
        .main-inner { width: min(100%, 1680px); margin: 0 auto; }
        .mobile-topbar { display: none; }
        .collapsed .brand-copy,
        .collapsed .group-title,
        .collapsed .nav-label,
        .collapsed .nav-badge,
        .collapsed .nav-caret,
        .collapsed .subnav,
        .collapsed .profile-copy,
        .collapsed .logout-wrap {
          display: none;
        }
        .collapsed .brand,
        .collapsed .profile-card,
        .collapsed .nav-link,
        .collapsed .nav-trigger {
          justify-content: center;
        }
        .collapsed .sidebar { padding-left: 10px; padding-right: 10px; }
        .collapsed .brand {
          padding-left: 0;
          padding-right: 0;
          min-height: 56px;
        }
        .collapsed .brand-logo {
          width: 42px;
          max-width: 42px;
          max-height: 42px;
        }
        .collapsed .nav-link,
        .collapsed .nav-trigger { padding-left: 0; padding-right: 0; }
        .collapsed .nav-link::before,
        .collapsed .nav-trigger::before,
        .collapsed .subnav-link::before { display: none; }
        @media (max-width: 1024px) {
          .layout { grid-template-columns: 1fr; padding: 14px; }
          .mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            position: sticky;
            top: 0;
            z-index: 50;
            padding: 10px 0 14px;
          }
          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #e9eef7;
          }
          .mobile-title { font-size: 16px; font-weight: 700; color: #0f172a; }
          .menu-mobile-btn {
            width: 44px;
            height: 46px;
            border-radius: 14px;
            border: 1px solid #e7ebf3;
            background: #ffffff;
            color: #475569;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .sidebar {
            position: fixed;
            inset: 76px 14px 14px 14px;
            min-height: auto;
            max-height: none;
            transform: translateY(${menuOpen ? '0' : '8px'}) scale(${menuOpen ? '1' : '0.98'});
            opacity: ${menuOpen ? 1 : 0};
            pointer-events: ${menuOpen ? 'auto' : 'none'};
            transition: opacity 160ms ease, transform 160ms ease;
          }
          .main { padding: 0; }
        }
      `}</style>

      <div className="layout">
        <div className="mobile-topbar">
          <div className="mobile-brand">
            
            <div className="mobile-title">PAX Retail CRM</div>
          </div>
          <button className="menu-mobile-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menüyü aç">
            <Menu size={18} strokeWidth={1.5} />
          </button>
        </div>
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-top">
            <div className="brand">
              <img src="/pax-turkiye-logo-renkli.svg" alt="PAX Türkiye" className="brand-logo" />
            </div>
            <button className="toggle-btn" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Sidebar genişlet' : 'Sidebar daralt'}>
              {collapsed ? <ChevronRight size={18} strokeWidth={1.5} /> : <ChevronLeft size={18} strokeWidth={1.5} />}
            </button>
          </div>

          <div className="nav-scroll">
            {groups.map((group) => (
              <section className="nav-group" key={group.title}>
                <div className="group-title">{group.title}</div>
                <nav className="nav">
                  {group.items.map((item) => {
                    const active = isItemActive(pathname, item);

                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'active' : ''}`}>
                        <span className="nav-icon"><NavIcon iconKey={item.iconKey} /></span>
                        <span className="nav-label">{item.label}</span>
                        {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                      </Link>
                    );
                  })}
                </nav>
              </section>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="profile-card">
              <span className="avatar"><Users size={18} strokeWidth={1.5} /></span>
              <div className="profile-copy">
                <div className="profile-name">{displayName}</div>
                <div className="profile-role">{roleLabel(role)}</div>
              </div>
            </div>
            <div className="logout-wrap"><LogoutButton /></div>
          </div>
        </aside>
        <main className="main"><div className="main-inner">{children}</div></main>
      </div>
    </div>
  );
}
