import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/http/api-error';
import { builderErrorResponse,requireReportBuilderUser } from '@/lib/report-builder/http';
import { captureSnapshot,listSnapshots } from '@/lib/report-builder/snapshots';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
const bodySchema=z.object({title:z.string().trim().min(1).max(120),values:z.record(z.string(),z.unknown()).default({})});
export async function GET(_request:Request,ctx:Ctx){try{const user=await requireReportBuilderUser();return NextResponse.json({snapshots:await listSnapshots(user,z.uuid().parse((await ctx.params).id))});}catch(e){return builderErrorResponse(e);}}
export async function POST(request:Request,ctx:Ctx){try{const user=await requireReportBuilderUser();const body=await parseJsonBody(request,bodySchema);return NextResponse.json({snapshot:await captureSnapshot(user,z.uuid().parse((await ctx.params).id),body.title,body.values)},{status:201});}catch(e){return builderErrorResponse(e);}}
