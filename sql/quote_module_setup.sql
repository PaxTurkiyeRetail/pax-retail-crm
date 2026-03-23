create extension if not exists pgcrypto;

create table if not exists public.quote_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  product_type text not null check (product_type in ('device','bundle','recurring','peripheral')),
  unit_label text not null default 'adet',
  currency text not null default 'USD',
  is_recurring boolean not null default false,
  billing_period text not null default 'one_time' check (billing_period in ('one_time','monthly')),
  description text null,
  specs jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.quote_products(id) on delete cascade,
  min_qty integer not null,
  max_qty integer null,
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint quote_pricing_rules_qty_chk check (min_qty > 0 and (max_qty is null or max_qty >= min_qty))
);
create index if not exists idx_quote_pricing_rules_product on public.quote_pricing_rules(product_id, min_qty);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.musteriler(id) on delete cascade,
  opportunity_title text null,
  proposal_date date not null,
  valid_until date not null,
  follow_up_date date not null,
  owner_name text not null,
  owner_email text null,
  probability integer not null check (probability in (10,30,60,90)),
  status text not null default 'draft' check (status in ('draft','sent','closed')),
  closed_reason text null check (closed_reason in ('won','lost','expired','no_interest')),
  total_device_count integer not null default 0,
  total_amount numeric(14,2) not null default 0,
  hardware_amount numeric(14,2) not null default 0,
  monthly_amount numeric(14,2) not null default 0,
  note text null,
  quote_year integer not null,
  quote_serial integer not null,
  quote_no text not null unique,
  activity_event_id uuid null,
  pdf_url text null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_year, quote_serial)
);
create index if not exists idx_quotes_customer on public.quotes(customer_id, created_at desc);
create index if not exists idx_quotes_status_followup on public.quotes(status, follow_up_date);
create index if not exists idx_quotes_owner on public.quotes(owner_name, created_at desc);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.quote_products(id),
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  product_type text not null,
  category text not null,
  is_recurring boolean not null default false,
  billing_period text not null default 'one_time',
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  total_price numeric(14,2) not null,
  rule_min_qty integer null,
  rule_max_qty integer null,
  created_at timestamptz not null default now(),
  unique (quote_id, line_no)
);
create index if not exists idx_quote_items_quote on public.quote_items(quote_id, line_no);

insert into public.quote_products (code, name, category, product_type, unit_label, currency, is_recurring, billing_period, description, specs, sort_order, is_active)
values
('A80','PAX A80','EFT POS','device','adet','USD',false,'one_time','Android Desktop EFT POS','["Android 10","LAN","1GB + 8GB","4 inch TFT ekran"]',10,true),
('A6650','PAX A6650','EFT POS','device','adet','USD',false,'one_time','IP67 Android EFT POS','["Android 12","4GB + 64GB","6.5 inch ekran","IP67"]',20,true),
('A920PRO','PAX A920Pro','EFT POS','device','adet','USD',false,'one_time','Mobil Android EFT POS','["Android 8.1","4G + Wi-Fi","5.5 inch ekran"]',30,true),
('A77','PAX A77','EFT POS','device','adet','USD',false,'one_time','Android EFT POS','["Android 10","5 inch ekran"]',40,true),
('A910S','PAX A910S','EFT POS','device','adet','USD',false,'one_time','Android EFT POS','["Android 10","5 inch ekran"]',50,true),
('S210','PAX S210','EFT POS','peripheral','adet','USD',false,'one_time','Pinpad','["RunthOS","Temassiz","USB-C"]',60,true),
('ELYS-L1400','ELYS Station L1400','ELYS','device','adet','USD',false,'one_time','ELYS Station','["Android 11","14 inch IPS","4GB + 64GB"]',110,true),
('ELYS-A3700','ELYS Tablet A3700','ELYS','device','adet','USD',false,'one_time','ELYS Tablet','["Android 11","7 inch ekran","2GB + 16GB"]',120,true),
('ELYS-SET-5','ELYS 5li Set','ELYS','bundle','adet','USD',false,'one_time','Station + Tablet + Eye + Printer + Hub','["L1400 + A3700 + T3300 + T3180 + T3400"]',130,true),
('ELYS-SET-2','ELYS 2li Set','ELYS','bundle','adet','USD',false,'one_time','Station + Tablet','["L1400 + A3700"]',140,true),
('ELYS-EYE-T3320','ELYS Eye T3320 - No Display','ELYS','peripheral','adet','USD',false,'one_time','No Display Eye','["Bluetooth + USB","0.3MP"]',150,true),
('ELYS-EYE-TOUCH-T3300','ELYS Eye Touch T3300','ELYS','peripheral','adet','USD',false,'one_time','Dokunmatik Eye','["1.54 inch ekran","2MP"]',160,true),
('ELYS-HUB-T3400','ELYS Hub T3400','ELYS','peripheral','adet','USD',false,'one_time','Hub','["2x USB-C","4x USB-A"]',170,true),
('ELYS-PRINTER-T3180','ELYS Printer T3180','ELYS','peripheral','adet','USD',false,'one_time','Printer','["203 dpi","260 mm/s"]',180,true),
('ELYS-TOWER-L1450','ELYS Tower L1450','ELYS','device','adet','USD',false,'one_time','ELYS Tower','["Android 13","14 inch ekran"]',190,true),
('ELYS-LITCHI-L1600','ELYS Litchi L1600','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1600','["Android 12","15.6 inch IPS"]',200,true),
('ELYS-LITCHI-L1601','ELYS Litchi L1601','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1601','["Cift ekran"]',210,true),
('ELYS-LITCHI-L1602','ELYS Litchi L1602','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1602','["Cift 15.6 inch ekran"]',220,true),
('SK700','SK700 Kiosk','ELYS','device','adet','USD',false,'one_time','Self-service kiosk','["21.5 inch ekran","IM30"]',230,true),
('KASAPOS-TMS','Kasapos + TMS','Service','recurring','adet','USD',true,'monthly','Aylik entegrasyon ve TMS','["Terminal basina aylik"]',300,true),
('PAX-PLATFORM','PAX Platform','Service','recurring','adet','USD',true,'monthly','Aylik platform lisansi','["Terminal basina aylik"]',310,true)
on conflict (code) do update set name = excluded.name, category = excluded.category, product_type = excluded.product_type, description = excluded.description, specs = excluded.specs, sort_order = excluded.sort_order, is_active = excluded.is_active;

