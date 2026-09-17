-- 20260917_039_sektor_banka_finans_ve_a80_s210_kiralama.sql
-- (1) Sektör kataloğuna "Banka / Finans"  (2) Kiralanabilir yeni kalem: A80 + S210, 15 USD/ay
--
-- KAYNAK (Sinan, 17.09.2026): "sektör kısmına Banka/Finans ekler misin" ve
--   "kiralama ürünlerine A80+S210 olarak bir kalem girer misin, fiyatı aylık 15$".
--
-- Dosya İDEMPOTENTTİR (altın kural 28): iki kez çalıştırılabilir, elle yapılmış değişiklikleri ezmez.

-- ---------------------------------------------------------------------------
-- 1) SEKTÖR: Banka / Finans
-- ---------------------------------------------------------------------------
-- Sektör listesi `system_parameters` (group_key='crm_sector'); müşteri oluşturma, düzenleme ve
-- filtrelemede kullanılır. Ekranda gösterilen ve firmada SAKLANAN alan `value`dur (label değil) —
-- bu yüzden yeni seçenek yeni bir satırdır, mevcut satırın etiketini değiştirmek yetmez.
-- Yazım "Ev & Yaşam / Yapı Market" ile aynı biçimde (boşluklu eğik çizgi).
insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active)
values ('crm_sector', 'banka_finans', 'Banka / Finans', 'Banka / Finans', 75, true)
on conflict (group_key, param_key) do update
  set label = excluded.label,
      value = excluded.value,
      is_active = true,
      updated_at = now();

-- Eski "BANKA" seçeneği (kod içindeki varsayılan listeden gelmiş olabilir): iki benzer seçenek yan
-- yana durmasın diye pasife çekilir — AMA yalnız hiçbir firma o değeri kullanmıyorsa.
-- Kullanan firma varsa DOKUNULMAZ: firma verisini sessizce yeniden yazmak bu betiğin işi değil
-- (altın kural 34). O durumda iki seçenek de listede kalır; taşıma kararı Sinan'ın.
update public.system_parameters p
set is_active = false, updated_at = now()
where p.group_key = 'crm_sector'
  and upper(trim(p.value)) in ('BANKA', 'BANK')
  and p.is_active
  and not exists (
    select 1 from public.musteriler m
    where upper(trim(coalesce(m.sektor, ''))) = upper(trim(p.value))
  );

-- ---------------------------------------------------------------------------
-- 2) KİRALAMA KALEMİ: A80 + S210 — 15 USD/ay
-- ---------------------------------------------------------------------------
-- Kiralama ayrı bir katalog değildir: bir ürün, `rental_monthly_price` doluysa kiralanabilir
-- (migration 022). NULL olsaydı teklif ekranı "Bu ürünün kiralama tarifesi yok" uyarısı verirdi.
-- Fiyat USD ve KDV HARİÇ — katalogdaki diğer fiyatlarla aynı esas (A80 15, A910S 15, A6650 20).
--
-- `product_type = 'bundle'`: tek kalemde iki cihaz (A80 + S210 pinpad) — ELYS setleriyle aynı tip.
-- Cihaz sayacı açısından NOT: Canlı Ekran'ın cihaz adedi `crm_sale_item_is_device()` ile belirlenir;
-- bundle da cihaz sayılır, yani 10 adet A80+S210 satılırsa 10 cihaz görünür (20 değil) — çünkü
-- satılan kalem adedi budur. Ayrı ayrı sayılması isteniyorsa ayrı iki satır girilmeli.
--
-- SATIŞ FİYATI YOK: bu kalem kiralama için açıldı, `quote_pricing_rules` içine kademe girilmedi.
-- Satış olarak seçilirse liste fiyatı gelmez, birim fiyat elle yazılır (A35'teki durumla aynı,
-- backlog 32). Satış tarifesi gelirse Ürün & Fiyat Yönetimi ekranından eklenir.
insert into public.quote_products
  (code, name, category, product_type, unit_label, currency, is_recurring, billing_period,
   description, sort_order, is_active, rental_monthly_price)
values
  ('A80+S210', 'PAX A80 + S210', 'EFT POS', 'bundle', 'adet', 'USD', false, 'one_time',
   'A80 ödeme terminali + S210 pinpad seti. Kiralama tarifesi: 15 USD/ay (KDV hariç).',
   15, true, 15)
on conflict (code) do update
  set name = excluded.name,
      category = excluded.category,
      product_type = excluded.product_type,
      unit_label = excluded.unit_label,
      currency = excluded.currency,
      is_recurring = excluded.is_recurring,
      billing_period = excluded.billing_period,
      description = excluded.description,
      is_active = true,
      -- Elle değiştirilmiş kira fiyatı KORUNUR; yalnız boşsa doldurulur (022'deki kuralın aynısı).
      rental_monthly_price = coalesce(public.quote_products.rental_monthly_price, excluded.rental_monthly_price),
      updated_at = now();
