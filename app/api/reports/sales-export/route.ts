export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { apiErrorResponse, ApiError } from '@/lib/http/api-error';
import { listDeviceSaleLines, listServiceInvoiceLines } from '@/lib/reports/sales-export';
import { parsePeriodKey, type ExportKind } from '@/lib/reports/sales-export-shared';

// SATIŞ RAPORLARI (Excel) — Satışlar ekranındaki "Rapor indir" (Sinan, 21.09).
//   ?kind=cihaz|hizmet · ?period=YYYY | YYYY-MM · ?owner=<ad> (boş = tüm satışçılar)
// Görünürlük Satışlar listesiyle AYNI kapı: quote.read; quote.read.any yoksa satışçı kendi adına
// sabitlenir (başkasının raporu indirilemez). Excel paketi tarayıcıda kurulur; bu uç yalnız kalem
// satırlarını döndürür — sayfa kurgusu tek yerde (`sales-export-shared.ts`) durur.
export async function GET(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const url = new URL(request.url);
    const kindParam = String(url.searchParams.get('kind') ?? 'cihaz').trim();
    if (kindParam !== 'cihaz' && kindParam !== 'hizmet') throw new ApiError('BAD_KIND', 'kind cihaz ya da hizmet olmalı.', 400);
    const kind = kindParam as ExportKind;
    const period = parsePeriodKey(url.searchParams.get('period'));
    if (!period) throw new ApiError('BAD_PERIOD', 'Dönem YYYY (yıl) ya da YYYY-MM (ay) biçiminde olmalı.', 400);

    const canSeeAll = userHasPermission(me, 'quote.read.any');
    const ownName = String(me.full_name ?? me.email ?? '').trim();
    const requestedOwner = String(url.searchParams.get('owner') ?? '').trim();
    const owner = canSeeAll ? requestedOwner : ownName;

    const range = { from: period.from, to: period.to, owner };
    const lines = kind === 'cihaz' ? await listDeviceSaleLines(range) : await listServiceInvoiceLines(range);

    return NextResponse.json(
      { kind, period, owner, canSeeAll, lines },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Rapor verisi alınamadı.');
  }
}
