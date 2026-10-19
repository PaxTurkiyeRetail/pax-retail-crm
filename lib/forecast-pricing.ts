// Forecast satış/kiralama + fiyat + Retail planı alanları (migration 045). Saf fonksiyon: test edilir.
// Kural:
//   * sale_type yoksa 'sale' (mevcut istemciler bozulmaz).
//   * unit_price opsiyonel (boş = katalog kademesi), >= 0.
//   * Kiralamada rental_monthly_price zorunlu; boşsa ürünün katalog tarifesi yazılır, o da yoksa hata.
//   * Satış satırında rental_monthly_price tutulmaz (null).
//   * include_in_retail_plan yoksa true.

export type ForecastSaleType = 'sale' | 'rental';

export type ForecastPricingInput = {
  sale_type?: unknown;
  unit_price?: unknown;
  rental_monthly_price?: unknown;
  include_in_retail_plan?: unknown;
};

export type ForecastPricing = {
  saleType: ForecastSaleType;
  unitPrice: number | null;
  rentalMonthlyPrice: number | null;
  includeInRetailPlan: boolean;
};

const optionalNumber = (value: unknown): number | null | 'invalid' => {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 'invalid';
};

const parseBool = (value: unknown, fallback: boolean) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['false', '0', 'hayir', 'hayır', 'no', 'off'].includes(s)) return false;
  if (['true', '1', 'evet', 'yes', 'on'].includes(s)) return true;
  return fallback;
};

export function parseForecastPricing(
  input: ForecastPricingInput,
  product?: { rental_monthly_price?: number | string | null } | null,
): { ok: true; value: ForecastPricing } | { ok: false; message: string } {
  const rawType = String(input.sale_type ?? '').trim().toLowerCase();
  if (rawType && rawType !== 'sale' && rawType !== 'rental') return { ok: false, message: 'Satış tipi gecersiz (sale | rental).' };
  const saleType: ForecastSaleType = rawType === 'rental' ? 'rental' : 'sale';

  const unitPrice = optionalNumber(input.unit_price);
  if (unitPrice === 'invalid' || (unitPrice != null && unitPrice < 0)) return { ok: false, message: 'Birim fiyat gecersiz.' };

  let rentalMonthlyPrice: number | null = null;
  if (saleType === 'rental') {
    const given = optionalNumber(input.rental_monthly_price);
    if (given === 'invalid' || (given != null && given <= 0)) return { ok: false, message: 'Aylik kira pozitif sayi olmali.' };
    const catalog = optionalNumber(product?.rental_monthly_price);
    rentalMonthlyPrice = given ?? (catalog !== 'invalid' && catalog != null && catalog > 0 ? catalog : null);
    if (rentalMonthlyPrice == null) return { ok: false, message: 'Kiralama satirinda aylik kira zorunlu (urunun katalog kira tarifesi yok).' };
  }

  return {
    ok: true,
    value: { saleType, unitPrice, rentalMonthlyPrice, includeInRetailPlan: parseBool(input.include_in_retail_plan, true) },
  };
}
