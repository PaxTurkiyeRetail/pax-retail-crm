import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SalesClient from './SalesClient';
import ServiceInvoicesClient from './ServiceInvoicesClient';
import SalesTabs, { resolveSalesTab } from './SalesTabs';

// Satışlar — iki sekme (14.09): Cihaz Satışları (crm_sales) | Hizmet Faturaları (crm_service_invoices, 032).
// İki sekme aynı kapıdan geçer (quote.read + screen.crm.quotes.view); API'ler yetkiyi ayrıca doğrular.
export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  const tab = resolveSalesTab((await searchParams).tab);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SalesTabs active={tab} />
      {tab === 'hizmet' ? <ServiceInvoicesClient /> : <SalesClient />}
    </div>
  );
}
