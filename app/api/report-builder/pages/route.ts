import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { canDesignPages, canManageLetterheads } from '@/lib/report-builder/access';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { createPage, listPages, savePageSchema } from '@/lib/report-builder/pages-repo';
import { PAGE_TEMPLATES } from '@/lib/report-builder/templates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireReportBuilderUser();
    return NextResponse.json({
      pages: await listPages(user),
      templates: Object.entries(PAGE_TEMPLATES).map(([key, t]) => ({ key, label: t.label })),
      canDesign: canDesignPages(user),
      canManageLetterheads: canManageLetterheads(user),
    });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

const createSchema = savePageSchema.extend({
  // Zod 4 requires unknown fields; templates provide the page server-side.
  page: z.unknown().default(null),
  templateKey: z.string().regex(/^[a-z_]{1,40}$/).optional(),
}).refine((input) => Boolean(input.templateKey) || input.page != null, {
  path: ['page'], message: 'Bir pano veya hazır pano seçin.',
});

export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const input = await parseJsonBody(request, createSchema);
    const id = await createPage(user, input, input.templateKey);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
