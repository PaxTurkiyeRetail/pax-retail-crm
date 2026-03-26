export type QuoteProductType = 'device' | 'bundle' | 'recurring' | 'peripheral';

export type QuoteProduct = {
  id: string;
  code: string;
  name: string;
  category: 'EFT POS' | 'ELYS' | 'Service';
  product_type: QuoteProductType;
  unit_label: string;
  currency: 'USD';
  is_recurring: boolean;
  billing_period: 'one_time' | 'monthly';
  description: string;
  specs: string[];
  sort_order: number;
};

export type QuotePricingRule = {
  id: string;
  product_id: string;
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

export function normalizeQuoteSpecs(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [];

    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        return normalizeQuoteSpecs(JSON.parse(raw));
      } catch {
        // düz metin gibi devam et
      }
    }

    return raw
      .split(/\r?\n|,|\u2022|•|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (input && typeof input === 'object') {
    return Object.values(input as Record<string, unknown>)
      .flatMap((value) => normalizeQuoteSpecs(value))
      .filter(Boolean);
  }

  return [];
}

export function normalizeQuoteProduct<T extends Record<string, any>>(product: T): T & { specs: string[] } {
  return {
    ...product,
    specs: normalizeQuoteSpecs(product?.specs),
  };
}

function product(input: Omit<QuoteProduct, 'currency' | 'unit_label'> & Partial<Pick<QuoteProduct, 'currency' | 'unit_label'>>) {
  return {
    currency: 'USD' as const,
    unit_label: 'adet',
    ...input,
  } satisfies QuoteProduct;
}

