import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import QuoteDetailClient from '@/components/quotes/QuoteDetailClient';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  await requireCrmAccessOrThrow();
  const { quoteId } = await params;

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="quotes-detail" />
      <QuoteDetailClient quoteId={quoteId} />
    </div>
  );
}
