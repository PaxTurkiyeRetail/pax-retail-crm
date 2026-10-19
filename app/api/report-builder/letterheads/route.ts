import { NextResponse } from 'next/server';
import { canManageLetterheads } from '@/lib/report-builder/access';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { letterheadSettingsSchema } from '@/lib/report-builder/page-types';
import { createLetterhead, listLetterheads } from '@/lib/report-builder/pages-repo';
import { validateLetterheadFile } from '@/lib/report-builder/pdf';
import { ReportDefinitionError } from '@/lib/report-builder/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  try {
    const user = await requireReportBuilderUser();
    return NextResponse.json({ letterheads: await listLetterheads(), canManage: canManageLetterheads(user) });
  } catch (error) {
    return builderErrorResponse(error);
  }
}

// POST multipart/form-data: file (PNG/JPG/tek sayfa PDF, ≤5MB) + settings (JSON metni).
// Depolama: DB bytea (report_letterheads.image_data) — projede dosya sistemi yükleme düzeni yok,
// tek sunucu + pm2; yedekleme DB yedeğiyle birlikte gelir.
export async function POST(request: Request) {
  try {
    const user = await requireReportBuilderUser();
    if (!canManageLetterheads(user)) throw Object.assign(new Error('Antet yönetim yetkiniz yok (report.letterhead.manage)'), { status: 403 });
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES + 64 * 1024) throw Object.assign(new Error('Dosya en fazla 5 MB olabilir'), { status: 413 });
    const form = await request.formData().catch(() => null);
    if (!form) throw Object.assign(new Error('multipart/form-data bekleniyor'), { status: 400 });
    const file = form.get('file');
    if (!(file instanceof Blob) || file.size === 0) throw Object.assign(new Error('Dosya gerekli'), { status: 400 });
    if (file.size > MAX_BYTES) throw Object.assign(new Error('Dosya en fazla 5 MB olabilir'), { status: 413 });
    let rawSettings: unknown;
    try { rawSettings = JSON.parse(String(form.get('settings') ?? '{}')); } catch { rawSettings = null; }
    const parsed = letterheadSettingsSchema.safeParse(rawSettings);
    if (!parsed.success) throw new ReportDefinitionError('Antet ayarları geçersiz', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = await validateLetterheadFile(bytes, file.type);
    const id = await createLetterhead(user, parsed.data, { bytes, mimeType });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
