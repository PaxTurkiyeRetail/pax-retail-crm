import QuoteDetailClient from '@/components/quotes/QuoteDetailClient';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  return <QuoteDetailClient quoteId={quoteId} />;
}
