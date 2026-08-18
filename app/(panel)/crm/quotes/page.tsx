import { requirePermissionOrThrow } from '@/lib/authz';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';
import QuotePortfolioClient from '@/components/quotes/QuotePortfolioClient';

export default async function QuotesPage() {
  await requirePermissionOrThrow('quote.read');

  return (
    <div className="pax-page-container">
      <QuoteHeroDashboard />
      <QuotePortfolioClient />
    </div>
  );
}
