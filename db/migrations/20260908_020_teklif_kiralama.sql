-- 20260908_020_teklif_kiralama.sql
-- Teklif satırında KİRALAMA (Sinan, 08.09.2026: "teklif kısmında kiralama eklenmeli,
-- bu da tarihli olmalı; kiralama seçildiğinde tarih gelmeli; satış ekranında
-- düzenlemede de gelsin").
--
-- MODEL
--   * Satır bazında satış tipi: 'sale' (katalog kademesi) | 'rental' (kiralama).
--   * Kiralama satırı TARİHLİDİR: rental_start_date / rental_end_date zorunlu.
--   * Katalogda kira tarifesi yok → aylık birim kira (rental_monthly_price) satırda
--     elle girilir. Satır tutarı = aylık birim kira × adet × ay (tarih farkından, en az 1).
--     Aylık kira "monthly_amount"a, sözleşme değeri "total_amount"a yazılır;
--     hardware_amount sadece tek seferlik satış satırlarıdır.
--   * Satış kaydı (crm_sales) kiralama bilgisini taşır ve düzenlenebilir:
--     sale_type ('sale' | 'rental' | 'mixed'), dönem tarihleri, aylık kira toplamı.
--     Dönem değişince tutar = donanım + aylık kira × yeni ay sayısı olarak yeniden hesaplanır
--     (anlaşma fiyatı girilmişse o korunur).
--
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Teklif satırları
-- ---------------------------------------------------------------------------
alter table public.quote_items add column if not exists sale_type text not null default 'sale';
alter table public.quote_items add column if not exists rental_start_date date;
alter table public.quote_items add column if not exists rental_end_date date;
alter table public.quote_items add column if not exists rental_monthly_price numeric(12,2);

alter table public.quote_items drop constraint if exists quote_items_sale_type_check;
alter table public.quote_items add constraint quote_items_sale_type_check
  check (sale_type in ('sale', 'rental'));

alter table public.quote_items drop constraint if exists quote_items_rental_check;
alter table public.quote_items add constraint quote_items_rental_check
  check (
    sale_type = 'sale'
    or (rental_start_date is not null and rental_end_date is not null
        and rental_end_date > rental_start_date
        and rental_monthly_price is not null and rental_monthly_price > 0)
  );

-- Kademe kolonları kiralama satırında boş kalır (zaten nullable).

-- ---------------------------------------------------------------------------
-- 2) Satış kaydı
-- ---------------------------------------------------------------------------
alter table public.crm_sales add column if not exists sale_type text not null default 'sale';
alter table public.crm_sales add column if not exists rental_start_date date;
alter table public.crm_sales add column if not exists rental_end_date date;
alter table public.crm_sales add column if not exists rental_monthly_amount numeric(14,2) not null default 0;
alter table public.crm_sales add column if not exists hardware_amount numeric(14,2) not null default 0;

alter table public.crm_sales drop constraint if exists crm_sales_sale_type_check;
alter table public.crm_sales add constraint crm_sales_sale_type_check
  check (sale_type in ('sale', 'rental', 'mixed'));

alter table public.crm_sales drop constraint if exists crm_sales_rental_period_check;
alter table public.crm_sales add constraint crm_sales_rental_period_check
  check (rental_start_date is null or rental_end_date is null or rental_end_date > rental_start_date);

-- Mevcut satışlar: hepsi düz satış → kiralama dışı kısım = satış tutarının tamamı.
update public.crm_sales
set hardware_amount = amount
where hardware_amount = 0 and sale_type = 'sale';

comment on column public.quote_items.sale_type is 'sale = katalog kademesiyle satış · rental = tarihli kiralama (aylık birim kira elle)';
comment on column public.quote_items.rental_monthly_price is 'Kiralama satırında aylık birim kira (USD); total_price = kira × adet × ay';
comment on column public.crm_sales.sale_type is 'sale · rental · mixed (satış + kiralama satırı birlikte)';
comment on column public.crm_sales.rental_monthly_amount is 'Kiralama satırlarının aylık toplamı (birim kira × adet)';
comment on column public.crm_sales.hardware_amount is 'Kiralama dışı kısım (donanım + hizmet kalemleri); dönem değişince tutar = bu + aylık kira × ay';
