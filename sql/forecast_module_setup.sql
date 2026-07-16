-- PAX CRM Forecast - tek dosya idempotent kurulum / senkronizasyon
-- Bu dosya tekrar tekrar calistirilabilir.
-- Eksik tablo/kolon/index/view/parametreleri ekler, bilinen eski forecast kolonlarini temizler.

create extension if not exists pgcrypto;

create table if not exists public.crm_forecasts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.musteriler(id) on delete cascade,
  product_id text null,
  product_code_snapshot text null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  forecast_year integer not null check (forecast_year between 2024 and 2100),
  forecast_month integer not null check (forecast_month between 1 and 12),
  sales_channel text not null,
  probability integer not null check (probability in (30, 60, 90)),
  owner_name text not null,
  owner_email text null,
  note text null,
  is_active boolean not null default true,
  created_by_email text null,
  created_by_name text null,
  updated_by_email text null,
  updated_by_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mevcut kurulumlarda eksik kolon varsa tamamla.
alter table public.crm_forecasts add column if not exists product_id text null;
alter table public.crm_forecasts add column if not exists product_code_snapshot text null;
alter table public.crm_forecasts add column if not exists product_name_snapshot text;
alter table public.crm_forecasts add column if not exists quantity integer;
alter table public.crm_forecasts add column if not exists forecast_year integer;
alter table public.crm_forecasts add column if not exists forecast_month integer;
alter table public.crm_forecasts add column if not exists sales_channel text;
alter table public.crm_forecasts add column if not exists probability integer;
alter table public.crm_forecasts add column if not exists owner_name text;
alter table public.crm_forecasts add column if not exists owner_email text null;
alter table public.crm_forecasts add column if not exists note text null;
alter table public.crm_forecasts add column if not exists is_active boolean not null default true;
alter table public.crm_forecasts add column if not exists created_by_email text null;
alter table public.crm_forecasts add column if not exists created_by_name text null;
alter table public.crm_forecasts add column if not exists updated_by_email text null;
alter table public.crm_forecasts add column if not exists updated_by_name text null;
alter table public.crm_forecasts add column if not exists created_at timestamptz not null default now();
alter table public.crm_forecasts add column if not exists updated_at timestamptz not null default now();

-- Bilinen eski/yanlis taslak kolonlar: forecast donemi artik tarih kolonunda degil yil+ay olarak tutulur.
alter table public.crm_forecasts drop column if exists forecast_date;
alter table public.crm_forecasts drop column if exists period_date;
alter table public.crm_forecasts drop column if exists forecast_period;
alter table public.crm_forecasts drop column if exists forecast_period_date;
alter table public.crm_forecasts drop column if exists forecast_label;
alter table public.crm_forecasts drop column if exists row_status;

-- Zorunlu alanlar ve varsayilanlar.
update public.crm_forecasts set is_active = true where is_active is null;
update public.crm_forecasts set created_at = now() where created_at is null;
update public.crm_forecasts set updated_at = now() where updated_at is null;
update public.crm_forecasts set product_name_snapshot = coalesce(product_name_snapshot, product_code_snapshot, 'Urun') where product_name_snapshot is null;
update public.crm_forecasts set quantity = 1 where quantity is null or quantity <= 0;
update public.crm_forecasts set forecast_year = extract(year from now())::integer where forecast_year is null;
update public.crm_forecasts set forecast_month = extract(month from now())::integer where forecast_month is null;
update public.crm_forecasts set sales_channel = 'Direkt Satis' where sales_channel is null or trim(sales_channel) = '';
update public.crm_forecasts set probability = 30 where probability is null or probability not in (30, 60, 90);
update public.crm_forecasts set owner_name = coalesce(nullif(trim(owner_name), ''), 'Havuz Account') where owner_name is null or trim(owner_name) = '';

