import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { getParameterOptionsByGroups } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const admin = createPgAdminClient();
    let customerQuery = admin.from('musteriler').select('id,musteri,sektor,sorumlu,entegrasyon_tipi').order('musteri', { ascending: true }).limit(2000);
    if (!userHasPermission(me, 'customer.read.any')) customerQuery = customerQuery.eq('owner_user_id', me.id);
    const [{ products, rules, source }, customerRes, parameterOptions] = await Promise.all([
      getQuoteCatalog(admin),
      customerQuery,
      getParameterOptionsByGroups(['quote_probability']),
    ]);

    if (customerRes.error) return NextResponse.json({ message: customerRes.error.message }, { status: 500 });

    return NextResponse.json({
      products,
      rules,
      probabilities: (parameterOptions.quote_probability ?? []).map((item) => Number(item.value)).filter(Number.isFinite),
      customers: (customerRes.data ?? []).filter((row: any) => !isReportOnlyCustomer(row)),
      catalogSource: source,
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
