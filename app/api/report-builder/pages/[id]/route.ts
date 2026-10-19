import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { archivePage, getPage, savePageSchema, updatePage } from '@/lib/report-builder/pages-repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const page = await getPage(user, (await ctx.params).id);
    if (!page) throw Object.assign(new Error('Sayfa bulunamadı'), { status: 404 });
    return NextResponse.json({ page });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const version = await updatePage(user, (await ctx.params).id, await parseJsonBody(request, savePageSchema));
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

/** Kalıcı silme yok: arşivler. */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    await archivePage(user, (await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
