import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';
import QuotePortfolioClient from '@/components/quotes/QuotePortfolioClient';

export default async function QuotesPage() {
  await requireCrmAccessOrThrow();

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="quotes" />
      <QuoteHeroDashboard />
      <QuotePortfolioClient />
    </div>
  );
}
