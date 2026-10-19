import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { istanbulToday } from '@/lib/report-builder/dates';
import { getDefinition } from '@/lib/report-builder/definitions-repo';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { runPage } from '@/lib/report-builder/page-runner';
import { definitionToPage, parsePageDefinition, type PageDefinition } from '@/lib/report-builder/page-types';
import { getPage, loadLetterheadAsset } from '@/lib/report-builder/pages-repo';
import { loadPdfFonts, pdfFileName, renderPagePdf } from '@/lib/report-builder/pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  pageId: z.string().uuid().optional(),
  page: z.unknown().optional(),
  definitionId: z.string().uuid().optional(),
  definition: z.unknown().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  values: z.record(z.string(), z.unknown()).default({}),
  /** uuid → o antet; null → antetsiz; verilmezse sayfanın anteti, o da yoksa varsayılan. */
  letterheadId: z.string().uuid().nullable().optional(),
  inline: z.boolean().default(false),
});

// POST → application/pdf (rapor-adı_tarih.pdf). inline=true → yazdırma önizlemesi (iframe).
export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const body = await parseJsonBody(request, bodySchema);
    let page: PageDefinition;
    let pageLetterhead: string | null = null;
    if (body.pageId) {
      const saved = await getPage(user, body.pageId);
      if (!saved) throw Object.assign(new Error('Sayfa bulunamadı'), { status: 404 });
      page = saved.page;
      pageLetterhead = saved.letterhead_id;
    } else if (body.page !== undefined) {
      page = parsePageDefinition(body.page);
    } else if (body.definitionId) {
      const saved = await getDefinition(user, body.definitionId);
      if (!saved) throw Object.assign(new Error('Rapor bulunamadı'), { status: 404 });
      page = definitionToPage(saved.definition, body.title ?? saved.title);
    } else if (body.definition !== undefined) {
      page = definitionToPage(body.definition, body.title ?? 'Rapor');
    } else {
      throw Object.assign(new Error('pageId, page, definitionId veya definition gerekli'), { status: 400 });
    }

    const letterheadId = body.letterheadId === null ? null : body.letterheadId ?? page.pdf.letterheadId ?? pageLetterhead;
    const [data, letterhead, fonts] = await Promise.all([
      runPage(user, page, body.values),
      body.letterheadId === null ? Promise.resolve(null) : loadLetterheadAsset(letterheadId),
      loadPdfFonts(),
    ]);
    const date = istanbulToday();
    const bytes = await renderPagePdf({ page, data, letterhead, fonts, date });
    const name = pdfFileName(page.title, date);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `${body.inline ? 'inline' : 'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
