import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/http/api-error';
import { canManageLetterheads } from '@/lib/report-builder/access';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { letterheadSettingsSchema } from '@/lib/report-builder/page-types';
import { deactivateLetterhead, loadLetterheadImage, updateLetterhead } from '@/lib/report-builder/pages-repo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Antet görseli (önizleme). */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireReportBuilderUser();
    const img = await loadLetterheadImage((await ctx.params).id);
    if (!img) throw Object.assign(new Error('Antet bulunamadı'), { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), {
      headers: { 'content-type': img.mimeType, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' },
    });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

async function requireManager() {
  const user = await requireReportBuilderUser();
  if (!canManageLetterheads(user)) throw Object.assign(new Error('Antet yönetim yetkiniz yok'), { status: 403 });
  return user;
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const user = await requireManager();
    await updateLetterhead(user, (await ctx.params).id, await parseJsonBody(request, letterheadSettingsSchema));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

/** Silme yok: pasifleştirir. */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireManager();
    await deactivateLetterhead(user, (await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
