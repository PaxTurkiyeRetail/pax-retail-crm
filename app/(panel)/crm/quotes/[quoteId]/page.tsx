import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import QuoteDetailClient from '@/components/quotes/QuoteDetailClient';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  const { quoteId } = await params;

  return (
    <div className="pax-page-container">
      <QuoteDetailClient quoteId={quoteId} />
    </div>
  );
}
