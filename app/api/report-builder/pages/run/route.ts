import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { runPage } from '@/lib/report-builder/page-runner';
import { parsePageDefinition } from '@/lib/report-builder/page-types';
import { getPage } from '@/lib/report-builder/pages-repo';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  pageId: z.string().uuid().optional(),
  /** Kaydedilmemiş (designer) sayfa — doğrulanır, yetki her widget'ta ayrıca kontrol edilir. */
  page: z.unknown().optional(),
  values: z.record(z.string(), z.unknown()).default({}),
  widgetIds: z.array(z.string().max(40)).max(60).optional(),
});

// POST → { data: { [widgetId]: { result?, forecast?, error? } } }
export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const body = await parseJsonBody(request, bodySchema);
    let page;
    if (body.pageId) {
      const saved = await getPage(user, body.pageId);
      if (!saved) throw Object.assign(new Error('Sayfa bulunamadı'), { status: 404 });
      page = saved.page;
    } else {
      page = parsePageDefinition(body.page);
    }
    return NextResponse.json({ data: await runPage(user, page, body.values, body.widgetIds) });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
