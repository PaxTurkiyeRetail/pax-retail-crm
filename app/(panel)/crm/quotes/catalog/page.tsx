import { requireQuoteCatalogAccessOrThrow } from '@/lib/authz';
import QuotesCatalogAdminClient from '@/components/quotes-admin/QuotesCatalogAdminClient';

export default async function QuotesCatalogPage() {
  await requireQuoteCatalogAccessOrThrow();
  return <div style={{ display: 'grid', gap: 16 }}><QuotesCatalogAdminClient /></div>;
}
