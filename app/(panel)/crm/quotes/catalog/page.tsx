import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import QuotesCatalogAdminClient from '@/components/quotes-admin/QuotesCatalogAdminClient';

export default async function QuotesCatalogPage() {
  await requireAllowedUserOrThrow();
  return <div style={{ display: 'grid', gap: 16 }}><SystemRequirementStamp pageKey="quoteCatalog" /><QuotesCatalogAdminClient /></div>;
}
