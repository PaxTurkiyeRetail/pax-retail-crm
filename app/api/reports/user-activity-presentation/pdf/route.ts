import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { buildUserActivityPresentation } from '@/lib/user-activity-presentation';
import { generateUserActivityPresentationPdf } from '@/lib/user-activity-presentation-pdf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeFilePart(value: string) {
  return String(value || 'kullanici')
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
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'kullanici';
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request) {
  try {
    await requireAdminOrThrow();
    const url = new URL(request.url);
    const from = String(url.searchParams.get('from') ?? '').trim();
    const to = String(url.searchParams.get('to') ?? '').trim();
    const userId = String(url.searchParams.get('user_id') ?? '').trim();
    const payload = await buildUserActivityPresentation({ from, to, userId });
    const buffer = await generateUserActivityPresentationPdf(payload);
    const filename = `kullanici-aktivite-sunumu-${safeFilePart(payload.filters.user_name)}-${from}-${to}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'PDF oluşturulamadı.' }, { status: error?.status || 500 });
  }
}
