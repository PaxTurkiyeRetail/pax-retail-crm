-- PAX CRM Müşteri Bazlı Engel ve Etki Takibi
-- İdempotent kurulum / geçiş dosyasıdır.
-- Satışçılar kendi müşteri portföyünü, admin ve super_admin tüm portföyü görür.
-- Forecast bağlantısı yalnız bütçe kayması seçildiğinde zorunludur.

create extension if not exists pgcrypto;

create table if not exists public.crm_forecast_blockers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.musteriler(id) on delete cascade,
  forecast_id uuid null references public.crm_forecasts(id) on delete set null,
  has_blocker boolean not null,
  blocker_category text null,
  blocker_description text null,
  resolution_owner_type text null,
  resolution_owner_name text null,
  resolution_due_date date null,
  impact_type text not null default 'none',
  shift_year integer null,
  shift_month integer null,
  shifted_quantity integer null,
  workflow_status text not null default 'open',
  manager_note text null,
  reviewed_at timestamptz null,
  reviewed_by_email text null,
  reviewed_by_name text null,
  submitted_at timestamptz null,
  submitted_by_email text null,
  submitted_by_name text null,
  created_at timestamptz not null default now(),
  created_by_email text null,
  created_by_name text null,
  updated_at timestamptz not null default now(),
  updated_by_email text null,
  updated_by_name text null,
  resolved_at timestamptz null,
  resolved_by_email text null,
  resolved_by_name text null
);

-- Eski forecast-bazlı kurulumlardan güvenli geçiş.
alter table public.crm_forecast_blockers add column if not exists customer_id uuid null;
alter table public.crm_forecast_blockers add column if not exists forecast_id uuid null;
alter table public.crm_forecast_blockers add column if not exists has_blocker boolean;
alter table public.crm_forecast_blockers add column if not exists blocker_category text null;
alter table public.crm_forecast_blockers add column if not exists blocker_description text null;
alter table public.crm_forecast_blockers add column if not exists resolution_owner_type text null;
alter table public.crm_forecast_blockers add column if not exists resolution_owner_name text null;
alter table public.crm_forecast_blockers add column if not exists resolution_due_date date null;
alter table public.crm_forecast_blockers add column if not exists impact_type text not null default 'none';
alter table public.crm_forecast_blockers add column if not exists shift_year integer null;
alter table public.crm_forecast_blockers add column if not exists shift_month integer null;
alter table public.crm_forecast_blockers add column if not exists shifted_quantity integer null;
alter table public.crm_forecast_blockers add column if not exists workflow_status text not null default 'open';
alter table public.crm_forecast_blockers add column if not exists manager_note text null;
alter table public.crm_forecast_blockers add column if not exists reviewed_at timestamptz null;
alter table public.crm_forecast_blockers add column if not exists reviewed_by_email text null;
alter table public.crm_forecast_blockers add column if not exists reviewed_by_name text null;
alter table public.crm_forecast_blockers add column if not exists submitted_at timestamptz null;
alter table public.crm_forecast_blockers add column if not exists submitted_by_email text null;
alter table public.crm_forecast_blockers add column if not exists submitted_by_name text null;
alter table public.crm_forecast_blockers add column if not exists created_at timestamptz not null default now();
alter table public.crm_forecast_blockers add column if not exists created_by_email text null;
alter table public.crm_forecast_blockers add column if not exists created_by_name text null;
alter table public.crm_forecast_blockers add column if not exists updated_at timestamptz not null default now();
alter table public.crm_forecast_blockers add column if not exists updated_by_email text null;
alter table public.crm_forecast_blockers add column if not exists updated_by_name text null;
alter table public.crm_forecast_blockers add column if not exists resolved_at timestamptz null;
alter table public.crm_forecast_blockers add column if not exists resolved_by_email text null;
alter table public.crm_forecast_blockers add column if not exists resolved_by_name text null;

update public.crm_forecast_blockers b
set customer_id = f.customer_id
from public.crm_forecasts f
where b.customer_id is null
  and b.forecast_id = f.id;

