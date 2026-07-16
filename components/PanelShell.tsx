"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import {
  canViewActivities,
  canViewCRM,
  canViewReports,
  canViewUsers,
  isAdminLike,
  type AllowedRole,
} from "@/lib/roles";
import { canManageSystemParameters } from "@/lib/technical-owners";
import "@/styles/globals.css";
import "@/styles/sidebar.css";
import "@/styles/premium-ui.css";
import "@/styles/premium-enterprise.css";

function roleLabel(role: AllowedRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "account_manager") return "Account Manager";
  if (role === "itsm") return "ITSM";
  if (role === "admin") return "Admin";
  return "Kullanıcı";
}

type IconKey =
  | "dashboard"
  | "activity"
  | "customers"
  | "quotes"
  | "forecast"
  | "weekly"
  | "users"
  | "settings"
  | "backup"
  | "requests";
type NavItem = {
  href: string;
  label: string;
  iconKey: IconKey;
  exact?: boolean;
};
type NavGroup = { title: string; items: NavItem[] };
type ReportsGroup = { title: string; iconKey: IconKey; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const SVG = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function NavIcon({ k }: { k: IconKey }) {
  const p = { ...SVG, width: 16, height: 16, viewBox: "0 0 24 24" };
  if (k === "dashboard")
    return (
      <svg {...p}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  if (k === "activity")
    return (
      <svg {...p}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  if (k === "customers")
    return (
      <svg {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  if (k === "quotes")
    return (
      <svg {...p}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="14 3 14 9 20 9" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </svg>
    );
  if (k === "forecast")
    return (
      <svg {...p}>
        <path d="M3 3v18h18" />
        <path d="M7 15l3-3 3 2 5-7" />
        <path d="M8 21v-4" />
        <path d="M13 21v-5" />
        <path d="M18 21v-9" />
      </svg>
    );
  if (k === "weekly")
    return (
      <svg {...p}>
        <path d="M3 3v18h18" />
        <path d="m7 16 4-4 4 4 4-7" />
      </svg>
    );
  if (k === "users")
    return (
      <svg {...p}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  if (k === "settings")
    return (
      <svg {...p}>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82 2 2 0 1 1-3.34 0A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33 2 2 0 1 1 0-3.34A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82 2 2 0 1 1 3.34 0A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.46.2.82.55 1 .99.2.44.2.94 0 1.38-.18.44-.54.8-1 .99-.44.2-.94.2-1.38 0" />
      </svg>
    );
  if (k === "backup")
    return (
      <svg {...p}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  if (k === "requests")
    return (
      <svg {...p}>
        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" {...SVG} viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="14" height="14" {...SVG} viewBox="0 0 24 24">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`pax-group-chevron${open ? " open" : ""}`}
      width="14"
      height="14"
      {...SVG}
      viewBox="0 0 24 24"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="17" height="17" {...SVG} viewBox="0 0 24 24">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="15" height="15" {...SVG} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="15" height="15" {...SVG} viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function routeMeta(pathname: string) {
  const items: Array<[string, string, string]> = [
    [
      "/crm/reports/weekly-management-presentation",
      "Rapor Merkezi",
      "Haftalık Yönetim Sunumu",
    ],
    ["/crm/reports/user-activity-presentation", "Rapor Merkezi", "Kullanıcı Aktivite Sunumu"],
    ["/crm/reports/seller-presentation", "Rapor Merkezi", "Satışçı Sunumu"],
    ["/crm/reports/seller-summary", "Rapor Merkezi", "Satıcı Özeti"],
    ["/crm/reports/forecast", "Rapor Merkezi", "Forecast Raporu"],
    ["/crm/reports/quotes", "Rapor Merkezi", "Teklif Raporları"],
    ["/crm/reports/phase-report", "Rapor Merkezi", "Faz Raporu"],
    ["/crm/reports/kasapos-summary", "Rapor Merkezi", "KasaPOS Raporu"],
    ["/crm/reports/weekly-activities", "Rapor Merkezi", "Aktivite Raporu"],
    ["/crm/quotes/catalog", "Operasyon", "Ürün Kataloğu"],
    ["/crm/quotes/new", "Operasyon", "Yeni Teklif"],
    ["/crm/quotes", "Operasyon", "Teklifler"],
    ["/crm/activities/new", "Operasyon", "Yeni Aktivite"],
    ["/crm/activities", "Operasyon", "Aktiviteler"],
    ["/crm/forecast", "Operasyon", "Forecast"],
    ["/crm/customers", "Operasyon", "Müşteriler"],
    ["/crm/sales-radar", "Operasyon", "Satış Radarı"],
    ["/crm/system-tracker", "Operasyon", "Sistem Takibi"],
    ["/crm/customer-status-guide", "Operasyon", "Müşteri Durum Rehberi"],
    ["/crm/nova-core", "Strateji", "Nova Core"],
    ["/crm/sales-process", "Strateji", "Satış Süreci"],
    ["/crm/me", "Profil", "Hesabım"],
        ["/admin/parameters", "Yönetim", "Parametre Yönetimi"],
    ["/admin/users", "Yönetim", "Kullanıcı Yönetimi"],
    ["/admin/db-backup", "Yönetim", "DB Yedeği"],
    ["/crm", "Genel", "Komuta Merkezi"],
  ];
  const match = items.find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return {
    section: match?.[1] ?? "Kurumsal CRM",
    title: match?.[2] ?? "Panel",
  };
}

export default function PanelShell({
  role,
  fullName,
  email,
  children,
}: {
  role: AllowedRole;
  fullName?: string | null;
  email?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("pax-collapsed") === "1");
      const savedTheme = localStorage.getItem("pax-theme");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setDark(savedTheme ? savedTheme === "dark" : prefersDark);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
    try {
      localStorage.setItem("pax-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
    if (pathname.startsWith("/crm/reports")) setReportsOpen(true);
  }, [pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem("pax-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const prefetchRoute = useCallback(
    (href: string) => {
      try {
        router.prefetch(href);
      } catch {}
    },
    [router],
  );

  const { groups, reportsGroup } = useMemo<{
    groups: NavGroup[];
    reportsGroup: ReportsGroup | null;
  }>(() => {
    const overview: NavItem[] = [];
    const operations: NavItem[] = [];
    const reports: NavItem[] = [];

    if (canViewCRM(role))
      overview.push({
        href: "/crm",
        label: "Genel Bakış",
        iconKey: "dashboard",
        exact: true,
      });
    if (canViewCRM(role))
      operations.push({
        href: "/crm/customers",
        label: "Müşteriler",
        iconKey: "customers",
      });
    if (canViewActivities(role))
      operations.push({
        href: "/crm/activities",
        label: "Aktiviteler",
        iconKey: "activity",
      });
    if (canViewCRM(role))
      operations.push({
        href: "/crm/quotes",
        label: "Teklifler",
        iconKey: "quotes",
      });
    if (canViewCRM(role))
      operations.push({
        href: "/crm/forecast",
        label: "Forecast",
        iconKey: "forecast",
      });
    if (canViewCRM(role))
      operations.push({
        href: "/crm/sales-radar",
        label: "Satış Radarı",
        iconKey: "weekly",
      });
    if (canViewCRM(role))
      operations.push({
        href: "/crm/system-tracker",
        label: "Sistem Takibi",
        iconKey: "settings",
      });

    if (canViewReports(role)) {
      reports.push({
        href: "/crm/reports/quotes",
        label: "Teklif Raporları",
        iconKey: "quotes",
      });
      reports.push({
        href: "/crm/reports/forecast",
        label: "Forecast Raporu",
        iconKey: "forecast",
      });
      reports.push({
        href: "/crm/reports/seller-summary",
        label: "Satıcı Özeti",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/phase-report",
        label: "Faz Raporu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/kasapos-summary",
        label: "KasaPOS Raporu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/weekly-activities",
        label: "Aktiviteler Raporu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/weekly-management-presentation",
        label: "Yönetim Sunumu",
        iconKey: "weekly",
      });
      if (isAdminLike(role)) reports.push({
        href: "/crm/reports/user-activity-presentation",
        label: "Kullanıcı Aktivite Sunumu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/seller-presentation",
        label: "Satışçı Sunumu",
        iconKey: "weekly",
      });
    }

    return {
      groups: [
        { title: "Genel", items: overview },
        { title: "Operasyon", items: operations },
      ].filter((group) => group.items.length > 0),
      reportsGroup: reports.length
        ? { title: "Raporlar", iconKey: "weekly", items: reports }
        : null,
    };
  }, [role, fullName, email]);

  const displayName = (fullName ?? "").trim() || "Demo Kullanıcı";
  const displaySub = email?.trim() || roleLabel(role);
  const initials = getInitials(displayName);
  const sidebarClass = [
    "pax-sidebar",
    collapsed ? "collapsed" : "",
    menuOpen ? "mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const shellClass = ["pax-shell", collapsed ? "sidebar-collapsed" : ""]
    .filter(Boolean)
    .join(" ");
  const reportsActive = pathname.startsWith("/crm/reports");
  const pageMeta = useMemo(() => routeMeta(pathname), [pathname]);
  const showParameterManagement =
    isAdminLike(role) || canManageSystemParameters({ fullName, email });
  const showReports = Boolean(
    reportsGroup && (reportsOpen || reportsActive || collapsed),
  );

  return (
    <div className={shellClass}>
      <div className="pax-mobile-bar">
        <div className="pax-mobile-brand">
          <div className="pax-mobile-mark">P</div>
          <img
            src="/pax-logo.svg"
            alt="PAX Türkiye"
            className="pax-mobile-logo"
            draggable={false}
          />
        </div>
        <div className="pax-mobile-actions">
          <button
            className="pax-mobile-theme-btn"
            onClick={() => setDark((v) => !v)}
            aria-label="Tema değiştir"
            title={dark ? "Açık tema" : "Koyu tema"}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            className="pax-mobile-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      <div
        className={`pax-overlay${menuOpen ? " visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={sidebarClass}>
        <div className="pax-sidebar-header">
          <div className="pax-brand">
            <div className="pax-brand-mark" aria-hidden={!collapsed}>
              P
            </div>
            <div className="pax-brand-logo">
              <img
                src="/pax-logo.svg"
                alt="PAX Türkiye"
                className="pax-logo-img"
                draggable={false}
              />
            </div>
          </div>
          <button
            className="pax-toggle"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Genişlet" : "Daralt"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <div className="pax-nav-area">
          {groups.map((group) => (
            <div className="pax-nav-section" key={group.title}>
              <div className="pax-section-label">{group.title}</div>
              <nav className="pax-nav-list">
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onMouseEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                      className={`pax-nav-link${active ? " active" : ""}`}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="pax-nav-icon">
                        <NavIcon k={item.iconKey} />
                      </span>
                      <span className="pax-nav-label">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          {reportsGroup && (
            <div className="pax-nav-section pax-report-section">
              <button
                type="button"
                className={`pax-nav-link pax-nav-group-trigger${reportsActive ? " active" : ""}`}
                onClick={() => setReportsOpen((value) => !value)}
                aria-expanded={showReports}
                title={collapsed ? reportsGroup.title : undefined}
              >
                <span className="pax-nav-icon">
                  <NavIcon k={reportsGroup.iconKey} />
                </span>
                <span className="pax-nav-label">{reportsGroup.title}</span>
                <span className="pax-nav-chevron">
                  <IconChevronDown open={showReports} />
                </span>
              </button>

              {showReports && (
                <nav
                  className="pax-nav-list pax-subnav-list"
                  aria-label="Raporlar"
                >
                  {reportsGroup.items.map((item) => {
                    const active = isActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        onMouseEnter={() => prefetchRoute(item.href)}
                        onFocus={() => prefetchRoute(item.href)}
                        className={`pax-subnav-link${active ? " active" : ""}`}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="pax-subnav-dot" />
                        <span className="pax-nav-label">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>
          )}
        </div>

        <div className="pax-sep" />

        <button
          className="pax-theme-btn"
          onClick={() => setDark((v) => !v)}
          title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          <span className="pax-theme-icon">
            {dark ? <IconSun /> : <IconMoon />}
          </span>
          <span className="pax-theme-label">
            {dark ? "Açık Tema" : "Koyu Tema"}
          </span>
        </button>

        <div className="pax-sidebar-footer">
          <div className="pax-profile">
            <div className="pax-avatar">{initials || "U"}</div>
            <div className="pax-profile-info">
              <div className="pax-profile-name">{displayName}</div>
              <div className="pax-profile-sub">{displaySub}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="pax-main">
        <header className="pax-topbar">
          <div className="pax-topbar-title">
            <span>{pageMeta.section}</span>
            <strong>{pageMeta.title}</strong>
            <small>{roleLabel(role)}</small>
          </div>
          <div className="pax-topbar-actions">
            <button
              className="pax-topbar-theme"
              onClick={() => setDark((v) => !v)}
              aria-label="Tema değiştir"
              title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
            <div className="pax-user-menu">
              <button
                className="pax-user-trigger"
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
                aria-expanded={userMenuOpen}
              >
                <span className="pax-avatar">{initials || "U"}</span>
                <span className="pax-user-trigger-text">
                  <strong>{displayName}</strong>
                  <small>{displaySub}</small>
                </span>
                <IconChevronDown open={userMenuOpen} />
              </button>
              {userMenuOpen && (
                <div className="pax-user-dropdown">
                  <div className="pax-user-dropdown-head">
                    <strong>{displayName}</strong>
                    <span>{email?.trim() || roleLabel(role)}</span>
                  </div>
                  {(showParameterManagement || canViewUsers(role)) && (
                    <div className="pax-user-dropdown-section">
                      {showParameterManagement && (
                        <Link
                          href="/admin/parameters"
                          className="pax-user-dropdown-link"
                        >
                          Parametre Yönetimi
                        </Link>
                      )}
                      {canViewUsers(role) && (
                        <Link
                          href="/admin/db-backup"
                          className="pax-user-dropdown-link"
                        >
                          DB Yedeği
                        </Link>
                      )}
                      {canViewUsers(role) && (
                        <Link
                          href="/admin/users"
                          className="pax-user-dropdown-link"
                        >
                          Kullanıcı Yönetimi
                        </Link>
                      )}
                    </div>
                  )}
                  <LogoutButton />
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="pax-main-inner">{children}</div>
      </main>
    </div>
  );
}
