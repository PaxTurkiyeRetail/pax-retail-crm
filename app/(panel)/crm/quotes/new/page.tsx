import { requirePermissionOrThrow } from '@/lib/authz';
import QuoteBuilderClient from '@/components/quotes/QuoteBuilderClient';
import QuoteHeroDashboard from '@/components/quotes/QuoteHeroDashboard';

export default async function NewQuotePage() {
  await requirePermissionOrThrow('quote.create');
  return (
    <div className="pax-page-container">
      <QuoteHeroDashboard />
      <QuoteBuilderClient />
    </div>
  );
}
