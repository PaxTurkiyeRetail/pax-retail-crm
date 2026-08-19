import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';
import QuotePortfolioClient from '@/components/quotes/QuotePortfolioClient';

export default async function QuotesPage() {
  await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');

  return (
    <div className="pax-page-container">
      <QuoteHeroDashboard />
      <QuotePortfolioClient />
    </div>
  );
}
