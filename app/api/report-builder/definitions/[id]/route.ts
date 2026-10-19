import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import {
  archiveDefinition, getDefinition, saveDefinitionSchema, setFavorite, updateDefinition,
} from '@/lib/report-builder/definitions-repo';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const { id } = await ctx.params;
    const definition = await getDefinition(user, id);
    if (!definition) throw Object.assign(new Error('Rapor bulunamadı'), { status: 404 });
    return NextResponse.json({ definition });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const { id } = await ctx.params;
    await updateDefinition(user, id, await parseJsonBody(request, saveDefinitionSchema));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

const patchSchema = z.object({ favorite: z.boolean() });

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const { id } = await ctx.params;
    const { favorite } = await parseJsonBody(request, patchSchema);
    await setFavorite(user, id, favorite);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

/** Kalıcı silme yok: arşivler (is_archived = true). */
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireReportBuilderUser();
    const { id } = await ctx.params;
    await archiveDefinition(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
