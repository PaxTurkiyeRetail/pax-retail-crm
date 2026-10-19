"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import {
  hasPermission,
  type AllowedRole,
  type Permission,
} from "@/lib/roles";
import "@/styles/globals.css";
import "@/styles/premium-ui.css";
import "@/styles/premium-enterprise.css";
import "@/styles/mobile-hardening.css";

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
  | "blocker"
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
  hardNavigate?: boolean;
};
type NavGroup = { title: string; items: NavItem[]; tail?: boolean };
type ReportsGroup = { title: string; iconKey: IconKey; items: NavItem[] };

function isActive(pathname: string, item: NavItem, search = "") {
  // Sorgu dizesi taşıyan menü girişleri yalnız o sorguyla aktif olur; sorgusuz
  // girişler sekme parametresinden bağımsız (sayfanın tüm sekmeleri aynı girdi).
  const [itemPath, itemQuery] = item.href.split("?");
  if (itemQuery) return pathname === itemPath && search === `?${itemQuery}`;
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
  if (k === "blocker")
    return (
      <svg {...p}>
        <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
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
      className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
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
  if (/^\/crm\/[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(pathname)) {
    return { section: "Operasyon", title: "Firma Detayı" };
  }
  const items: Array<[string, string, string]> = [
    [
      "/crm/reports/weekly-management-presentation",
      "Rapor Merkezi",
      "Haftalık Yönetim Sunumu",
    ],
    ["/crm/reports/seller-presentation", "Rapor Merkezi", "Satışçı Sunumu"],
    ["/dashboard", "Genel", "Dashboard"],
    ["/performans-karnesi", "Genel", "Performans Karnesi"],
    ["/crm/reports/entegrasyon-raporu", "Rapor Merkezi", "KasaPOS Entegrasyon Raporu"],    ["/crm/reports/yil-ziyaret-portfoy", "Rapor Merkezi", "Yıl Ziyaret & Portföy Sağlığı"],
    ["/crm/reports/forecast", "Rapor Merkezi", "Forecast Raporu"],
    ["/crm/reports/quotes", "Rapor Merkezi", "Teklif Raporları"],
    ["/crm/reports/kasapos-summary", "Rapor Merkezi", "KasaPOS Raporu"],
    ["/crm/report-builder", "Raporlar", "Rapor Merkezi"],
    ["/crm/reports/retail-operasyon", "Rapor Merkezi", "Retail Operasyon Paneli"],
    ["/crm/reports/weekly-activities", "Rapor Merkezi", "Aktivite Raporu"],
    ["/crm/quotes/catalog", "Operasyon", "Ürün Kataloğu"],
    ["/crm/quotes/new", "Operasyon", "Yeni Teklif"],
    ["/crm/quotes", "Operasyon", "Teklifler"],
    ["/crm/sales", "Operasyon", "Satışlar"],
    ["/crm/activities/new", "Operasyon", "Yeni Aktivite"],
    ["/crm/activities", "Operasyon", "Aktiviteler"],
    ["/crm/forecast", "Operasyon", "Forecast"],
    ["/crm/blocker-impact", "Operasyon", "Engel & Etki"],
    ["/crm/customers", "Operasyon", "Müşteriler"],
    ["/crm/customer-list", "Operasyon", "Account Atama"],
    ["/crm/customer-status-guide", "Operasyon", "Müşteri Durum Rehberi"],
    // Menüde yoktur: Canlı Ekran kişi slaydındaki "Hareketsiz Firma" sayacından yeni sekmede açılır.
    ["/crm/hareketsiz", "Operasyon", "Hareketsiz Firmalar"],
    // Menüde yoktur: Canlı Ekran kişi slaydındaki her sayaçtan yeni sekmede açılır (15.09).
    ["/crm/kirilim", "Operasyon", "Kırılım"],
    ["/crm/nova-core", "Strateji", "Nova Core"],
    ["/crm/sales-process", "Strateji", "Satış Süreci"],
    ["/crm/me", "Profil", "Hesabım"],
    ["/requests", "Operasyon", "Talepler"],
        ["/admin/parameters", "Yönetim", "Parametre Yönetimi"],
    ["/admin/users", "Yönetim", "Kullanıcı Yönetimi"],
    ["/admin/targets", "Yönetim", "Hedefler"],
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
  permissions,
  fullName,
  email,
  children,
}: {
  role: AllowedRole;
  permissions?: Permission[];
  fullName?: string | null;
  email?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Sorgu dizesi (ör. ?tab=live) menü aktifliği için: useSearchParams yerine
  // window'dan okunur (Suspense zorunluluğu ve hydration farkı yaşanmasın).
  // Sekme değişimleri replaceState ile yapıldığından sayfa "pax:locationchange"
  // olayı yayınlar; popstate ile birlikte dinlenir.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const sync = () => setSearch(window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("pax:locationchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pax:locationchange", sync);
    };
  }, [pathname]);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [customReports, setCustomReports] = useState<NavItem[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const allowed = useCallback(
    (permission: Permission) => permissions ? permissions.includes(permission) : hasPermission(role, permission),
    [permissions, role],
  );

  useEffect(() => {
    if (!(allowed('report.read.all') || allowed('report.read.team') || allowed('report.read.own'))) { setCustomReports([]); return; }
    let active = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort(); controller = new AbortController();
      try {
        const response = await fetch('/api/report-builder/pages', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) { if (active) setCustomReports([]); return; }
        const result = await response.json();
        if (active) setCustomReports((result.pages ?? []).filter((p: {show_in_menu?: boolean}) => p.show_in_menu).map((p: {id: string;title: string}) => ({href: `/crm/report-builder?page=${encodeURIComponent(p.id)}&view=live`,label:p.title,iconKey:'weekly',exact:true,hardNavigate:true})));
      } catch (error) { if (active && !(error instanceof DOMException && error.name === 'AbortError')) setCustomReports([]); }
    };
    void refresh();
    window.addEventListener('pax:reportschange', refresh);
    window.addEventListener('focus', refresh);
    return () => { active=false; controller?.abort(); window.removeEventListener('pax:reportschange', refresh); window.removeEventListener('focus', refresh); };
  }, [allowed]);

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
    // Dashboard rapor URL'inde ama menüde ayrı: açılınca Raporlar grubu kapanır.
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/canli-ekran")) setReportsOpen(false);
    else if (pathname.startsWith("/crm/reports")) setReportsOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = mobileMenuButtonRef.current;
    document.body.style.overflow = "hidden";
    const sidebar = sidebarRef.current;
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    requestAnimationFrame(() => focusable()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [menuOpen]);

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
    const tail: NavItem[] = [];
    const canDashboard = allowed('report.read.all') && allowed('screen.reports.view');

    // MENÜ (Taha, 02.10.2026): Dashboard en üstte "Genel Bakış" yerine; Talepler menünün en altında.
    // Dashboard yetkisi olmayan kullanıcıda eski Genel Bakış (/crm) kalır — menüsüz kalmasın.
    // Dashboard (eski pano) 06.10.2026'da geri açıldı. Ayrı Canlı Ekran menüsü 13.10.2026'da kaldırıldı
    // (/canli-ekran → /dashboard yönlenir).
    if (canDashboard)
      overview.push({
        href: "/dashboard",
        label: "Dashboard",
        iconKey: "dashboard",
        exact: true,
      });

    // Performans Karnesi (05.10.2026): ayrı birime açılan ekran — izinle (admin + super_admin).
    if (allowed('screen.reports.performance.view') && allowed('report.performance.read'))
      overview.push({
        href: "/performans-karnesi",
        label: "Performans Karnesi",
        iconKey: "weekly",
        exact: true,
      });

    if ((allowed('request.read.own') || allowed('request.read.all') || allowed('request.create')) && allowed('screen.requests.view'))
      tail.push({
        href: "/requests",
        label: "Talepler",
        iconKey: "requests",
      });

    if (!canDashboard && allowed('customer.read') && allowed('screen.crm.dashboard.view'))
      overview.push({
        href: "/crm",
        label: "Genel Bakış",
        iconKey: "dashboard",
        exact: true,
      });
    // OPERASYON MENÜ SIRASI — Sinan, 21.09.2026 ("bu şekilde olsun"): bilinçli sıra, alfabetik değil.
    //   1 Aktiviteler · 2 Engel & Etki · 3 Forecast · 4 Teklifler · 5 Satışlar · 6 Müşteriler · 7 Account Atama · 8 Hedefler
    // Yeni ekran eklerken yerini sorarak koy (Raporlar menüsündeki 15.09 kuralıyla aynı).
    if (allowed('activity.read') && allowed('screen.crm.activities.view'))
      operations.push({
        href: "/crm/activities",
        label: "Aktiviteler",
        iconKey: "activity",
      });
    if (allowed('forecast.read') && allowed('screen.crm.blocker_impact.view'))
      operations.push({
        href: "/crm/blocker-impact",
        label: "Engel & Etki",
        iconKey: "blocker",
      });
    if (allowed('forecast.read') && allowed('screen.crm.forecast.view'))
      operations.push({
        href: "/crm/forecast",
        label: "Forecast",
        iconKey: "forecast",
      });
    if (allowed('quote.read') && allowed('screen.crm.quotes.view'))
      operations.push({
        href: "/crm/quotes",
        label: "Teklifler",
        iconKey: "quotes",
      });
    // Satışlar: kazanılan tekliflerden türeyen düzenlenebilir satış kayıtları (07.09).
    if (allowed('quote.read') && allowed('screen.crm.quotes.view'))
      operations.push({
        href: "/crm/sales",
        label: "Satışlar",
        iconKey: "quotes",
      });
    if (allowed('customer.read') && allowed('screen.crm.customers.view'))
      operations.push({
        href: "/crm/customers",
        label: "Müşteriler",
        iconKey: "customers",
      });
    // Müşteri Listesi (H/F/L/K): Çağdaş Bey'in kişi bazlı firma dağılımı; herkes görür,
    // admin/super_admin düzenler (Sinan, 09.09). 10.09: Raporlar'dan Operasyon'a taşındı.
    if (allowed('customer.read') && allowed('screen.crm.customers.view'))
      operations.push({
        href: "/crm/customer-list",
        label: "Account Atama",
        iconKey: "customers",
      });
    // Hedefler (Çağdaş Bey, 10.09): kişi bazlı hedef girişi; yalnız admin.targets.manage
    // (admin, super_admin) görür — satışçının menüsünde çıkmaz. Yönetim menüsünde de var.
    if (allowed('admin.targets.manage') && allowed('screen.admin.targets.view'))
      operations.push({
        href: "/admin/targets",
        label: "Hedefler",
        iconKey: "forecast",
      });
    // Satış Radarı KALDIRILDI (Sinan, 17.09.2026: "Satış radarını kaldırıyoruz") — sayfa, bileşen ve
    // CSS silindi; `screen.crm.sales_radar.view` izni koddan çıkarıldı (DB'deki izin satırı zararsız durur).
    // RAPORLAR MENÜ SIRASI — Çağdaş Bey, 15.09.2026. Sıra bilinçlidir, alfabetik
    // ya da ekleme sırası değildir; yeni rapor eklerken bu listeye yerini sorarak koy.
    //   1 Dashboard (eski adı "Satışçı Takip Raporu"; Faz Raporu ve Canlı Ekran onun sekmeleri)
    //   2 Teklif Raporları · 3 Forecast Raporu · 4 KasaPOS Raporu · 5 Aktiviteler Raporu
    //   6 Satışçı Sunumu · 7 Yönetim Sunumu · 8 Entegrasyon Raporu · 9 Yıl Ziyaret & Portföy Sağlığı
    // Menüden KALKANLAR: Faz Raporu (artık Satışçı Takip Raporu'nun sekmesi),
    // Satıcı Özeti ve Kullanıcı Aktivite Sunumu (15.09'da tamamen kapatıldı — sayfaları 404).
    if (canDashboard) {
      // Canlı Ekran (Command Center) ve Faz Dashboard'un sekmeleridir (?tab=live / ?tab=faz).
      // Dashboard 05.10'dan beri /dashboard adresinde, Genel grubunda en üstte.
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
        href: "/crm/reports/kasapos-summary",
        label: "KasaPOS Raporu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/retail-operasyon",
        label: "Retail Operasyon Paneli",
        iconKey: "forecast",
      });
      reports.push({
        href: "/crm/report-builder",
        label: "Rapor Tasarımcısı",
        iconKey: "forecast",
      });
      reports.push({
        href: "/crm/reports/weekly-activities",
        label: "Aktiviteler Raporu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/seller-presentation",
        label: "Satışçı Sunumu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/weekly-management-presentation",
        label: "Yönetim Sunumu",
        iconKey: "weekly",
      });
      reports.push({
        href: "/crm/reports/entegrasyon-raporu",
        label: "KasaPOS Entegrasyon Raporu",
        iconKey: "weekly",
        exact: true,
      });      // 9. Yıl Ziyaret & Portföy Sağlığı Raporu — Taha, 22.09.2026: liste sonuna eklendi.
      reports.push({
        href: "/crm/reports/yil-ziyaret-portfoy",
        label: "Yıl Ziyaret & Portföy Sağlığı",
        iconKey: "weekly",
        exact: true,
      });
    }

    return {
      groups: [
        { title: "Genel", items: overview },
        { title: "Operasyon", items: operations },
        { title: "Destek", items: tail, tail: true },
      ].filter((group) => group.items.length > 0),
      reportsGroup: reports.length
        ? { title: "Raporlar", iconKey: "weekly", items: reports }
        : null,
    };
  }, [allowed, role]);

  const displayName = (fullName ?? "").trim() || "Demo Kullanıcı";
  const displaySub = email?.trim() || roleLabel(role);
  const initials = getInitials(displayName);
  // Dashboard rapor URL'inde yaşar ama menüde ayrı; Raporlar grubunu aktif/açık yapmasın.
  const reportsActive = pathname.startsWith("/crm/reports") || pathname.startsWith("/crm/report-builder");
  const pageMeta = useMemo(() => routeMeta(pathname), [pathname]);
  const showParameterManagement = allowed('admin.parameters.manage') && allowed('screen.admin.parameters.view');
  const showReports = Boolean(
    reportsGroup && (reportsOpen || reportsActive || collapsed),
  );
  // Tasarım sistemine (components/ui) geçmiş ekranlar eski .pax-main/.pax-main-inner
  // global kurallarından (tablo, buton, input !important) yalıtılır.
  const dsPage = DS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const hideLabel = collapsed ? "lg:hidden" : "";

  const navLink = (item: NavItem, sub = false) => {
    const active = isActive(pathname, item, search);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        onClick={item.hardNavigate ? (event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); window.location.assign(item.href); } } : undefined}
        onMouseEnter={() => prefetchRoute(item.href)}
        onFocus={() => prefetchRoute(item.href)}
        className={cx(navItemCls, sub && !collapsed && "pl-8", active && navActiveCls)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
      >
        {!sub && (
          <span className={cx(navIconWrap, active ? "bg-white/20 text-white" : ICON_TONE[item.iconKey])}>
            <NavIcon k={item.iconKey} />
          </span>
        )}
        {sub && !collapsed && (
          <i className={cx("inline-block size-1.5 shrink-0 rounded-full", active ? "bg-nav-active-bar shadow-[0_0_0_3px_rgba(17,161,242,.25)]" : "bg-nav-label")} aria-hidden="true" />
        )}
        {sub && collapsed && <span className="hidden size-4 shrink-0 items-center justify-center text-[10px] lg:flex">•</span>}
        <span className={cx("truncate", sub && collapsed && "lg:hidden")}>{item.label}</span>
      </Link>
    );
  };

  const sectionLabel = (title: string) => (
    <div className={cx("flex items-center gap-2 px-2.5 pt-5 pb-1.5 text-[10.5px] font-bold tracking-[0.14em] text-nav-label uppercase", hideLabel)}>
      {title}
      <i className="h-px flex-1 bg-nav-border" aria-hidden="true" />
    </div>
  );

  return (
    <div className="min-h-dvh bg-app-bg text-text lg:flex">
      {/* Mobil üst bar */}
      <div className="ds-nav sticky top-0 z-40 flex h-14 items-center justify-between border-0 border-b border-solid border-nav-border px-4 text-nav-text shadow-[0_4px_16px_-6px_rgba(7,5,91,.45)] lg:hidden [&_button]:text-nav-text! [&_button:hover]:bg-nav-hover!">
        <img src="/pax-logo.svg" alt="PAX Türkiye" className="h-5 w-auto brightness-0 invert" draggable={false} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconBtnCls}
            onClick={() => setDark((v) => !v)}
            aria-label="Tema değiştir"
            title={dark ? "Açık tema" : "Koyu tema"}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            ref={mobileMenuButtonRef}
            className={iconBtnCls}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menü"
            aria-expanded={menuOpen}
            aria-controls="pax-primary-sidebar"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside
        ref={sidebarRef}
        id="pax-primary-sidebar"
        className={cx(
          "fixed inset-y-0 left-0 z-50 box-border flex w-[272px] max-w-[85vw] flex-col border-0 border-r border-solid border-nav-border ds-nav text-nav-text transition-transform duration-200",
          "lg:sticky lg:top-0 lg:h-dvh lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-[width]",
          collapsed ? "lg:w-14" : "lg:w-[232px]",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Ana menü"
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen || undefined}
      >
        <div className={cx("flex h-14 shrink-0 items-center justify-between gap-2 border-0 border-b border-solid border-nav-border px-3", collapsed && "lg:justify-center lg:px-0")}>
          {!collapsed && <img src="/pax-logo.svg" alt="PAX Türkiye" className="h-6 w-auto max-w-[130px] dark:brightness-0 dark:invert" draggable={false} />}
          {collapsed && <img src="/pax-logo.svg" alt="PAX Türkiye" className="h-6 w-auto max-w-[130px] dark:brightness-0 dark:invert lg:hidden" draggable={false} />}
          <button
            type="button"
            className="hidden size-8 cursor-pointer items-center justify-center rounded-lg! border-0 bg-transparent text-nav-text hover:bg-nav-hover hover:text-nav-text-strong lg:inline-flex"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Genişlet" : "Daralt"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
          {groups.filter((g) => !g.tail).map((group) => (
            <div key={group.title}>
              {sectionLabel(group.title)}
              <nav className="flex flex-col gap-px">{group.items.map((item) => navLink(item))}</nav>
            </div>
          ))}

          {reportsGroup && (
            <div className="mt-3">
              <button
                type="button"
                className={cx(navItemCls, "w-full", reportsActive && "font-semibold text-nav-text-strong")}
                onClick={() => setReportsOpen((value) => !value)}
                aria-expanded={showReports}
                title={collapsed ? reportsGroup.title : undefined}
              >
                <span className={cx(navIconWrap, ICON_TONE[reportsGroup.iconKey])}>
                  <NavIcon k={reportsGroup.iconKey} />
                </span>
                <span className={cx("flex-1 truncate text-left", hideLabel)}>{reportsGroup.title}</span>
                <span className={cx("text-nav-label", hideLabel)}>
                  <IconChevronDown open={showReports} />
                </span>
              </button>
              {showReports && (
                <nav className="mt-px flex flex-col gap-px" aria-label="Raporlar">
                  {reportsGroup.items.map((item) => navLink(item, true))}
                  {customReports.length > 0 && <span className={cx("px-3 pt-3 pb-1 text-[10px] font-semibold text-nav-label", hideLabel)}>ÖZEL RAPORLAR</span>}
                  {customReports.map((item) => navLink(item, true))}
                </nav>
              )}
            </div>
          )}

          {groups.filter((g) => g.tail).map((group) => (
            <div key={group.title}>
              {sectionLabel(group.title)}
              <nav className="flex flex-col gap-px">{group.items.map((item) => navLink(item))}</nav>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-0 border-t border-solid border-nav-border bg-transparent p-2" data-sidebar-footer>
          <button
            type="button"
            className={cx(navItemCls, "w-full")}
            onClick={() => setDark((v) => !v)}
            title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
          >
            <span className={cx(navIconWrap, "text-amber-300")}>{dark ? <IconSun /> : <IconMoon />}</span>
            <span className={cx("truncate", hideLabel)}>{dark ? "Açık tema" : "Koyu tema"}</span>
          </button>
          <div className={cx("mt-1 flex items-center gap-2.5 px-2.5 py-1.5", collapsed && "lg:justify-center lg:px-0")}>
            <span className={avatarCls}>{initials || "U"}</span>
            <div className={cx("min-w-0", hideLabel)}>
              <div className="truncate text-[13px] font-semibold text-nav-text-strong">{displayName}</div>
              <div className="truncate text-[11px] text-nav-label">{displaySub}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className={cx("min-w-0 flex-1", !dsPage && "pax-main")}>
        <header className="sticky top-0 z-30 hidden h-12 items-center justify-between gap-4 border-0 border-b border-solid border-border bg-surface/85 px-6 backdrop-blur-md lg:flex">
          <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
            <span className="truncate text-text-3">{pageMeta.section}</span>
            <span className="text-text-4" aria-hidden="true">/</span>
            <strong className="truncate rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">{pageMeta.title}</strong>
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cx(iconBtnCls, "size-8")}
              onClick={() => setDark((v) => !v)}
              aria-label="Tema değiştir"
              title={dark ? "Açık temaya geç" : "Koyu temaya geç"}
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
            <div className="relative">
              <button
                type="button"
                className="flex h-9 cursor-pointer items-center gap-2 rounded-full! border border-solid border-border bg-surface py-0 pr-3 pl-1 text-text-2 hover:border-accent/40 hover:bg-accent-soft"
                onClick={() => setUserMenuOpen((value) => !value)}
                aria-expanded={userMenuOpen}
              >
                <span className={avatarCls}>{initials || "U"}</span>
                <span className="max-w-[180px] truncate text-[13px] font-medium">{displayName}</span>
                <IconChevronDown open={userMenuOpen} />
              </button>
              {userMenuOpen && (
                <div className="absolute top-full right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-solid border-border bg-surface p-1 shadow-ds-lg">
                  <div className="border-0 border-b border-solid border-border px-3 py-2">
                    <div className="truncate text-[13px] font-semibold text-text">{displayName}</div>
                    <div className="truncate text-xs text-text-3">{email?.trim() || roleLabel(role)}</div>
                    <div className="mt-0.5 text-[11px] tracking-wide text-text-4 uppercase">{roleLabel(role)}</div>
                  </div>
                  {(() => {
                    const showBackup = allowed('admin.backup.execute') && allowed('screen.admin.backup.view');
                    const showUsers = allowed('admin.users.manage') && allowed('screen.admin.users.view');
                    const showRbac = allowed('admin.rbac.manage') && allowed('screen.admin.rbac.view');
                    const showIdentity = allowed('admin.identity.manage') && allowed('screen.admin.identity.view');
                    // Hedefler yalnız sol menüde (Operasyon) — burada tekrar etmez.
                    const links: Array<[boolean, string, string]> = [
                      [showParameterManagement, "/admin/parameters", "Parametre Yönetimi"],
                      [showBackup, "/admin/db-backup", "DB Yedeği"],
                      [showUsers, "/admin/users", "Kullanıcı Yönetimi"],
                      [showUsers, "/admin/tv-devices", "TV Cihazları"],
                      [showRbac, "/admin/rbac", "Rol ve Yetki Yönetimi"],
                      [showIdentity, "/admin/identity", "Kimlik ve Erişim Yönetimi"],
                    ];
                    const visible = links.filter(([show]) => show);
                    if (!visible.length) return null;
                    return (
                      <div className="border-0 border-b border-solid border-border py-1">
                        {visible.map(([, href, label]) => (
                          <Link key={href} href={href} className={menuLinkCls}>
                            {label}
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="py-1">
                    <LogoutButton className={menuLinkCls} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {dsPage ? <div className="min-w-0">{children}</div> : <div className="pax-main-inner">{children}</div>}
      </main>
    </div>
  );
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** components/ui tasarım sistemine taşınmış rotalar (legacy .pax-main-inner kurallarından muaf). */
const DS_ROUTES = ["/crm/reports/retail-operasyon", "/crm/reports/weekly-activities", "/crm/reports/management"];

// Not: legacy premium-ui.css `button:not(...)` 14px radius kuralı katmansız olduğu için
// köşe yarıçapı önemli (!) işaretiyle verilir.
const navItemCls =
  "relative flex h-10 cursor-pointer items-center gap-2.5 overflow-hidden rounded-[10px]! border-0 bg-transparent px-2 text-[13px]! font-medium whitespace-nowrap text-nav-text no-underline transition-colors hover:bg-nav-hover hover:text-nav-text-strong lg:h-9";
const navActiveCls =
  "ds-nav-active font-semibold text-white! hover:text-white! shadow-[0_6px_16px_-8px_rgba(11,111,214,.7)]";
const navIconWrap = "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors";
// Menü ikonları: yumuşak kategori kutucuğu (light: 50/600, dark: 500/15 + 300).
const ICON_TONE: Record<IconKey, string> = {
  dashboard: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  activity: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  customers: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  quotes: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  forecast: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
  blocker: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  weekly: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  users: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  settings: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  backup: "bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  requests: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
};
const iconBtnCls =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-[10px]! border-0 bg-transparent text-text-3 hover:bg-accent-soft hover:text-accent";
const avatarCls =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-2 to-brand-navy text-[10.5px] font-bold text-white ring-2 ring-white/20";
const menuLinkCls =
  "flex h-10 w-full cursor-pointer items-center rounded-lg! border-0 bg-transparent px-3 text-left text-[13px]! text-text-2 no-underline hover:bg-accent-soft hover:text-accent lg:h-8";