update public.crm_forecast_blockers set has_blocker = true where has_blocker is null;
update public.crm_forecast_blockers set impact_type = 'none' where impact_type is null;
update public.crm_forecast_blockers
set workflow_status = case when has_blocker then 'open' else 'no_blocker' end
where workflow_status is null;

-- Aynı müşteriye ait eski birden fazla forecast kaydı varsa en güncel değerlendirmeyi koru.
with ranked as (
  select
    id,
    row_number() over (
      partition by customer_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.crm_forecast_blockers
  where customer_id is not null
)
delete from public.crm_forecast_blockers b
using ranked r
where b.id = r.id and r.rn > 1;

alter table public.crm_forecast_blockers alter column forecast_id drop not null;
alter table public.crm_forecast_blockers alter column customer_id set not null;
alter table public.crm_forecast_blockers alter column has_blocker set not null;

-- Eski otomatik FK forecast silinince kaydı tamamen siliyordu; müşteri değerlendirmesi korunmalı.
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_forecast_id_fkey;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_customer_id_fkey;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_forecast_fk;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_customer_fk;
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_customer_fk
  foreign key (customer_id) references public.musteriler(id) on delete cascade;
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_forecast_fk
  foreign key (forecast_id) references public.crm_forecasts(id) on delete set null;

-- Eski forecast-bazlı benzersizliği kaldır; artık müşteri başına tek güncel değerlendirme var.
drop index if exists public.ux_crm_forecast_blockers_forecast;
create unique index if not exists ux_crm_forecast_blockers_customer
  on public.crm_forecast_blockers (customer_id);
create index if not exists idx_crm_forecast_blockers_forecast
  on public.crm_forecast_blockers (forecast_id)
  where forecast_id is not null;
create index if not exists idx_crm_forecast_blockers_status
  on public.crm_forecast_blockers (workflow_status, updated_at desc);
create index if not exists idx_crm_forecast_blockers_due
  on public.crm_forecast_blockers (resolution_due_date)
  where workflow_status in ('open', 'in_progress');
create index if not exists idx_crm_forecast_blockers_shift_period
  on public.crm_forecast_blockers (shift_year, shift_month)
  where impact_type = 'month_shift';
create index if not exists idx_crm_forecast_blockers_updated
  on public.crm_forecast_blockers (updated_at desc);

alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_category_allowed;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_owner_type_allowed;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_impact_allowed;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_status_allowed;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_shift_month_range;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_shift_year_range;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_quantity_positive;
alter table public.crm_forecast_blockers drop constraint if exists crm_forecast_blockers_logical_fields;

alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_category_allowed
  check (blocker_category is null or blocker_category in ('customer_decision','pricing','technical','integration','contract_legal','bank_partner','stock_supply','internal_approval','operation','other'));
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_owner_type_allowed
  check (resolution_owner_type is null or resolution_owner_type in ('internal','customer','bank','partner','other'));
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_impact_allowed
  check (impact_type in ('none','month_shift'));
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_status_allowed
  check (workflow_status in ('no_blocker','open','in_progress','resolved'));
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_shift_month_range
  check (shift_month is null or shift_month between 1 and 12);
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_shift_year_range
  check (shift_year is null or shift_year between 2024 and 2100);
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_quantity_positive
  check (shifted_quantity is null or shifted_quantity > 0);
alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_logical_fields check (
  (has_blocker = false
    and workflow_status = 'no_blocker'
    and forecast_id is null
    and blocker_category is null
    and blocker_description is null
    and resolution_owner_type is null
    and resolution_owner_name is null
    and resolution_due_date is null
    and impact_type = 'none'
    and shift_year is null
    and shift_month is null
    and shifted_quantity is null)
  or
  (has_blocker = true
    and workflow_status in ('open','in_progress','resolved')
    and blocker_category is not null
    and nullif(trim(blocker_description), '') is not null
    and resolution_owner_type is not null
    and nullif(trim(resolution_owner_name), '') is not null
    and resolution_due_date is not null
    and (
      (impact_type = 'none' and shift_year is null and shift_month is null and shifted_quantity is null)
      or
      (impact_type = 'month_shift' and forecast_id is not null and shift_year is not null and shift_month is not null and shifted_quantity is not null)
    ))
);

create table if not exists public.crm_forecast_blocker_history (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid null,
  customer_id uuid null,
  forecast_id uuid null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  changed_by_email text null,
  changed_by_name text null,
  changed_at timestamptz not null default now()
);

alter table public.crm_forecast_blocker_history add column if not exists customer_id uuid null;
alter table public.crm_forecast_blocker_history add column if not exists forecast_id uuid null;

update public.crm_forecast_blocker_history h
set customer_id = coalesce(
  nullif(h.new_data ->> 'customer_id', '')::uuid,
  nullif(h.old_data ->> 'customer_id', '')::uuid,
  (select f.customer_id from public.crm_forecasts f where f.id = h.forecast_id limit 1)
)
where h.customer_id is null;

create index if not exists idx_crm_forecast_blocker_history_customer
  on public.crm_forecast_blocker_history (customer_id, changed_at desc);
create index if not exists idx_crm_forecast_blocker_history_forecast
  on public.crm_forecast_blocker_history (forecast_id, changed_at desc);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists crm_forecast_blockers_touch_updated_at on public.crm_forecast_blockers;
create trigger crm_forecast_blockers_touch_updated_at
before update on public.crm_forecast_blockers
for each row execute function public.touch_updated_at();

create or replace function public.log_crm_forecast_blocker_history() returns trigger as $$
declare
  v_action text;
  v_actor_email text;
  v_actor_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.crm_forecast_blocker_history (
      blocker_id, customer_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name
    ) values (
      new.id, new.customer_id, new.forecast_id, 'insert', null, to_jsonb(new), new.updated_by_email, new.updated_by_name
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.crm_forecast_blocker_history (
      blocker_id, customer_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name
    ) values (
      old.id, old.customer_id, old.forecast_id, 'delete', to_jsonb(old), null, old.updated_by_email, old.updated_by_name
    );
    return old;
  end if;

  v_action := case
    when old.workflow_status <> 'resolved' and new.workflow_status = 'resolved' then 'resolve'
    when old.workflow_status = 'resolved' and new.workflow_status <> 'resolved' then 'reopen'
    when old.reviewed_at is distinct from new.reviewed_at or old.manager_note is distinct from new.manager_note then 'manager_review'
    else 'update'
  end;
  v_actor_email := new.updated_by_email;
  v_actor_name := new.updated_by_name;

  insert into public.crm_forecast_blocker_history (
    blocker_id, customer_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name
  ) values (
    new.id, new.customer_id, new.forecast_id, v_action, to_jsonb(old), to_jsonb(new), v_actor_email, v_actor_name
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists crm_forecast_blockers_history on public.crm_forecast_blockers;
create trigger crm_forecast_blockers_history
after insert or update or delete on public.crm_forecast_blockers
for each row execute function public.log_crm_forecast_blocker_history();

-- The previous forecast-based view used a different column order.
-- PostgreSQL cannot rename/reorder existing view columns with CREATE OR REPLACE VIEW,
-- so recreate only the view. This does not delete blocker/history table data.
begin;

drop view if exists public.v_crm_forecast_blocker_impact;

create view public.v_crm_forecast_blocker_impact as
select
  m.id as customer_id,
  m.musteri,
  m.sektor,
  m.sorumlu,
  m.entegrasyon_tipi,
  selected_forecast.id as forecast_id,
  selected_forecast.product_id,
  selected_forecast.product_code_snapshot,
  selected_forecast.product_name_snapshot,
  selected_forecast.quantity,
  selected_forecast.forecast_year,
  selected_forecast.forecast_month,
  case
    when selected_forecast.id is null then 'Aktif Forecast yok'
    else case selected_forecast.forecast_month
      when 1 then 'Ocak' when 2 then 'Şubat' when 3 then 'Mart' when 4 then 'Nisan'
      when 5 then 'Mayıs' when 6 then 'Haziran' when 7 then 'Temmuz' when 8 then 'Ağustos'
      when 9 then 'Eylül' when 10 then 'Ekim' when 11 then 'Kasım' when 12 then 'Aralık' else '-'
    end || ' ' || selected_forecast.forecast_year::text
  end as forecast_period_label,
  selected_forecast.owner_name,
  selected_forecast.owner_email,
  coalesce(forecast_summary.active_forecast_count, 0)::integer as active_forecast_count,
  coalesce(forecast_summary.total_forecast_quantity, 0)::integer as total_forecast_quantity,
  coalesce(forecast_summary.forecast_options, '[]'::jsonb) as forecast_options,
  b.id as blocker_id,
  b.has_blocker,
  b.blocker_category,
  b.blocker_description,
  b.resolution_owner_type,
  b.resolution_owner_name,
  b.resolution_due_date,
  b.impact_type,
  b.shift_year,
  b.shift_month,
  b.shifted_quantity,
  case when b.shift_year is null or b.shift_month is null then null else
    case b.shift_month
      when 1 then 'Ocak' when 2 then 'Şubat' when 3 then 'Mart' when 4 then 'Nisan'
      when 5 then 'Mayıs' when 6 then 'Haziran' when 7 then 'Temmuz' when 8 then 'Ağustos'
      when 9 then 'Eylül' when 10 then 'Ekim' when 11 then 'Kasım' when 12 then 'Aralık' else '-'
    end || ' ' || b.shift_year::text
  end as shift_period_label,
  b.workflow_status,
  b.manager_note,
  b.reviewed_at,
  b.reviewed_by_email,
  b.reviewed_by_name,
  b.submitted_at,
  b.submitted_by_email,
  b.submitted_by_name,
  b.updated_at,
  b.updated_by_email,
  b.updated_by_name,
  b.resolved_at,
  case
    when b.id is null then 'pending'
    when b.has_blocker = false then 'no_blocker'
    when b.workflow_status = 'resolved' then 'resolved'
    when b.resolution_due_date < current_date then 'overdue'
    when b.workflow_status = 'in_progress' then 'in_progress'
    else 'open'
  end as effective_status
from public.musteriler m
left join public.crm_forecast_blockers b on b.customer_id = m.id
left join lateral (
  select
    count(*)::integer as active_forecast_count,
    coalesce(sum(f.quantity), 0)::integer as total_forecast_quantity,
    jsonb_agg(
      jsonb_build_object(
        'forecast_id', f.id::text,
        'product_code', f.product_code_snapshot,
        'product_name', f.product_name_snapshot,
        'quantity', f.quantity,
        'year', f.forecast_year,
        'month', f.forecast_month,
        'period_label', case f.forecast_month
          when 1 then 'Ocak' when 2 then 'Şubat' when 3 then 'Mart' when 4 then 'Nisan'
          when 5 then 'Mayıs' when 6 then 'Haziran' when 7 then 'Temmuz' when 8 then 'Ağustos'
          when 9 then 'Eylül' when 10 then 'Ekim' when 11 then 'Kasım' when 12 then 'Aralık' else '-'
        end || ' ' || f.forecast_year::text
      ) order by f.forecast_year, f.forecast_month, f.product_name_snapshot
    ) as forecast_options
  from public.crm_forecasts f
  where f.customer_id = m.id and f.is_active = true
) forecast_summary on true
left join lateral (
  select f.*
  from public.crm_forecasts f
  where f.customer_id = m.id
    and (f.is_active = true or f.id = b.forecast_id)
  order by
    case when f.id = b.forecast_id then 0 else 1 end,
    f.forecast_year,
    f.forecast_month,
    f.product_name_snapshot
  limit 1
) selected_forecast on true;

commit;
