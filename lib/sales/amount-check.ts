// Satış tutarı tutarlılık kontrolü — UYARI üretir, kaydı ENGELLEMEZ.
// Örnek vaka: MAD Parfüm 258 adet / $753 (cihaz başı ~$2,9) → tutar ya da adet hatalı girilmiş.
// Kontroller:
//   1) Kalem: unit_price × quantity ≈ total_price (kiralamada total, birim kira × adet × ay olabilir → atlanır).
//   2) Başlık: satış tutarı ≈ kalem toplamı (anlaşma fiyatı girilmişse sapma beklenir, yine uyarılır).
//   3) Cihaz başı ortalama: satış (kiralama dışı) cihaz kaleminde ortalama birim < MIN_DEVICE_UNIT_USD.

export const AMOUNT_TOLERANCE_PCT = 0.05;
export const AMOUNT_TOLERANCE_ABS = 5;
export const MIN_DEVICE_UNIT_USD = 20;

export type AmountCheckItem = {
  product_code?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  sale_type?: 'sale' | 'rental' | string | null;
  is_device?: boolean;
};

const off = (a: number, b: number) => Math.abs(a - b) > Math.max(AMOUNT_TOLERANCE_ABS, Math.abs(b) * AMOUNT_TOLERANCE_PCT);
const usd = (n: number) => `$${Math.round(n).toLocaleString('tr-TR')}`;

export function checkSaleAmounts(input: { amount: number; deviceCount?: number; items: AmountCheckItem[] }): string[] {
  const warnings: string[] = [];
  const amount = Number(input.amount ?? 0);
  const items = input.items ?? [];

  for (const item of items) {
    if (item.sale_type === 'rental') continue;
    const expected = Number(item.unit_price ?? 0) * Number(item.quantity ?? 0);
    if (off(Number(item.total_price ?? 0), expected)) {
      warnings.push(`${item.product_code || 'Kalem'}: birim ${usd(item.unit_price)} × ${item.quantity} = ${usd(expected)}, kalem toplamı ${usd(item.total_price)}.`);
    }
  }

  if (items.length) {
    const itemsTotal = items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
    if (off(amount, itemsTotal)) warnings.push(`Satış tutarı ${usd(amount)}, kalemlerin toplamı ${usd(itemsTotal)}; arada belirgin fark var.`);
  }

  const saleDevices = items.filter((item) => item.sale_type !== 'rental' && item.is_device !== false);
  const devQty = saleDevices.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  if (devQty > 0) {
    const itemDevTotal = saleDevices.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
    // Kiralama kalemi yoksa başlık tutarı (anlaşma fiyatı) da hesaba girer: küçük olan esas alınır.
    const hasRental = items.some((item) => item.sale_type === 'rental');
    const devTotal = hasRental ? itemDevTotal : Math.min(itemDevTotal, amount);
    if (devTotal / devQty < MIN_DEVICE_UNIT_USD) {
      warnings.push(`Cihaz başı ortalama ${usd(devTotal / devQty)} (${devQty} adet, ${usd(devTotal)}); adet veya tutar hatalı olabilir.`);
    }
  } else if (!items.length && Number(input.deviceCount ?? 0) > 0 && amount > 0 && amount / Number(input.deviceCount) < MIN_DEVICE_UNIT_USD) {
    warnings.push(`Cihaz başı ortalama ${usd(amount / Number(input.deviceCount))} (${input.deviceCount} adet, ${usd(amount)}); adet veya tutar hatalı olabilir.`);
  }
  return warnings;
}
