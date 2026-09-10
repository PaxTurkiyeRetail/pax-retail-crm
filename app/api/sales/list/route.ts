export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { listSales, salesSummary } from '@/lib/quotes/sales-service';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';

// Satışlar ekranının verisi. Kendi teklifini görme yetkisi olanlar yalnız kendi
// satışlarını görür (quote.read.any yoksa owner filtresi kendi adına sabitlenir).
export async function GET(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const url = new URL(request.url);
    const canSeeAll = userHasPermission(me, 'quote.read.any');
    const ownName = String(me.full_name ?? me.email ?? '').trim();
    const requestedOwner = String(url.searchParams.get('owner') ?? '').trim();
    const owner = canSeeAll ? requestedOwner : ownName;

    const rows = await listSales({
      owner,
      status: String(url.searchParams.get('status') ?? '').trim(),
      q: String(url.searchParams.get('q') ?? '').trim(),
    });
    const summary = await salesSummary(new Date().getFullYear());
    // Satış kanalı listesi Forecast ile aynı parametre grubundan (027) — ikinci liste üretilmez.
    const parameterOptions = await getParameterOptionsByGroups(['forecast_sales_channel']);
    const channels = (parameterOptions.forecast_sales_channel ?? []).map((item) => ({ value: String(item.value), label: String(item.label) }));
    const owners = canSeeAll
      ? Array.from(new Set(rows.map((row) => row.owner_name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'))
      : [ownName];

    return NextResponse.json(
      {
        rows, summary, owners, canSeeAll, channels,
        canEdit: userHasPermission(me, 'quote.update.own') || userHasPermission(me, 'quote.update.any'),
        // Teklifsiz satış kaydı açma (027): account_manager kendi müşterisine, admin kısıtsız.
        canCreate: userHasPermission(me, 'sale.create'),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
