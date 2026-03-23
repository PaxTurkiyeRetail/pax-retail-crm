import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import QuoteBuilderClient from '@/components/quotes/QuoteBuilderClient';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';

export default async function NewQuotePage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="quoteBuilder" />
      <QuoteHeroDashboard />
      <QuoteBuilderClient />
    </div>
  );
}
