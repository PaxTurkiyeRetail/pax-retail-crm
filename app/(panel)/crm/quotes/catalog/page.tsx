import { requireQuoteCatalogAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import QuotesCatalogAdminClient from '@/components/quotes-admin/QuotesCatalogAdminClient';

export default async function QuotesCatalogPage() {
  await requireQuoteCatalogAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  return <div style={{ display: 'grid', gap: 16 }}><QuotesCatalogAdminClient /></div>;
}
