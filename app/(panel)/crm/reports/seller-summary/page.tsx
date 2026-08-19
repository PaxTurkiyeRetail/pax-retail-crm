import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SellerSummaryClient from './SellerSummaryClient';

export default async function SellerSummaryPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <SellerSummaryClient />;
}
