import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { generateWeeklyManagementPresentationPptx } from '@/lib/weekly-management-pptx';
import { getSystemParameterBoolean } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function asciiFilePart(value: string) {
  return String(value || 'presentation')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'presentation';
}

function contentDispositionAttachment(filename: string) {
  const asciiFilename = asciiFilePart(filename.replace(/\.pptx$/i, '')) + '.pptx';
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const pptxEnabled = await getSystemParameterBoolean('system_pptx_download_enabled', true);
    if (!pptxEnabled) return NextResponse.json({ message: 'PPTX indirme sistem parametresinden kapalı.' }, { status: 403 });
    const admin = createPgAdminClient();
    const url = new URL(request.url);
    const from = String(url.searchParams.get('from') ?? '').trim();
    const to = String(url.searchParams.get('to') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const segment = String(url.searchParams.get('segment') ?? '').trim();
    const { buffer } = await generateWeeklyManagementPresentationPptx(admin, { from, to, owner, segment });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': contentDispositionAttachment(`haftalik-yonetim-sunumu-${from || 'auto'}-${to || 'auto'}.pptx`),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'PPTX oluşturulamadı' }, { status: error?.status || 500 });
  }
}
