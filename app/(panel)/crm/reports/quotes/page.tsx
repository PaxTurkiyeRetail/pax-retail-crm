import { getUserDepartments, requireReportsAccessOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import QuoteReportsClient from './QuoteReportsClient';

export default async function QuoteReportsPage() {
  const me = await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  const allowedDepartments = await getUserDepartments(me);
  // Satıcı filtresi yalnız quote.read.any ile anlamlı (API diğerlerini kendi teklifine daraltır).
  const ownerOptions = userHasPermission(me, 'quote.read.any') ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
  return <QuoteReportsClient ownerOptions={ownerOptions} allowedDepartments={allowedDepartments} />;
}