insert into public.quote_pricing_rules (product_id, min_qty, max_qty, unit_price)
select p.id, v.min_qty, v.max_qty, v.unit_price
from (values
('A80',1,25,234),('A80',26,200,211),('A80',201,500,199),('A80',501,null,187),
('A6650',1,25,704),('A6650',26,200,634),('A6650',201,500,598),('A6650',501,null,563),
('A920PRO',1,25,312),('A920PRO',26,200,281),('A920PRO',201,500,266),('A920PRO',501,null,250),
('A77',1,25,264),('A77',26,200,238),('A77',201,500,224),('A77',501,null,211),
('A910S',1,25,209),('A910S',26,200,188),('A910S',201,500,178),('A910S',501,null,167),
('S210',1,null,77),
('ELYS-L1400',1,50,615),('ELYS-L1400',51,100,605),('ELYS-L1400',101,null,595),
('ELYS-A3700',1,50,550),('ELYS-A3700',51,100,540),('ELYS-A3700',101,null,530),
('ELYS-SET-5',1,50,1450),('ELYS-SET-5',51,100,1430),('ELYS-SET-5',101,null,1410),
('ELYS-SET-2',1,50,1150),('ELYS-SET-2',51,100,1130),('ELYS-SET-2',101,null,1110),
('ELYS-EYE-T3320',1,null,55),('ELYS-EYE-TOUCH-T3300',1,null,150),('ELYS-HUB-T3400',1,null,80),('ELYS-PRINTER-T3180',1,null,185),
('ELYS-TOWER-L1450',1,50,900),('ELYS-TOWER-L1450',51,100,890),('ELYS-TOWER-L1450',101,null,880),
('ELYS-LITCHI-L1600',1,50,590),('ELYS-LITCHI-L1600',51,100,580),('ELYS-LITCHI-L1600',101,null,570),
('ELYS-LITCHI-L1601',1,50,695),('ELYS-LITCHI-L1601',51,100,685),('ELYS-LITCHI-L1601',101,null,675),
('ELYS-LITCHI-L1602',1,50,815),('ELYS-LITCHI-L1602',51,100,805),('ELYS-LITCHI-L1602',101,null,795),
('SK700',1,10,2550),('SK700',11,100,2440),('SK700',101,null,2210),
('KASAPOS-TMS',1,200,12),('KASAPOS-TMS',201,500,11),('KASAPOS-TMS',501,null,10),
('PAX-PLATFORM',1,null,4)
) as v(code, min_qty, max_qty, unit_price)
join public.quote_products p on p.code = v.code
where not exists (
  select 1 from public.quote_pricing_rules r
  where r.product_id = p.id and r.min_qty = v.min_qty and coalesce(r.max_qty, -1) = coalesce(v.max_qty, -1)
);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists quote_products_touch_updated_at on public.quote_products;
create trigger quote_products_touch_updated_at before update on public.quote_products for each row execute procedure public.touch_updated_at();

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at before update on public.quotes for each row execute procedure public.touch_updated_at();
