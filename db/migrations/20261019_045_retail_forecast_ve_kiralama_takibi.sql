-- 20261019_045_retail_forecast_ve_kiralama_takibi.sql
-- RETAIL PANELİ VERİ BOŞLUKLARI (19.10.2026)
--
-- 1) crm_forecasts: satış / kiralama ayrımı, fiyat ve "Retail planına dahil" kuralı.
--      sale_type              'sale' | 'rental' (varsayılan 'sale' → mevcut kayıtlar değişmez)
--      unit_price             USD birim satış fiyatı (boş = katalog kademesi)
--      rental_monthly_price   USD aylık birim kira (kiralama satırında; boşsa API katalog tarifesini yazar)
--      include_in_retail_plan Retail Operasyon Paneli fırsat listesine girer mi (varsayılan true)
-- 2) crm_sales: kiralama operasyon takibi (SIM bekliyor, sözleşme bekliyor ...). Durum sözleşme
--    (satış kaydı) düzeyindedir; aynı gün + aynı firma tek satış = tek sözleşme kuralı (030).
--      rental_ops_status  hazirlik · sim_bekliyor · sozlesme_bekliyor · kurulum · aktif · iptal
--      rental_ops_note, rental_ops_updated_at, rental_ops_updated_by
--    Mevcut satırlarda durum boş kalır (veri uydurulmaz); ekranda "Hazırlık" varsayılır.
--
-- Dosya idempotenttir. Veri silmez/güncellemez. CHECK'ler yoksa eklenir.

alter table public.crm_forecasts add column if not exists sale_type text not null default 'sale';
alter table public.crm_forecasts add column if not exists unit_price numeric(14,2);
alter table public.crm_forecasts add column if not exists rental_monthly_price numeric(14,2);
alter table public.crm_forecasts add column if not exists include_in_retail_plan boolean not null default true;

alter table public.crm_sales add column if not exists rental_ops_status text;
alter table public.crm_sales add column if not exists rental_ops_note text;
alter table public.crm_sales add column if not exists rental_ops_updated_at timestamptz;
alter table public.crm_sales add column if not exists rental_ops_updated_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_sale_type_check') then
    alter table public.crm_forecasts add constraint crm_forecasts_sale_type_check
      check (sale_type in ('sale', 'rental'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_prices_check') then
    alter table public.crm_forecasts add constraint crm_forecasts_prices_check
      check ((unit_price is null or unit_price >= 0)
         and (rental_monthly_price is null or rental_monthly_price > 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_sales_rental_ops_status_check') then
    alter table public.crm_sales add constraint crm_sales_rental_ops_status_check
      check (rental_ops_status is null or rental_ops_status in
        ('hazirlik', 'sim_bekliyor', 'sozlesme_bekliyor', 'kurulum', 'aktif', 'iptal'));
  end if;
end $$;

create index if not exists crm_forecasts_retail_plan_idx
  on public.crm_forecasts (forecast_year) where is_active = true and include_in_retail_plan = true;
create index if not exists crm_sales_rental_ops_idx
  on public.crm_sales (rental_ops_status) where sale_type <> 'sale';

comment on column public.crm_forecasts.sale_type is 'sale = satış · rental = kiralama (Retail paneli ayrımı)';
comment on column public.crm_forecasts.unit_price is 'USD birim satış fiyatı; boş = katalog kademesi';
comment on column public.crm_forecasts.rental_monthly_price is 'USD aylık birim kira (kiralama satırı)';
comment on column public.crm_forecasts.include_in_retail_plan is 'Retail Operasyon Paneli fırsat listesine dahil mi';
comment on column public.crm_sales.rental_ops_status is 'Kiralama operasyon durumu: hazirlik · sim_bekliyor · sozlesme_bekliyor · kurulum · aktif · iptal (boş = hazirlik)';
comment on column public.crm_sales.rental_ops_note is 'Kiralama operasyon notu (ör. SIM kart eksik, imza bekleniyor)';
