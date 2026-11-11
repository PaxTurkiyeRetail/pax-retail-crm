import { getUserDepartments, requirePermissionOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import QuotePortfolioClient from '@/components/quotes/QuotePortfolioClient';

export default async function QuotesPage() {
  const me = await requirePermissionOrThrow('quote.read');
  await requireScreenAccessOrThrow('screen.crm.quotes.view');
  const allowedDepartments = await getUserDepartments(me);
  // Satıcı filtresi yalnız quote.read.any ile anlamlı (diğerleri zaten kendi teklifini görür).
  const ownerOptions = userHasPermission(me, 'quote.read.any') ? await loadOwnerOptions({ departments: allowedDepartments }) : [];

  return (
    <div className="pax-page-container">
      <QuotePortfolioClient ownerOptions={ownerOptions} allowedDepartments={allowedDepartments} />
    </div>
  );
}