export const STATIC_QUOTE_PRODUCTS: QuoteProduct[] = [
  product({
    id: 'prod-a80', code: 'A80', name: 'PAX A80', category: 'EFT POS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 10,
    description: 'Android Desktop EFT POS',
    specs: ['Android 10', 'LAN', '1GB + 8GB', '4” TFT WVGA dokunmatik ekran'],
  }),
  product({
    id: 'prod-a6650', code: 'A6650', name: 'PAX A6650', category: 'EFT POS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 20,
    description: 'IP67 Android EFT POS',
    specs: ['Android 12', '4GB + 64GB', '6.5” IPS ekran', 'IP67 koruma', 'Zebra barkod okuyucu'],
  }),
  product({
    id: 'prod-a920pro', code: 'A920PRO', name: 'PAX A920Pro', category: 'EFT POS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 30,
    description: 'Mobil Android EFT POS',
    specs: ['Android 8.1', '4G + Wi‑Fi + Bluetooth', '1GB + 8GB', '5.5” IPS HD ekran'],
  }),
  product({
    id: 'prod-a77', code: 'A77', name: 'PAX A77', category: 'EFT POS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 40,
    description: 'Şık tasarımlı Android EFT POS',
    specs: ['Android 10', '4G/3G/2G + Wi‑Fi', '1GB + 8GB', '5” IPS HD ekran'],
  }),
  product({
    id: 'prod-a910s', code: 'A910S', name: 'PAX A910S', category: 'EFT POS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 50,
    description: 'Android EFT POS',
    specs: ['Android 10', '4G/3G/2G + Wi‑Fi', '1GB + 8GB', '5” IPS HD ekran'],
  }),
  product({
    id: 'prod-s210', code: 'S210', name: 'PAX S210', category: 'EFT POS', product_type: 'peripheral',
    is_recurring: false, billing_period: 'one_time', sort_order: 60,
    description: 'Pinpad',
    specs: ['RunthOS', '2.4” renkli ekran', 'USB Type-C', 'ICCR + temassız'],
  }),
  product({
    id: 'prod-elys-l1400', code: 'ELYS-L1400', name: 'ELYS Station L1400', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 110,
    description: 'ELYS Station',
    specs: ['Android 11', '14” IPS LCD', '4GB + 64GB', '5MP ön kamera'],
  }),
  product({
    id: 'prod-elys-a3700', code: 'ELYS-A3700', name: 'ELYS Tablet A3700', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 120,
    description: 'ELYS Tablet',
    specs: ['Android 11', '7” IPS dokunmatik ekran', '2GB + 16GB', '4G / Wi‑Fi / BT'],
  }),
  product({
    id: 'prod-elys-5li', code: 'ELYS-SET-5', name: 'ELYS 5’li Set', category: 'ELYS', product_type: 'bundle',
    is_recurring: false, billing_period: 'one_time', sort_order: 130,
    description: 'Station + Tablet + Eye + Printer + Hub',
    specs: ['L1400 + A3700 + T3300 + T3180 + T3400'],
  }),
  product({
    id: 'prod-elys-2li', code: 'ELYS-SET-2', name: 'ELYS 2’li Set', category: 'ELYS', product_type: 'bundle',
    is_recurring: false, billing_period: 'one_time', sort_order: 140,
    description: 'Station + Tablet',
    specs: ['L1400 + A3700'],
  }),
  product({
    id: 'prod-elys-eye-nodisplay', code: 'ELYS-EYE-T3320', name: 'ELYS Eye T3320 - No Display', category: 'ELYS', product_type: 'peripheral',
    is_recurring: false, billing_period: 'one_time', sort_order: 150,
    description: 'No Display Eye',
    specs: ['Bluetooth + USB', '0.3MP kamera', 'Li-ion Polymer 900mAh'],
  }),
  product({
    id: 'prod-elys-eye-touch', code: 'ELYS-EYE-TOUCH-T3300', name: 'ELYS Eye Touch T3300', category: 'ELYS', product_type: 'peripheral',
    is_recurring: false, billing_period: 'one_time', sort_order: 160,
    description: 'Dokunmatik Eye',
    specs: ['1.54” TFT LCD', '2MP kamera', 'Wi‑Fi 2.4/5GHz + BT 5.0'],
  }),
  product({
    id: 'prod-elys-hub', code: 'ELYS-HUB-T3400', name: 'ELYS Hub T3400', category: 'ELYS', product_type: 'peripheral',
    is_recurring: false, billing_period: 'one_time', sort_order: 170,
    description: 'Bağlantı Hub',
    specs: ['2x USB-C', '4x USB-A', '2x LAN', 'RJ45 / RJ11'],
  }),
  product({
    id: 'prod-elys-printer', code: 'ELYS-PRINTER-T3180', name: 'ELYS Printer T3180', category: 'ELYS', product_type: 'peripheral',
    is_recurring: false, billing_period: 'one_time', sort_order: 180,
    description: 'ELYS Printer',
    specs: ['203 dpi', '260 mm/s', 'Wi‑Fi 2.4GHz', 'Bluetooth 5.2'],
  }),
  product({
    id: 'prod-elys-tower', code: 'ELYS-TOWER-L1450', name: 'ELYS Tower L1450', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 190,
    description: 'ELYS Tower',
    specs: ['Android 13', '14” ana ekran', 'müşteri ekranı + NFC', '4GB + 64GB'],
  }),
  product({
    id: 'prod-elys-litchi-l1600', code: 'ELYS-LITCHI-L1600', name: 'ELYS Litchi L1600', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 200,
    description: 'ELYS Litchi L1600',
    specs: ['Android 12', '15.6” IPS', '4GB + 64GB', 'Wi‑Fi / BT'],
  }),
  product({
    id: 'prod-elys-litchi-l1601', code: 'ELYS-LITCHI-L1601', name: 'ELYS Litchi L1601', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 210,
    description: 'ELYS Litchi L1601',
    specs: ['Android 12', '15.6” ana ekran', '10.1” ikincil ekran', '4GB + 64GB'],
  }),
  product({
    id: 'prod-elys-litchi-l1602', code: 'ELYS-LITCHI-L1602', name: 'ELYS Litchi L1602', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 220,
    description: 'ELYS Litchi L1602',
    specs: ['Android 12', '15.6” çift ekran', '4GB + 64GB', 'Wi‑Fi / BT'],
  }),
  product({
    id: 'prod-sk700', code: 'SK700', name: 'SK700 Kiosk', category: 'ELYS', product_type: 'device',
    is_recurring: false, billing_period: 'one_time', sort_order: 230,
    description: 'Self-service kiosk',
    specs: ['Android 10', '21.5” dokunmatik ekran', 'IM30 ödeme modülü', '5MP kamera'],
  }),
  product({
    id: 'prod-kasapos-tms', code: 'KASAPOS-TMS', name: 'Kasapos + TMS', category: 'Service', product_type: 'recurring',
    is_recurring: true, billing_period: 'monthly', sort_order: 300,
    description: 'Kasa POS entegrasyonu ve TMS hizmeti',
    specs: ['Terminal başına aylık birim fiyat'],
  }),
  product({
    id: 'prod-pax-platform', code: 'PAX-PLATFORM', name: 'PAX Platform', category: 'Service', product_type: 'recurring',
    is_recurring: true, billing_period: 'monthly', sort_order: 310,
    description: 'PAX yönlendirme ve raporlama platformu',
    specs: ['Terminal başına aylık birim fiyat'],
  }),
];

