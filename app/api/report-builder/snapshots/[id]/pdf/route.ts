import { NextResponse } from 'next/server';
import { builderErrorResponse,requireReportBuilderUser } from '@/lib/report-builder/http';
import { readSnapshot } from '@/lib/report-builder/snapshots';
import { loadLetterheadAsset } from '@/lib/report-builder/pages-repo';
import { loadPdfFonts,pdfFileName,renderPagePdf } from '@/lib/report-builder/pdf';
import { istanbulToday } from '@/lib/report-builder/dates';
export const dynamic='force-dynamic';
export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){try{const user=await requireReportBuilderUser();const saved=await readSnapshot(user,(await ctx.params).id);const date=istanbulToday(new Date(saved.created_at));const [fonts,letterhead]=await Promise.all([loadPdfFonts(),saved.page.pdf.noLetterhead?Promise.resolve(null):loadLetterheadAsset(saved.page.pdf.letterheadId)]);const bytes=await renderPagePdf({page:saved.page,data:saved.results,fonts,letterhead,date});return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${pdfFileName(saved.title,date)}"`,'Cache-Control':'private, no-store'}});}catch(e){return builderErrorResponse(e);}}
