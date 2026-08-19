import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import QuoteReportsClient from './QuoteReportsClient';

export default async function QuoteReportsPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <QuoteReportsClient />;
}
