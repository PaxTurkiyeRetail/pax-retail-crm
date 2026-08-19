import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import QuoteBuilderClient from '@/components/quotes/QuoteBuilderClient';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';

export default async function NewQuotePage() {
  await requirePermissionOrThrow('quote.create');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  return (
    <div className="pax-page-container">
      <QuoteHeroDashboard />
      <QuoteBuilderClient />
    </div>
  );
}
