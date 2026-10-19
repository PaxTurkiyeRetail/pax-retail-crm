import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { listPageVersions, restorePageVersion } from '@/lib/report-builder/pages-repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    return NextResponse.json({ versions: await listPageVersions(user, (await ctx.params).id) });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

/** Geri alma: { version } içeriği yeni sürüm olarak kaydedilir. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const { version } = await parseJsonBody(request, z.object({ version: z.number().int().positive() }));
    const next = await restorePageVersion(user, (await ctx.params).id, version);
    return NextResponse.json({ ok: true, version: next });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
