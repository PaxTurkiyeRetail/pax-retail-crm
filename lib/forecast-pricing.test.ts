import { describe, expect, it } from 'vitest';
import { parseForecastPricing } from './forecast-pricing';

describe('parseForecastPricing', () => {
  it('alan gönderilmezse geriye uyumlu varsayılan', () => {
    expect(parseForecastPricing({})).toEqual({ ok: true, value: { saleType: 'sale', unitPrice: null, rentalMonthlyPrice: null, includeInRetailPlan: true } });
  });

  it('satışta kira fiyatı tutulmaz', () => {
    const r = parseForecastPricing({ sale_type: 'sale', unit_price: '250', rental_monthly_price: 15, include_in_retail_plan: false });
    expect(r).toEqual({ ok: true, value: { saleType: 'sale', unitPrice: 250, rentalMonthlyPrice: null, includeInRetailPlan: false } });
  });

  it('kiralamada katalog tarifesi yedek', () => {
    const r = parseForecastPricing({ sale_type: 'rental' }, { rental_monthly_price: '15' });
    expect(r.ok && r.value.rentalMonthlyPrice).toBe(15);
  });

  it('kiralamada kira yoksa hata', () => {
    expect(parseForecastPricing({ sale_type: 'rental' }, { rental_monthly_price: null }).ok).toBe(false);
  });

  it('geçersiz tip/fiyat hata', () => {
    expect(parseForecastPricing({ sale_type: 'lease' }).ok).toBe(false);
    expect(parseForecastPricing({ unit_price: -1 }).ok).toBe(false);
    expect(parseForecastPricing({ sale_type: 'rental', rental_monthly_price: 0 }).ok).toBe(false);
  });
});
