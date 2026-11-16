import { requireQuoteCatalogReadOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import QuotesCatalogAdminClient from '@/components/quotes-admin/QuotesCatalogAdminClient';

export default async function QuotesCatalogPage() {
  const user = await requireQuoteCatalogReadOrThrow();
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  return <div style={{ display: 'grid', gap: 16 }}><QuotesCatalogAdminClient canManage={userHasPermission(user, 'quote.catalog.manage')} /></div>;
}
