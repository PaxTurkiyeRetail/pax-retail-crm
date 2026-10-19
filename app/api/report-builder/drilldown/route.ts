import { NextResponse } from 'next/server';
import { prepareDrilldown } from '@/lib/report-builder/drilldown';
import { executeReport } from '@/lib/report-builder/executor';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { parseReportDefinition, ReportDefinitionError } from '@/lib/report-builder/types';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const body = await request.json().catch(() => null);
    const definition = parseReportDefinition(body?.definition);
    if (!body?.row || typeof body.row !== 'object' || Array.isArray(body.row)) throw new ReportDefinitionError('Kırılım satırı gerekli');
    const prepared = prepareDrilldown(definition, body.row, user);
    if (prepared.validationDefinition) {
      const parent = await executeReport(prepared.validationDefinition, prepared.scope);
      if (!parent.rows.length) throw Object.assign(new Error('Seçilen grup rapor koşullarını sağlamıyor.'), { status: 404 });
    }
    return NextResponse.json(await executeReport(prepared.definition, prepared.scope));
  } catch (error) { return builderErrorResponse(error); }
}

