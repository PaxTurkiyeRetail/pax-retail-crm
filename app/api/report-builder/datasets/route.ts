import { NextResponse } from 'next/server';
import { datasetCatalog } from '@/lib/report-builder/datasets';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { resolveRowScope } from '@/lib/report-builder/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireReportBuilderUser();
    const datasets = datasetCatalog((permission) => user.permissions.includes(permission));
    return NextResponse.json({ datasets, scope: resolveRowScope(user)?.kind ?? null });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