export const STATIC_QUOTE_PRICING_RULES: QuotePricingRule[] = [
  { id: 'rule-a80-1', product_id: 'prod-a80', min_qty: 1, max_qty: 25, unit_price: 234 },
  { id: 'rule-a80-2', product_id: 'prod-a80', min_qty: 26, max_qty: 200, unit_price: 211 },
  { id: 'rule-a80-3', product_id: 'prod-a80', min_qty: 201, max_qty: 500, unit_price: 199 },
  { id: 'rule-a80-4', product_id: 'prod-a80', min_qty: 501, max_qty: null, unit_price: 187 },

  { id: 'rule-a6650-1', product_id: 'prod-a6650', min_qty: 1, max_qty: 25, unit_price: 704 },
  { id: 'rule-a6650-2', product_id: 'prod-a6650', min_qty: 26, max_qty: 200, unit_price: 634 },
  { id: 'rule-a6650-3', product_id: 'prod-a6650', min_qty: 201, max_qty: 500, unit_price: 598 },
  { id: 'rule-a6650-4', product_id: 'prod-a6650', min_qty: 501, max_qty: null, unit_price: 563 },

  { id: 'rule-a920-1', product_id: 'prod-a920pro', min_qty: 1, max_qty: 25, unit_price: 312 },
  { id: 'rule-a920-2', product_id: 'prod-a920pro', min_qty: 26, max_qty: 200, unit_price: 281 },
  { id: 'rule-a920-3', product_id: 'prod-a920pro', min_qty: 201, max_qty: 500, unit_price: 266 },
  { id: 'rule-a920-4', product_id: 'prod-a920pro', min_qty: 501, max_qty: null, unit_price: 250 },

  { id: 'rule-a77-1', product_id: 'prod-a77', min_qty: 1, max_qty: 25, unit_price: 264 },
  { id: 'rule-a77-2', product_id: 'prod-a77', min_qty: 26, max_qty: 200, unit_price: 238 },
  { id: 'rule-a77-3', product_id: 'prod-a77', min_qty: 201, max_qty: 500, unit_price: 224 },
  { id: 'rule-a77-4', product_id: 'prod-a77', min_qty: 501, max_qty: null, unit_price: 211 },

  { id: 'rule-a910-1', product_id: 'prod-a910s', min_qty: 1, max_qty: 25, unit_price: 209 },
  { id: 'rule-a910-2', product_id: 'prod-a910s', min_qty: 26, max_qty: 200, unit_price: 188 },
  { id: 'rule-a910-3', product_id: 'prod-a910s', min_qty: 201, max_qty: 500, unit_price: 178 },
  { id: 'rule-a910-4', product_id: 'prod-a910s', min_qty: 501, max_qty: null, unit_price: 167 },

  { id: 'rule-s210-1', product_id: 'prod-s210', min_qty: 1, max_qty: null, unit_price: 77 },

  { id: 'rule-l1400-1', product_id: 'prod-elys-l1400', min_qty: 1, max_qty: 50, unit_price: 615 },
  { id: 'rule-l1400-2', product_id: 'prod-elys-l1400', min_qty: 51, max_qty: 100, unit_price: 605 },
  { id: 'rule-l1400-3', product_id: 'prod-elys-l1400', min_qty: 101, max_qty: null, unit_price: 595 },

  { id: 'rule-a3700-1', product_id: 'prod-elys-a3700', min_qty: 1, max_qty: 50, unit_price: 550 },
  { id: 'rule-a3700-2', product_id: 'prod-elys-a3700', min_qty: 51, max_qty: 100, unit_price: 540 },
  { id: 'rule-a3700-3', product_id: 'prod-elys-a3700', min_qty: 101, max_qty: null, unit_price: 530 },

  { id: 'rule-5li-1', product_id: 'prod-elys-5li', min_qty: 1, max_qty: 50, unit_price: 1450 },
  { id: 'rule-5li-2', product_id: 'prod-elys-5li', min_qty: 51, max_qty: 100, unit_price: 1430 },
  { id: 'rule-5li-3', product_id: 'prod-elys-5li', min_qty: 101, max_qty: null, unit_price: 1410 },

  { id: 'rule-2li-1', product_id: 'prod-elys-2li', min_qty: 1, max_qty: 50, unit_price: 1150 },
  { id: 'rule-2li-2', product_id: 'prod-elys-2li', min_qty: 51, max_qty: 100, unit_price: 1130 },
  { id: 'rule-2li-3', product_id: 'prod-elys-2li', min_qty: 101, max_qty: null, unit_price: 1110 },

  { id: 'rule-eye-no-1', product_id: 'prod-elys-eye-nodisplay', min_qty: 1, max_qty: null, unit_price: 55 },
  { id: 'rule-eye-touch-1', product_id: 'prod-elys-eye-touch', min_qty: 1, max_qty: null, unit_price: 150 },
  { id: 'rule-hub-1', product_id: 'prod-elys-hub', min_qty: 1, max_qty: null, unit_price: 80 },
  { id: 'rule-printer-1', product_id: 'prod-elys-printer', min_qty: 1, max_qty: null, unit_price: 185 },

  { id: 'rule-tower-1', product_id: 'prod-elys-tower', min_qty: 1, max_qty: 50, unit_price: 900 },
  { id: 'rule-tower-2', product_id: 'prod-elys-tower', min_qty: 51, max_qty: 100, unit_price: 890 },
  { id: 'rule-tower-3', product_id: 'prod-elys-tower', min_qty: 101, max_qty: null, unit_price: 880 },

  { id: 'rule-l1600-1', product_id: 'prod-elys-litchi-l1600', min_qty: 1, max_qty: 50, unit_price: 590 },
  { id: 'rule-l1600-2', product_id: 'prod-elys-litchi-l1600', min_qty: 51, max_qty: 100, unit_price: 580 },
  { id: 'rule-l1600-3', product_id: 'prod-elys-litchi-l1600', min_qty: 101, max_qty: null, unit_price: 570 },

  { id: 'rule-l1601-1', product_id: 'prod-elys-litchi-l1601', min_qty: 1, max_qty: 50, unit_price: 695 },
  { id: 'rule-l1601-2', product_id: 'prod-elys-litchi-l1601', min_qty: 51, max_qty: 100, unit_price: 685 },
  { id: 'rule-l1601-3', product_id: 'prod-elys-litchi-l1601', min_qty: 101, max_qty: null, unit_price: 675 },

  { id: 'rule-l1602-1', product_id: 'prod-elys-litchi-l1602', min_qty: 1, max_qty: 50, unit_price: 815 },
  { id: 'rule-l1602-2', product_id: 'prod-elys-litchi-l1602', min_qty: 51, max_qty: 100, unit_price: 805 },
  { id: 'rule-l1602-3', product_id: 'prod-elys-litchi-l1602', min_qty: 101, max_qty: null, unit_price: 795 },

  { id: 'rule-sk700-1', product_id: 'prod-sk700', min_qty: 1, max_qty: 10, unit_price: 2550 },
  { id: 'rule-sk700-2', product_id: 'prod-sk700', min_qty: 11, max_qty: 100, unit_price: 2440 },
  { id: 'rule-sk700-3', product_id: 'prod-sk700', min_qty: 101, max_qty: null, unit_price: 2210 },

  { id: 'rule-kasapos-1', product_id: 'prod-kasapos-tms', min_qty: 1, max_qty: 200, unit_price: 12 },
  { id: 'rule-kasapos-2', product_id: 'prod-kasapos-tms', min_qty: 201, max_qty: 500, unit_price: 11 },
  { id: 'rule-kasapos-3', product_id: 'prod-kasapos-tms', min_qty: 501, max_qty: null, unit_price: 10 },

  { id: 'rule-platform-1', product_id: 'prod-pax-platform', min_qty: 1, max_qty: null, unit_price: 4 },
];

export const QUOTE_PROBABILITIES = [10, 30, 60, 90] as const;
export const QUOTE_STATUSES = ['draft', 'sent', 'closed'] as const;
export const QUOTE_CLOSED_REASONS = ['won', 'lost', 'expired', 'no_interest'] as const;
