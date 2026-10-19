import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { automationSchema } from '@/lib/report-builder/automation-types';
import { listAutomations, saveAutomation } from '@/lib/report-builder/automation';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const user=await requireReportBuilderUser();
    const pageId=z.string().uuid().parse(new URL(request.url).searchParams.get('pageId'));
    return NextResponse.json({data:await listAutomations(user,pageId)});
  } catch(error) {return builderErrorResponse(error);}
}
export async function POST(request:Request) {
  try {
    const user=await requireReportBuilderUser();
    return NextResponse.json({data:await saveAutomation(user,await parseJsonBody(request,automationSchema))});
  } catch(error) {return builderErrorResponse(error);}
}
