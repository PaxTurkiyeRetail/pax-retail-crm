import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { generateSellerFollowupPptx } from '@/lib/reports/seller-followup-pptx';
import { followupPptxFileName } from '@/lib/reports/seller-followup-pptx-shared';
import { getSystemParameterBoolean } from '@/lib/system-parameters';

// Takip Listesi sunumu indirme (Sinan, 16.09.2026).
// `owner` boş gelirse TÜM satışçılar tek dosyada, kişi kişi slaytlanır ("Hepsi").
// Satışçı Sunumu rotasının aksine owner ZORUNLU DEĞİLDİR — talep edilen "hepsi" seçeneği budur.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function asciiFilePart(value: string) {
  return String(value || 'takip-listesi')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'takip-listesi';
}

function contentDispositionAttachment(filename: string) {
  const asciiFilename = asciiFilePart(filename.replace(/\.pptx$/i, '')) + '.pptx';
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const pptxEnabled = await getSystemParameterBoolean('system_pptx_download_enabled', true);
    if (!pptxEnabled) {
      return NextResponse.json({ message: 'PPTX indirme sistem parametresinden kapalı.' }, { status: 403 });
    }
    const url = new URL(request.url);
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const today = new Date();
    const { buffer, slideCount } = await generateSellerFollowupPptx({ owner, today });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': contentDispositionAttachment(followupPptxFileName(owner, today)),
        'X-Slide-Count': String(slideCount),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'PPTX oluşturulamadı' }, { status: error?.status || 500 });
  }
}
