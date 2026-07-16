import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { QUOTE_PROBABILITIES } from '@/lib/quotes/catalog';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireCrmAccessOrThrow();
    const admin = createPgAdminClient();
    const [{ products, rules, source }, customerRes] = await Promise.all([
      getQuoteCatalog(admin),
      admin.from('musteriler').select('id,musteri,sektor,sorumlu,entegrasyon_tipi').order('musteri', { ascending: true }).limit(2000),
    ]);

    if (customerRes.error) return NextResponse.json({ message: customerRes.error.message }, { status: 500 });

    return NextResponse.json({
      products,
      rules,
      probabilities: QUOTE_PROBABILITIES,
      customers: (customerRes.data ?? []).filter((row: any) => !isReportOnlyCustomer(row)),
      catalogSource: source,
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
