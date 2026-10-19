import { notFound } from 'next/navigation';
import { requireAllowedUserOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { canDesignPages, canManageLetterheads, canUseReportBuilder } from '@/lib/report-builder/access';
import ReportBuilderApp from './_components/ReportBuilderApp';

export const dynamic = 'force-dynamic';

// Rapor Geliştirme Aracı — menüde YOK; /crm/report-builder adresiyle erişilir.
export default async function ReportBuilderPage() {
  await requireScreenAccessOrThrow('screen.reports.view');
  const user = await requireAllowedUserOrThrow();
  const permissions = user.permissions ?? [];
  if (!canUseReportBuilder({ permissions })) notFound();
  return (
    <ReportBuilderApp
      canDesign={canDesignPages({ permissions })}
      canManageLetterheads={canManageLetterheads({ permissions })}
    />
  );
}
