-- Ürün kullanım tipi (kırılım): bir katalog ürünü satışa mı, kiralamaya mı, ikisine de mi açık.
--   both   → Satış + Kiralama (varsayılan; mevcut ürünlerin davranışı değişmez)
--   sale   → Sadece Satış
--   rental → Sadece Kiralama (aylık kira tarifesi zorunlu)
-- Satış ekle, Teklif ve Forecast ekranları ürün listesini bu alana göre süzer; sunucu da aynı kuralı uygular.
alter table public.quote_products
  add column if not exists usage_type text not null default 'both';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quote_products_usage_type_check'
  ) then
    alter table public.quote_products
      add constraint quote_products_usage_type_check check (usage_type in ('both', 'sale', 'rental'));
  end if;
end $$;

comment on column public.quote_products.usage_type is
  'Kullanım tipi: both = Satış + Kiralama, sale = Sadece Satış, rental = Sadece Kiralama';
