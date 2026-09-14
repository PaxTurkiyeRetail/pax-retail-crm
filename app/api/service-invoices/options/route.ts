export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requirePermissionOrThrow } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/http/api-error';
import { createPgAdminClient } from '@/lib/pg/admin';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { serviceInvoiceOptions } from '@/lib/sales/service-invoices';
import { SERVICE_CURRENCIES, SERVICE_CURRENCY_LABEL } from '@/lib/sales/service-invoices-shared';

// "+ Hizmet Faturası" penceresinin seçenekleri. Müşteri listesi SAHİPLİKLE DARALTILMAZ (032 kararı):
// hizmet faturalarını entegrasyon ekibi tüm firmalar için giriyor. Hizmet kalemleri Liste
// Yönetimleri › Hizmet Kalemleri'nden; satışçı listesi OWNER_ORDER.
export async function GET() {
  try {
    await requirePermissionOrThrow('sale.create');
    const admin = createPgAdminClient();
    const [customerRes, options] = await Promise.all([
      admin.from('musteriler').select('id,musteri,sorumlu').order('musteri', { ascending: true }).limit(3000),
      serviceInvoiceOptions(),
    ]);
    if (customerRes.error) return NextResponse.json({ message: customerRes.error.message }, { status: 500 });
    return NextResponse.json(
      {
        ...options,
        currencies: SERVICE_CURRENCIES.map((code) => ({ value: code, label: SERVICE_CURRENCY_LABEL[code].code, symbol: SERVICE_CURRENCY_LABEL[code].symbol })),
        customers: (customerRes.data ?? [])
          .filter((row: any) => !isReportOnlyCustomer(row))
          .map((row: any) => ({ id: String(row.id), musteri: String(row.musteri), sorumlu: row.sorumlu ? String(row.sorumlu) : null })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return apiErrorResponse(error, 'Seçenekler yüklenemedi.');
  }
}
