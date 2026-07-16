import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { buildForecastYears, FORECAST_MONTHS, getForecastParameterOptions } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireCrmAccessOrThrow();
    const admin = createPgAdminClient();
    const [{ products, source }, params] = await Promise.all([
      getQuoteCatalog(admin),
      getForecastParameterOptions(),
    ]);

    return NextResponse.json({
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        product_type: product.product_type,
      })),
      catalogSource: source,
      salesChannels: params.channels,
      probabilities: params.probabilities,
      months: FORECAST_MONTHS,
      years: buildForecastYears(),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 401 });
  }
}
