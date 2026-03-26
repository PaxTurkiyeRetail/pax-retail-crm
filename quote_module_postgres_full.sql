create extension if not exists pgcrypto;

-- Teklif modulu ana tablolar
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
create index if not exists idx_quotes_quote_no on public.quotes(quote_no);

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
create index if not exists idx_quote_items_product on public.quote_items(product_id);

-- Trigger
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
