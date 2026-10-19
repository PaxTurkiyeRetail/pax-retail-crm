import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/http/api-error';
import { createDefinition, listDefinitions, saveDefinitionSchema } from '@/lib/report-builder/definitions-repo';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireReportBuilderUser();
    return NextResponse.json({ definitions: await listDefinitions(user), userId: user.id });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    const input = await parseJsonBody(request, saveDefinitionSchema);
    const id = await createDefinition(user, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
