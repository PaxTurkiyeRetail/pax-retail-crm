import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import { requireAdminOrThrow } from '@/lib/authz';
import QuotesCatalogAdminClient from '@/components/quotes-admin/QuotesCatalogAdminClient';

export default async function QuotesCatalogPage() {
  await requireAdminOrThrow();
  return <div style={{ display: 'grid', gap: 16 }}><SystemRequirementStamp pageKey="quoteCatalog" /><QuotesCatalogAdminClient /></div>;
}
