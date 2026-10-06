// Ekran → gereken yetkiler. Sol menüdeki (components/PanelShell.tsx) görünürlük kurallarının
// okunabilir kopyası; Yetki Yönetimi ekranındaki "kim neyi görür" tablosu buradan hesaplanır.
// PanelShell'de bir menü koşulu değişirse burayı da güncelle.

export type ScreenRule = {
  group: string;
  label: string;
  href: string;
  /** Hepsi gerekli. */
  all: string[];
  /** En az biri gerekli (boşsa koşul yok). */
  anyOf?: string[];
  note?: string;
};

export const SCREEN_RULES: ScreenRule[] = [
  { group: 'Genel', label: 'Dashboard', href: '/dashboard', all: ['screen.reports.view', 'report.read.all'], note: 'Açılış ekranı' },
  { group: 'Genel', label: 'Canlı Ekran', href: '/canli-ekran', all: ['screen.reports.view', 'report.read.all'], note: 'Tek sayfa takım/kişi durumu' },
  { group: 'Genel', label: 'Performans Karnesi', href: '/performans-karnesi', all: ['screen.reports.performance.view', 'report.performance.read'], note: 'Admin + Super Admin' },
  { group: 'Genel', label: 'Genel Bakış', href: '/crm', all: ['screen.crm.dashboard.view', 'customer.read'], note: 'Dashboard yetkisi yoksa açılış ekranı' },

  { group: 'Operasyon', label: 'Aktiviteler', href: '/crm/activities', all: ['screen.crm.activities.view', 'activity.read'] },
  { group: 'Operasyon', label: 'Engel & Etki', href: '/crm/blocker-impact', all: ['screen.crm.blocker_impact.view', 'forecast.read'] },
  { group: 'Operasyon', label: 'Forecast', href: '/crm/forecast', all: ['screen.crm.forecast.view', 'forecast.read'] },
  { group: 'Operasyon', label: 'Teklifler', href: '/crm/quotes', all: ['screen.crm.quotes.view', 'quote.read'] },
  { group: 'Operasyon', label: 'Satışlar', href: '/crm/sales', all: ['screen.crm.quotes.view', 'quote.read'] },
  { group: 'Operasyon', label: 'Müşteriler', href: '/crm/customers', all: ['screen.crm.customers.view', 'customer.read'] },
  { group: 'Operasyon', label: 'Account Atama', href: '/crm/customer-list', all: ['screen.crm.customers.view', 'customer.read'] },
  { group: 'Operasyon', label: 'Hedefler', href: '/admin/targets', all: ['screen.admin.targets.view', 'admin.targets.manage'] },

  { group: 'Raporlar', label: 'Tüm raporlar', href: '/crm/reports', all: ['screen.reports.view', 'report.read.all'], note: 'Teklif, Forecast, KasaPOS, Aktiviteler, Sunumlar, Entegrasyon, Yıl Ziyaret' },

  { group: 'Destek', label: 'Talepler', href: '/requests', all: ['screen.requests.view'], anyOf: ['request.read.own', 'request.read.all', 'request.create'] },

  { group: 'Yönetim', label: 'Parametreler', href: '/admin/parameters', all: ['screen.admin.parameters.view', 'admin.parameters.manage'] },
  { group: 'Yönetim', label: 'Kullanıcılar', href: '/admin/users', all: ['screen.admin.users.view', 'admin.users.manage'] },
  { group: 'Yönetim', label: 'Yetki Yönetimi', href: '/admin/rbac', all: ['screen.admin.rbac.view', 'admin.rbac.manage'] },
  { group: 'Yönetim', label: 'Kimlik / AD Grupları', href: '/admin/identity', all: ['screen.admin.identity.view', 'admin.identity.manage'] },
  { group: 'Yönetim', label: 'DB Yedek', href: '/admin/db-backup', all: ['screen.admin.backup.view', 'admin.backup.execute'] },
];

export function screenAccess(rule: ScreenRule, has: (permission: string) => boolean) {
  const missingAll = rule.all.filter((p) => !has(p));
  const anyOk = !rule.anyOf?.length || rule.anyOf.some(has);
  return {
    visible: missingAll.length === 0 && anyOk,
    missing: anyOk ? missingAll : [...missingAll, rule.anyOf![0]],
    anyOfMissing: !anyOk,
  };
}
