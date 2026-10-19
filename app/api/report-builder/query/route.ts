import { NextResponse } from 'next/server';
import { canAccessDataset, resolveRowScope } from '@/lib/report-builder/access';
import { getDataset } from '@/lib/report-builder/datasets';
import { executeReport } from '@/lib/report-builder/executor';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { toCsv } from '@/lib/report-builder/result';
import { parseReportDefinition } from '@/lib/report-builder/types';

export const dynamic = 'force-dynamic';

// POST { definition } → sonuç. ?format=csv → Excel uyumlu CSV indirimi.
export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const body = await request.json().catch(() => null);
    const definition = parseReportDefinition(body?.definition);
    const dataset = getDataset(definition.dataset);
    if (!dataset || !canAccessDataset(user, dataset)) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
    const scope = resolveRowScope(user);
    if (!scope) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });

    const result = await executeReport(definition, scope);
    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const name = `rapor-${dataset.key}-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(toCsv(result.columns, result.rows), {
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` },
      });
    }
    return NextResponse.json({ ...result, scope: scope.kind });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
