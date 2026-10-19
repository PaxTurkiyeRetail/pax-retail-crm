import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { automationSchema } from '@/lib/report-builder/automation-types';
import { disableAutomation, saveAutomation, executeAutomation } from '@/lib/report-builder/automation';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context) {
  try {
    const user=await requireReportBuilderUser(); const {id}=await context.params;
    return NextResponse.json({data:await saveAutomation(user,await parseJsonBody(request,automationSchema),z.string().uuid().parse(id))});
  } catch(error) {return builderErrorResponse(error);}
}
export async function DELETE(_request:Request,context:Context) {
  try {
    const user=await requireReportBuilderUser(); const {id}=await context.params;
    await disableAutomation(user,z.string().uuid().parse(id)); return NextResponse.json({ok:true});
  } catch(error) {return builderErrorResponse(error);}
}
// Manual tests always use preview mode and never send mail or move the due cursor.
export async function POST(_request:Request,context:Context) {
  try {
    const user=await requireReportBuilderUser(); const {id}=await context.params;
    return NextResponse.json({data:await executeAutomation(z.string().uuid().parse(id),{previewUser:user})});
  } catch(error) {return builderErrorResponse(error);}
}
