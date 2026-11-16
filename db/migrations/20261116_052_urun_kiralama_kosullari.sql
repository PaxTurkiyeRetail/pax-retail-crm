-- 052: Ürün kataloğunda kiralama koşulları satış fiyatından ayrı tutulur.
-- rental_monthly_price (022) aylık kira; burada taahhüt süresi ve tek seferlik kurulum bedeli eklenir.
alter table public.quote_products add column if not exists rental_min_months integer;
alter table public.quote_products add column if not exists rental_setup_fee numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quote_products_rental_min_months_check') then
    alter table public.quote_products
      add constraint quote_products_rental_min_months_check check (rental_min_months is null or rental_min_months between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_products_rental_setup_fee_check') then
    alter table public.quote_products
      add constraint quote_products_rental_setup_fee_check check (rental_setup_fee is null or rental_setup_fee >= 0);
  end if;
end $$;

comment on column public.quote_products.rental_min_months is 'Kiralamada minimum taahhüt süresi (ay); null = taahhüt yok.';
comment on column public.quote_products.rental_setup_fee is 'Kiralamada tek seferlik kurulum/aktivasyon bedeli (USD, KDV hariç); null = yok.';
