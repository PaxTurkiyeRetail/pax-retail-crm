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

type IconKey = 'dashboard' | 'activity' | 'customers' | 'quotes' | 'weekly' | 'requests';
type StatusKey = 'stable' | 'beta';
type NavItem = { href: string; label: string; iconKey: IconKey; exact?: boolean; status?: StatusKey };
type NavGroup = { title: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const SVG = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function NavIcon({ k }: { k: IconKey }) {
  const p = { ...SVG, width: 16, height: 16, viewBox: '0 0 24 24' };
  if (k === 'dashboard') return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if (k === 'activity') return <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (k === 'customers') return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (k === 'quotes') return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>;
  if (k === 'weekly') return <svg {...p}><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-7"/></svg>;
  if (k === 'requests') return <svg {...p}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>;
}

function IconChevronLeft() { return <svg width="14" height="14" {...SVG} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>; }
function IconChevronRight() { return <svg width="14" height="14" {...SVG} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconMenu() { return <svg width="17" height="17" {...SVG} viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
function IconSun() { return <svg width="15" height="15" {...SVG} viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function IconMoon() { return <svg width="15" height="15" {...SVG} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>; }

export default function PanelShell({ role, fullName, email, children }: { role: AllowedRole; fullName?: string | null; email?: string | null; children: React.ReactNode; }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('pax-collapsed') === '1');
      const savedTheme = localStorage.getItem('pax-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDark(savedTheme ? savedTheme === 'dark' : prefersDark);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('pax-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem('pax-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const groups = useMemo<NavGroup[]>(() => {
    const overview: NavItem[] = [];
    const operations: NavItem[] = [];
    const insights: NavItem[] = [];

    if (canViewCRM(role)) overview.push({ href: '/crm', label: 'Genel Bakış', iconKey: 'dashboard', exact: true, status: 'beta' });
    if (canViewCRM(role)) operations.push({ href: '/crm/customers', label: 'Müşteriler', iconKey: 'customers', status: 'stable' });
    if (canViewActivities(role)) operations.push({ href: '/crm/activities', label: 'Aktiviteler', iconKey: 'activity', status: 'stable' });
    if (canViewCRM(role)) operations.push({ href: '/crm/quotes', label: 'Teklifler', iconKey: 'quotes', status: 'beta' });
    operations.push({ href: '/requests', label: 'Talepler', iconKey: 'requests', status: 'beta' });

    if (canViewReports(role)) {
      insights.push({ href: '/crm/reports/seller-summary', label: 'Satıcı Özeti', iconKey: 'weekly', status: 'beta' });
      insights.push({ href: '/crm/reports/phase-report', label: 'Faz Raporu', iconKey: 'weekly', status: 'beta' });
      insights.push({ href: '/crm/reports/weekly-activities', label: 'Aktiviteler Raporu', iconKey: 'weekly', status: 'stable' });
    }

    return [
      { title: 'Genel', items: overview },
      { title: 'Operasyon', items: operations },
      { title: 'Analiz', items: insights },
    ].filter((group) => group.items.length > 0);
  }, [role]);

  const displayName = (fullName ?? '').trim() || 'Demo Kullanıcı';
  const displaySub = email?.trim() || roleLabel(role);
  const initials = getInitials(displayName);
  const sidebarClass = ['pax-sidebar', collapsed ? 'collapsed' : '', menuOpen ? 'mobile-open' : ''].filter(Boolean).join(' ');

  return (
    <div className="pax-shell">
      <div className="pax-mobile-bar">
        <div className="pax-mobile-brand">
          <div className="pax-mobile-mark">P</div>
          <img src="/pax-logo.svg" alt="PAX Türkiye" className="pax-mobile-logo" draggable={false} />
        </div>
        <div className="pax-mobile-actions">
          <button className="pax-mobile-theme-btn" onClick={() => setDark((v) => !v)} aria-label="Tema değiştir" title={dark ? 'Açık tema' : 'Koyu tema'}>{dark ? <IconSun /> : <IconMoon />}</button>
          <button className="pax-mobile-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menü"><IconMenu /></button>
        </div>
      </div>

      <div className={`pax-overlay${menuOpen ? ' visible' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <aside className={sidebarClass}>
        <div className="pax-sidebar-header">
          <div className="pax-brand">
            <div className="pax-brand-mark" aria-hidden={!collapsed}>P</div>
            <div className="pax-brand-logo">
              <img src="/pax-logo.svg" alt="PAX Türkiye" className="pax-logo-img" draggable={false} />
              <div className="pax-brand-badge">CRM · Pro</div>
            </div>
          </div>
          <button className="pax-toggle" onClick={toggleCollapse} aria-label={collapsed ? 'Genişlet' : 'Daralt'}>{collapsed ? <IconChevronRight /> : <IconChevronLeft />}</button>
        </div>

        <div className="pax-nav-area">
          {groups.map((group) => (
            <div className="pax-nav-section" key={group.title}>
              <div className="pax-section-label">{group.title}</div>
              <nav className="pax-nav-list">
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <Link key={item.href} href={item.href} className={`pax-nav-link${active ? ' active' : ''}`} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}>
                      <span className="pax-nav-icon"><NavIcon k={item.iconKey} /></span>
                      <span className="pax-nav-label">{item.label}</span>
                      {item.status === 'beta' ? <span className="pax-nav-badge beta">beta</span> : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="pax-sep" />

        <button className="pax-theme-btn" onClick={() => setDark((v) => !v)} title={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}>
          <span className="pax-theme-icon">{dark ? <IconSun /> : <IconMoon />}</span>
          <span className="pax-theme-label">{dark ? 'Açık Tema' : 'Koyu Tema'}</span>
        </button>

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

      <main className="pax-main">
        <div className="pax-main-inner">{children}</div>
      </main>
    </div>
  );
}
