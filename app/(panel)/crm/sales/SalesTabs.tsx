import Link from 'next/link';

// Satışlar ekranı sekmeleri (14.09): Cihaz Satışları | Hizmet Faturaları.
// Sekme URL'de (?tab=hizmet) durur → yer imi verilebilir, menü vurgusu /crm/sales'te kalır.
// Sunucu bileşeni: istemci JS'i yok; renkler globals token'larından (kural 9).
export type SalesTab = 'cihaz' | 'hizmet';

const TABS: Array<{ key: SalesTab; href: string; label: string; hint: string }> = [
  { key: 'cihaz', href: '/crm/sales', label: 'Cihaz Satışları', hint: 'teklifden ve teklifsiz satışlar · USD' },
  { key: 'hizmet', href: '/crm/sales?tab=hizmet', label: 'Hizmet Faturaları', hint: 'aylık entegrasyon / kullanım faturaları · TL & USD' },
];

export function resolveSalesTab(value: string | string[] | undefined): SalesTab {
  return (Array.isArray(value) ? value[0] : value) === 'hizmet' ? 'hizmet' : 'cihaz';
}

export default function SalesTabs({ active }: { active: SalesTab }) {
  return (
    <nav aria-label="Satış türü" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 6, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--surface-2)', width: 'fit-content' }}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'grid', gap: 2, padding: '8px 16px', borderRadius: 13, textDecoration: 'none', minWidth: 200,
              background: isActive ? 'var(--surface)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              color: isActive ? 'var(--text)' : 'var(--text-2)',
            }}
          >
            <span style={{ fontWeight: 900, fontSize: 14 }}>{tab.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)' }}>{tab.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
