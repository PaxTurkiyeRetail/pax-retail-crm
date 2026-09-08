-- 20260907_018_teklif_fiyat_listesi_20260828.sql
-- "PAX Türkiye EFT POS Ödeme Çözümleri Fiyat Teklifi" (28.08.2026, teklif tarihinden
-- itibaren 15 gün geçerli) PDF'inin teklif kataloğuna gömülmesi — Sinan, 07.09.2026.
--
-- KARARLAR (Sinan, 07.09):
--   * Mükerrer / import artığı ürünler PASİFE çekilir (silinmez) → teklif ekranındaki
--     ürün listesi temizlenir, geçmiş bozulmaz, geri alma tek UPDATE.
--   * Bu PDF'te olmayan ürünlere (ELYS ailesi, SK700, A35, A3700 …) DOKUNULMAZ;
--     onların kendi fiyat listesi var.
--   * PDF'teki teknik özellikler ürünlere işlenir (teklif PDF'inde ürün başına
--     8 satıra kadar basılıyor) + yürürlükteki liste tarihi system_parameters'a damgalanır.
--
-- FİYATLAR (USD, PDF ile birebir): kademeler 1–25 / 26–200 / 201–500 / 501+
--   A80      234 / 211 / 199 / 187        A6650  704 / 634 / 598 / 563
--   A6630    435 / 405 / 385 / 365        A920Pro 312 / 281 / 266 / 250
--   A77      264 / 238 / 224 / 211        A910S  209 / 188 / 178 / 167
--   S210     77 (kademesiz)
--   Kasapos + TMS (aylık, aktif terminal başına): 1–200 → 12 · 201–500 → 11 · 501+ → 10
--   PAX Platform (aylık, terminal başına): 4
--
-- NOT (kademe kirliliği): eski katalogda hem "500–∞" hem "501–∞" satırı vardı. Fiyat
-- çözümü min_qty'ye göre ilk eşleşmeyi aldığı için 500 adet "201–500" kademesine
-- düşüyordu; yine de 201–500 bir gün elle silinirse 500 adet sessizce en düşük fiyata
-- kayardı. Bu dosya ilgili ürünlerin kurallarını silip PDF kademelerini tek doğru
-- kaynak olarak yeniden yazar.
--
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir.

-- ---------------------------------------------------------------------------
-- 1) PDF'teki 9 kalem: ürün kaydı + teknik özellikler (specs) + sıralama
-- ---------------------------------------------------------------------------
insert into public.quote_products
  (code, name, category, product_type, unit_label, currency, is_recurring, billing_period, description, specs, sort_order, is_active)
values
  ('A80', 'PAX A80', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android Desktop EFT POS — sabit kasalar için masaüstü çözümü',
   jsonb_build_array('Android 10','Cortex A53','LAN · Opsiyonel: 4G / Wi-Fi / BT','1GB + 8GB','50 satır/sn · Kağıt rulosu dış çapı 50mm','4" TFT WVGA dokunmatik ekran','0,3 MP ön yüz kamera','PCI 6.x SRED'), 10, true),

  ('A6650', 'PAX A6650', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android EFT POS — dünyanın ilk IP67 sertifikalı EFT POS cihazı',
   jsonb_build_array('Android 12','Qualcomm Quad core A53 2.0GHz','4G Dual Band + WiFi 5 (2.4/5GHz) + Bluetooth 5.0','4GB + 64GB','6,5 inç IPS dokunmatik ekran','Li-ion Polimer 3.8V 5400mAh','Zebra SE4100 barkod okuyucu','IP67 sertifikalı — darbe, toz ve suya dayanıklı'), 20, true),

  ('A6630', 'PAX A6630', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android EFT POS — ödeme alma süreçlerinize değer katın',
   jsonb_build_array('Android 12','Quad Core işlemci','4GB + 64GB','6000mAh | 3.8V, 23.1Wh','2MP ön · 5MP arka kamera','6,5 inç IPS dokunmatik ekran','Çift çipli & çift manyetik şerit okuyucu — temassız','PCI PTS 6.x SRED'), 30, true),

  ('A920PRO', 'PAX A920Pro', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android EFT POS — ihtiyacınız olan tüm özellikler tek cihazda',
   jsonb_build_array('Android 8.1','ARM Cortex A53 dört çekirdekli 1.4GHz','4G + Wi-Fi 2.4GHz + Bluetooth','1GB + 8GB','5,5 inç IPS HD dokunmatik ekran','5150mAh | 3.7V batarya','Top-Side barkod okuyucu','PCI PTS 5.x SRED'), 40, true),

  ('A77', 'PAX A77', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android EFT POS — şık tasarım ve güvenli ödeme tek cihazda',
   jsonb_build_array('Android 10','Cortex A53 dört çekirdekli 1.4GHz','4G + Wi-Fi 2.4GHz + Bluetooth','2GB + 16GB','5,5 inç IPS dokunmatik ekran','5150mAh · 3.8V, 19.57Wh','Yüksek kalite barkod okuyucu','2MP ön · 5MP arka kamera'), 50, true),

  ('A910S', 'PAX A910S', 'EFT POS', 'device', 'adet', 'USD', false, 'one_time',
   'Android EFT POS — etkili performans, verimli işlemler',
   jsonb_build_array('Android 10','Cortex A53 dört çekirdekli 1.4GHz','4G/3G/2G + WiFi 2.4GHz + Bluetooth','1GB + 8GB','5 inç IPS HD dokunmatik ekran','3350mAh | 7.2V batarya','80 satır/sn · Kağıt rulosu dış çapı 40mm','PCI PTS 6.x SRED'), 60, true),

  ('S210', 'PAX S210', 'EFT POS', 'peripheral', 'adet', 'USD', false, 'one_time',
   'Pinpad — işlemler S210 ile daha pratik',
   jsonb_build_array('RunthOS','32 bit güvenli işlemci, 192MHz','CPU dahili: 1MB SRAM + 4MB Flash · harici: 8MB Flash','Ön kamera 0,3 MP','2,4" 320x240 renkli ekran','USB Type-C | Seri','ICCR + temassız'), 70, true),

  ('KASAPOS-TMS', 'Tümleşik Entegrasyon (Kasapos + TMS)', 'Service', 'recurring', 'terminal', 'USD', true, 'monthly',
   'Aylık tümleşik entegrasyon hizmeti — aktif terminal başına',
   jsonb_build_array('Ücretlendirme aylık aktif terminal sayısı üzerinden','Önceki ay en az 1 işlem yapan terminal aktif kabul edilir','Toplam aktif terminal adedi hangi bareme giriyorsa o barem birim fiyatı uygulanır','FİRMA''nın yazılı talebiyle satın alınan toplam POS adedi üzerinden de ücretlendirilebilir (aktiflik kontrolü yapılmaz)'), 300, true),

  ('PAX-PLATFORM', 'PAX Platform', 'Service', 'recurring', 'terminal', 'USD', true, 'monthly',
   'Aylık PAX Platform lisansı — terminal başına',
   jsonb_build_array('Bulut tabanlı SaaS model · lokal sunucu seçeneği','Banka yönlendirme: kart BIN, kart tipi, işlem tipi, marka bazlı','İşyeri ve terminal bazlı yönetim','İşlem hacmi ve başarı oranı analizi · detaylı işlem raporları'), 310, true)