alter table public.crm_forecasts alter column product_name_snapshot set not null;
alter table public.crm_forecasts alter column quantity set not null;
alter table public.crm_forecasts alter column forecast_year set not null;
alter table public.crm_forecasts alter column forecast_month set not null;
alter table public.crm_forecasts alter column sales_channel set not null;
alter table public.crm_forecasts alter column probability set not null;
alter table public.crm_forecasts alter column owner_name set not null;
alter table public.crm_forecasts alter column is_active set not null;
alter table public.crm_forecasts alter column created_at set not null;
alter table public.crm_forecasts alter column updated_at set not null;

-- Idempotent check constraint'ler.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_quantity_positive') then
    alter table public.crm_forecasts add constraint crm_forecasts_quantity_positive check (quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_year_range') then
    alter table public.crm_forecasts add constraint crm_forecasts_year_range check (forecast_year between 2024 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_month_range') then
    alter table public.crm_forecasts add constraint crm_forecasts_month_range check (forecast_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_probability_allowed') then
    alter table public.crm_forecasts add constraint crm_forecasts_probability_allowed check (probability in (30, 60, 90));
  end if;
end $$;

create index if not exists idx_crm_forecasts_customer_period
  on public.crm_forecasts (customer_id, forecast_year, forecast_month)
  where is_active = true;

create index if not exists idx_crm_forecasts_owner_period
  on public.crm_forecasts (owner_name, forecast_year, forecast_month)
  where is_active = true;

create index if not exists idx_crm_forecasts_channel_probability
  on public.crm_forecasts (sales_channel, probability)
  where is_active = true;

create index if not exists idx_crm_forecasts_product
  on public.crm_forecasts (product_code_snapshot, product_name_snapshot)
  where is_active = true;

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists crm_forecasts_touch_updated_at on public.crm_forecasts;
create trigger crm_forecasts_touch_updated_at
before update on public.crm_forecasts
for each row execute function public.touch_updated_at();

create or replace view public.v_crm_forecast_report as
select
  f.id,
  f.customer_id,
  m.musteri,
  m.sektor,
  m.sorumlu,
  m.entegrasyon_tipi,
  f.product_id,
  f.product_code_snapshot,
  f.product_name_snapshot,
  f.quantity,
  f.forecast_year,
  f.forecast_month,
  case f.forecast_month
    when 1 then 'Ocak'
    when 2 then 'Şubat'
    when 3 then 'Mart'
    when 4 then 'Nisan'
    when 5 then 'Mayıs'
    when 6 then 'Haziran'
    when 7 then 'Temmuz'
    when 8 then 'Ağustos'
    when 9 then 'Eylül'
    when 10 then 'Ekim'
    when 11 then 'Kasım'
    when 12 then 'Aralık'
    else '-'
  end || ' ' || f.forecast_year::text as forecast_period_label,
  f.sales_channel,
  f.probability,
  round((f.quantity::numeric * f.probability::numeric / 100), 2) as weighted_quantity,
  f.owner_name,
  f.owner_email,
  f.note,
  f.is_active,
  f.created_by_email,
  f.created_by_name,
  f.updated_by_email,
  f.updated_by_name,
  f.created_at,
  f.updated_at
from public.crm_forecasts f
join public.musteriler m on m.id = f.customer_id;

-- Forecast parametreleri: varsa guncelle, yoksa ekle. Degerler mevcut kayitlarla uyum icin ASCII tutulur; label UI'da Turkce gorunur.
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('forecast_sales_channel', 'banka', 'Banka', 'Banka', 10, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_sales_channel', 'direkt_satis', 'Direkt Satış', 'Direkt Satis', 20, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_sales_channel', 'kanal', 'Kanal', 'Kanal', 30, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '30', '%30', '30', 10, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '60', '%60', '60', 20, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '90', '%90', '90', 30, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb)
on conflict (group_key, param_key) do update set
  label = excluded.label,
  value = excluded.value,
  sort_order = excluded.sort_order,
  meta = coalesce(public.system_parameters.meta, '{}'::jsonb) || excluded.meta;
