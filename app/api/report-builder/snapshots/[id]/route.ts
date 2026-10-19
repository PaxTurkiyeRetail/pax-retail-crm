import { NextResponse } from 'next/server';
import { z } from 'zod';
import { builderErrorResponse,requireReportBuilderUser } from '@/lib/report-builder/http';
import { readSnapshot } from '@/lib/report-builder/snapshots';
export const dynamic='force-dynamic';
export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){try{const user=await requireReportBuilderUser();return NextResponse.json({snapshot:await readSnapshot(user,z.uuid().parse((await ctx.params).id))});}catch(e){return builderErrorResponse(e);}}