on conflict (code) do update
  set name = excluded.name,
      category = excluded.category,
      product_type = excluded.product_type,
      unit_label = excluded.unit_label,
      currency = excluded.currency,
      is_recurring = excluded.is_recurring,
      billing_period = excluded.billing_period,
      description = excluded.description,
      specs = excluded.specs,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Fiyat kademeleri: bu 9 ürünün kuralları silinip PDF kademeleri yazılır
-- ---------------------------------------------------------------------------
delete from public.quote_pricing_rules
where product_id in (
  select id from public.quote_products
  where code in ('A80','A6650','A6630','A920PRO','A77','A910S','S210','KASAPOS-TMS','PAX-PLATFORM')
);

insert into public.quote_pricing_rules (product_id, min_qty, max_qty, unit_price)
select p.id, v.min_qty, v.max_qty, v.unit_price
from (values
  -- kod, min, max (null = üstü açık), birim fiyat
  ('A80',            1,  25,   234.00),
  ('A80',           26, 200,   211.00),
  ('A80',          201, 500,   199.00),
  ('A80',          501, null,  187.00),

  ('A6650',          1,  25,   704.00),
  ('A6650',         26, 200,   634.00),
  ('A6650',        201, 500,   598.00),
  ('A6650',        501, null,  563.00),

  ('A6630',          1,  25,   435.00),
  ('A6630',         26, 200,   405.00),
  ('A6630',        201, 500,   385.00),
  ('A6630',        501, null,  365.00),

  ('A920PRO',        1,  25,   312.00),
  ('A920PRO',       26, 200,   281.00),
  ('A920PRO',      201, 500,   266.00),
  ('A920PRO',      501, null,  250.00),

  ('A77',            1,  25,   264.00),
  ('A77',           26, 200,   238.00),
  ('A77',          201, 500,   224.00),
  ('A77',          501, null,  211.00),

  ('A910S',          1,  25,   209.00),
  ('A910S',         26, 200,   188.00),
  ('A910S',        201, 500,   178.00),
  ('A910S',        501, null,  167.00),

  ('S210',           1, null,   77.00),

  ('KASAPOS-TMS',    1, 200,    12.00),
  ('KASAPOS-TMS',  201, 500,    11.00),
  ('KASAPOS-TMS',  501, null,   10.00),

  ('PAX-PLATFORM',   1, null,    4.00)
) as v(code, min_qty, max_qty, unit_price)
join public.quote_products p on p.code = v.code;

-- ---------------------------------------------------------------------------
-- 3) Mükerrer / import artığı ürünler pasife (silinmez)
--    * 'A920 PRO' → A920PRO'nun kopyası (aynı fiyatlar)
--    * ELYS ürünlerinin "EFT POS" kategorisine düşmüş kopyaları → ELYS-* kayıtları
--      aynı fiyatlarla duruyor, bunlar fazlalık
--    * 'L1400, A3700, …' → tek koda sıkıştırılmış eski import satırları (biri 0,00 fiyatlı)
-- ---------------------------------------------------------------------------
update public.quote_products
set is_active = false, updated_at = now()
where is_active = true
  and code in (
    'A920 PRO',
    'A3700', 'L1400', 'L1450', 'L1600', 'L1601', 'L1602',
    'T3180', 'T3300', 'T3320', 'T3400',
    'L1400, A3700',
    'L1400, A3700, T3300, T3180, HUB 3400'
  );

-- ---------------------------------------------------------------------------
-- 4) Yürürlükteki fiyat listesi damgası (Liste Yönetimleri → Teklif)
-- ---------------------------------------------------------------------------
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('quote_price_list_version', 'eft_pos', 'EFT POS Fiyat Listesi', '28.08.2026', 10,
   '{"source":"manual","module":"Teklif","category":"Ticari Politika","aciklama":"Teklif kataloğundaki EFT POS fiyatlarının alındığı liste tarihi. Liste yenilenince bu değer ve katalog birlikte güncellenir."}'::jsonb)
on conflict (group_key, param_key) do update
  set label = excluded.label, value = excluded.value, sort_order = excluded.sort_order,
      meta = excluded.meta, is_active = true, updated_at = now();
