'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import { canViewActivities, canViewCRM, canViewReports, canViewUsers, isAdminLike, type AllowedRole } from '@/lib/roles';
import '@/styles/globals.css';
import '@/styles/sidebar.css';

function roleLabel(role: AllowedRole) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  if (role === 'admin') return 'Admin';
  return 'Kullanıcı';
}

type IconKey = 'dashboard' | 'activity' | 'customers' | 'quotes' | 'approval' | 'weekly' | 'management' | 'salesRadar' | 'salesProcess' | 'users' | 'tracker' | 'guide' | 'me' | 'novaCore' | 'requests' | 'requestsDash' | 'personStats';
type NavItem = { href: string; label: string; iconKey: IconKey; exact?: boolean };
type NavGroup = { title: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

/* ── Inline SVG icons ── */
const SVG = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function NavIcon({ k }: { k: IconKey }) {
  const p = { ...SVG, width: 16, height: 16, viewBox: '0 0 24 24' };
  if (k === 'dashboard') return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (k === 'activity') return <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (k === 'customers') return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (k === 'quotes') return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>;
  if (k === 'approval') return <svg {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (k === 'weekly') return <svg {...p}><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-7"/></svg>;
  if (k === 'management') return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
  if (k === 'salesRadar') return <svg {...p}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
  if (k === 'salesProcess') return <svg {...p}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><path d="m15 15 3 3 5-6"/></svg>;
  if (k === 'tracker') return <svg {...p}><path d="M9 3h6"/><path d="M10 8h4"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>;
  if (k === 'guide') return <svg {...p}><path d="M12 6.5a3.5 3.5 0 1 0 0 7"/><path d="M12 6.5c1.4 0 2.5.5 3.3 1.4"/><path d="M12 13.5c-1.4 0-2.5-.5-3.3-1.4"/><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>;
  if (k === 'me') return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
  if (k === 'novaCore') return <svg {...p}><path d="M12 2 4 6v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V6l-8-4Z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>;
  if (k === 'requests') return <svg {...p}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>;
  if (k === 'personStats') return <svg {...p}><circle cx="9" cy="7" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>;
  if (k === 'requestsDash') return <svg {...p}><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="0.5"/><rect x="13" y="8" width="3" height="10" rx="0.5"/><rect x="10" y="5" width="3" height="13" rx="0.5"/></svg>;
  return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}

function IconChevronLeft() { return <svg width="14" height="14" {...SVG} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>; }
function IconChevronRight() { return <svg width="14" height="14" {...SVG} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconMenu() { return <svg width="17" height="17" {...SVG} viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
function IconSun() { return <svg width="15" height="15" {...SVG} viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function IconMoon() { return <svg width="15" height="15" {...SVG} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>; }

export default function PanelShell({ role, fullName, email, children }: {
  role: AllowedRole; fullName?: string | null; email?: string | null; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  // Load persisted prefs
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('pax-collapsed') === '1');
      const savedTheme = localStorage.getItem('pax-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
      setDark(isDark);
    } catch {}
  }, []);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('pax-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('pax-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => setDark(v => !v), []);

  const groups = useMemo<NavGroup[]>(() => {
    const overview: NavItem[] = [];
    const operations: NavItem[] = [];
    const insights: NavItem[] = [];
    const system: NavItem[] = [];

    const isAdmin = isAdminLike(role);

    // GENEL
    if (canViewCRM(role)) overview.push({ href: '/crm', label: 'Dashboard', iconKey: 'dashboard', exact: true });
    
    // Kullanıcılar için "Benim Ekranım" GENEL altında
    if (!isAdmin && canViewCRM(role)) {
      overview.push({ href: '/crm/me', label: 'Benim Ekranım', iconKey: 'me' });
    }

    // OPERASYON
    if (canViewCRM(role)) operations.push({ href: '/crm/customers', label: 'Müşteriler', iconKey: 'customers' });
    if (canViewActivities(role)) operations.push({ href: '/crm/activities', label: 'Aktiviteler', iconKey: 'activity' });
    if (canViewCRM(role)) operations.push({ href: '/crm/quotes', label: 'Teklifler', iconKey: 'quotes' });
    
    // Onaylar - sadece admin'de OPERASYON altında
    if (isAdmin) operations.push({ href: '/crm/approvals', label: 'Onaylar', iconKey: 'approval' });

    // REQUESTS
    operations.push({ href: '/requests', label: 'Talepler', iconKey: 'requests' });

    // ANALİZ
    // Kişi Ekranları - sadece admin'de
    if (isAdmin && canViewCRM(role)) {
      insights.push({ href: '/crm/me', label: 'Kişi Ekranları', iconKey: 'me' });
    }
    
    if (canViewReports(role)) {
      insights.push({ href: '/crm/sales-radar', label: 'Sales Radar', iconKey: 'salesRadar' });
      insights.push({ href: '/crm/reports/weekly-activities', label: 'Haftalık Aktiviteler', iconKey: 'weekly' });
      
      // Yönetim Raporu - sadece admin'de
      if (isAdmin) {
        insights.push({ href: '/crm/reports/management', label: 'Yönetim Raporu', iconKey: 'management' });
      }
    }

    // SİSTEM
    // Satış Süreci - herkes görür, SİSTEM altında
    if (canViewCRM(role)) system.push({ href: '/crm/sales-process', label: 'Satış Süreci', iconKey: 'salesProcess' });
    
    // Nova Core - herkes görür
    if (canViewCRM(role)) system.push({ href: '/crm/nova-core', label: 'Nova Core', iconKey: 'novaCore' });
    
    // Sistem Gereksinimleri - sadece admin
    if (isAdmin && canViewCRM(role)) system.push({ href: '/crm/system-tracker', label: 'Sistem Gereksinimleri', iconKey: 'tracker' });
    
    // Müşteri Durumu Rehberi - sadece admin
    if (isAdmin && canViewCRM(role)) system.push({ href: '/crm/customer-status-guide', label: 'Müşteri Durumu Rehberi', iconKey: 'guide' });
    
    // Kullanıcılar - sadece admin
    if (canViewUsers(role)) system.push({ href: '/admin/users', label: 'Kullanıcılar', iconKey: 'users' });

    return [
      { title: 'Genel', items: overview },
      { title: 'Operasyon', items: operations },
      { title: 'Analiz', items: insights },
      { title: 'Sistem', items: system },
    ].filter(g => g.items.length > 0);
  }, [role]);

  const displayName = (fullName ?? '').trim() || 'Demo Kullanıcı';
  const displaySub = email?.trim() || roleLabel(role);
  const initials = getInitials(displayName);

  const sidebarClass = ['pax-sidebar', collapsed ? 'collapsed' : '', menuOpen ? 'mobile-open' : ''].filter(Boolean).join(' ');

  return (
    <div className="pax-shell">
      {/* Mobile topbar */}
      <div className="pax-mobile-bar">
        <div className="pax-mobile-brand">
          <div className="pax-mobile-mark">P</div>
          <img src="/pax-logo.svg" alt="PAX Türkiye" className="pax-mobile-logo" draggable={false} />
        </div>
        <div className="pax-mobile-actions">
          <button className="pax-mobile-theme-btn" onClick={toggleTheme} aria-label="Tema değiştir" title={dark ? 'Açık tema' : 'Koyu tema'}>
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button className="pax-mobile-menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Menü">
            <IconMenu />
          </button>
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`pax-overlay${menuOpen ? ' visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={sidebarClass}>
        {/* Header */}
        <div className="pax-sidebar-header">
          <div className="pax-brand">
            {/* Collapsed: sadece P ikonu, expanded: tam logo */}
            <div className="pax-brand-mark" aria-hidden={!collapsed}>P</div>
            <div className="pax-brand-logo">
              <img
                src="/pax-logo.svg"
                alt="PAX Türkiye"
                className="pax-logo-img"
                draggable={false}
              />
              <div className="pax-brand-badge">CRM · Pro</div>
            </div>
          </div>
          <button className="pax-toggle" onClick={toggleCollapse} aria-label={collapsed ? 'Genişlet' : 'Daralt'}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Nav */}
        <div className="pax-nav-area">
          {groups.map(group => (
            <div className="pax-nav-section" key={group.title}>
              <div className="pax-section-label">{group.title}</div>
              <nav className="pax-nav-list">
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`pax-nav-link${isActive(pathname, item) ? ' active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive(pathname, item) ? 'page' : undefined}
                  >
                    <span className="pax-nav-icon"><NavIcon k={item.iconKey} /></span>
                    <span className="pax-nav-label">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="pax-sep" />

        {/* Theme toggle button */}
        <button className="pax-theme-btn" onClick={toggleTheme} title={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}>
          <span className="pax-theme-icon">{dark ? <IconSun /> : <IconMoon />}</span>
          <span className="pax-theme-label">{dark ? 'Açık Tema' : 'Koyu Tema'}</span>
        </button>

        {/* Footer */}
        <div className="pax-sidebar-footer">
          <div className="pax-profile">
            <div className="pax-avatar">{initials || 'U'}</div>
            <div className="pax-profile-info">
              <div className="pax-profile-name">{displayName}</div>
              <div className="pax-profile-sub">{displaySub}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="pax-main">
        <div className="pax-main-inner">{children}</div>
      </main>
    </div>
  );
}
