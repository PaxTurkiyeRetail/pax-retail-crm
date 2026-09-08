-- 20260908_022_kiralama_tarifesi.sql
-- KİRALAMA TARİFESİ KATALOGDA (Sinan, 08.09.2026):
--   "PAX A80: 15$+KDV · PAX A910S: 15$+KDV · PAX A6650: 20$+KDV — kiralama için fiyatları
--    girebilir miyiz?"  ve  "satıştaki kiralamada tarihe gerek yok".
--
-- MODEL DEĞİŞİKLİĞİ (020'ye göre):
--   * Kira artık ürünün katalog özelliği: quote_products.rental_monthly_price (USD/ay, KDV hariç —
--     katalogdaki satış fiyatlarıyla aynı esas). NULL = bu ürün kiralanamaz / tarife yok.
--   * Teklif satırında kiralama seçilince aylık birim kira katalogdan gelir; satırda elle
--     ezilebilir (anlaşma). rental_monthly_price satıra kopyalanır (teklif donmuş belgedir).
--   * TARİH YOK: rental_start_date / rental_end_date artık isteğe bağlı (kolonlar eski
--     kayıtlar için kalır). Tarih yoksa satır tutarı = aylık kira × adet ("/ ay") ve aylık
--     recurring toplamına girer — aylık hizmet kalemleriyle (KasaPOS/TMS) aynı muamele.
--     Tarih varsa (eski kayıt) sözleşme değeri = aylık × ay.
--
-- Dosya idempotenttir; canlıda elle değiştirilmiş kira fiyatı varsa KORUNUR
-- (yalnız NULL olanlar doldurulur).

alter table public.quote_products
  add column if not exists rental_monthly_price numeric(12,2)
  check (rental_monthly_price is null or rental_monthly_price > 0);

comment on column public.quote_products.rental_monthly_price is
  'Kiralama tarifesi: cihaz başı aylık kira (USD, KDV hariç). NULL = kiralanamaz. 08.09.2026 listesi: A80 15, A910S 15, A6650 20.';

update public.quote_products set rental_monthly_price = 15 where code = 'A80'   and rental_monthly_price is null;
update public.quote_products set rental_monthly_price = 15 where code = 'A910S' and rental_monthly_price is null;
update public.quote_products set rental_monthly_price = 20 where code = 'A6650' and rental_monthly_price is null;

-- Kiralama satırında tarih zorunluluğu kalktı; aylık kira hâlâ zorunlu ve pozitif.
alter table public.quote_items drop constraint if exists quote_items_rental_check;
alter table public.quote_items add constraint quote_items_rental_check
  check (
    sale_type = 'sale'
    or (
      rental_monthly_price is not null and rental_monthly_price > 0
      and (rental_start_date is null or rental_end_date is null or rental_end_date > rental_start_date)
    )
  );

comment on column public.quote_items.sale_type is
  'sale = katalog kademesiyle satış · rental = kiralama (aylık kira × adet; tarih isteğe bağlı, yoksa aylık)';
comment on column public.quote_items.rental_monthly_price is
  'Kiralama satırında aylık birim kira (USD, KDV hariç); katalog tarifesinden gelir, satırda ezilebilir';
