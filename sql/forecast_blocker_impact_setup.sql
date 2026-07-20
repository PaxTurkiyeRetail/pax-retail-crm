-- PAX CRM Forecast Engel ve Etki Takibi
-- Ayrı, idempotent kurulum dosyasıdır. Mevcut forecast_module_setup.sql değiştirilmez.

create extension if not exists pgcrypto;

create table if not exists public.crm_forecast_blockers (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null references public.crm_forecasts(id) on delete cascade,
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

update public.crm_forecast_blockers set has_blocker = true where has_blocker is null;
update public.crm_forecast_blockers set impact_type = 'none' where impact_type is null;
update public.crm_forecast_blockers set workflow_status = case when has_blocker then 'open' else 'no_blocker' end where workflow_status is null;

alter table public.crm_forecast_blockers alter column has_blocker set not null;

create unique index if not exists ux_crm_forecast_blockers_forecast
  on public.crm_forecast_blockers (forecast_id);

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

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_category_allowed') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_category_allowed
      check (blocker_category is null or blocker_category in ('customer_decision','pricing','technical','integration','contract_legal','bank_partner','stock_supply','internal_approval','operation','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_owner_type_allowed') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_owner_type_allowed
      check (resolution_owner_type is null or resolution_owner_type in ('internal','customer','bank','partner','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_impact_allowed') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_impact_allowed
      check (impact_type in ('none','month_shift'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_status_allowed') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_status_allowed
      check (workflow_status in ('no_blocker','open','in_progress','resolved'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_shift_month_range') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_shift_month_range
      check (shift_month is null or shift_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_shift_year_range') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_shift_year_range
      check (shift_year is null or shift_year between 2024 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_quantity_positive') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_quantity_positive
      check (shifted_quantity is null or shifted_quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_logical_fields') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_logical_fields check (
      (has_blocker = false and workflow_status = 'no_blocker' and blocker_category is null and blocker_description is null and resolution_owner_name is null and resolution_due_date is null and impact_type = 'none' and shift_year is null and shift_month is null and shifted_quantity is null)
      or
      (has_blocker = true and workflow_status in ('open','in_progress','resolved') and blocker_category is not null and nullif(trim(blocker_description), '') is not null and nullif(trim(resolution_owner_name), '') is not null and resolution_due_date is not null and (
        (impact_type = 'none' and shift_year is null and shift_month is null and shifted_quantity is null)
        or
        (impact_type = 'month_shift' and shift_year is not null and shift_month is not null and shifted_quantity is not null)
      ))
    );
  end if;
end $$;

create table if not exists public.crm_forecast_blocker_history (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid null,
  forecast_id uuid not null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  changed_by_email text null,
  changed_by_name text null,
  changed_at timestamptz not null default now()
);

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
    v_action := 'insert';
    v_actor_email := new.updated_by_email;
    v_actor_name := new.updated_by_name;
    insert into public.crm_forecast_blocker_history (blocker_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name)
    values (new.id, new.forecast_id, v_action, null, to_jsonb(new), v_actor_email, v_actor_name);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.crm_forecast_blocker_history (blocker_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name)
    values (old.id, old.forecast_id, 'delete', to_jsonb(old), null, old.updated_by_email, old.updated_by_name);
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
  insert into public.crm_forecast_blocker_history (blocker_id, forecast_id, action, old_data, new_data, changed_by_email, changed_by_name)
  values (new.id, new.forecast_id, v_action, to_jsonb(old), to_jsonb(new), v_actor_email, v_actor_name);
  return new;
end;
$$ language plpgsql;

drop trigger if exists crm_forecast_blockers_history on public.crm_forecast_blockers;
create trigger crm_forecast_blockers_history
after insert or update or delete on public.crm_forecast_blockers
for each row execute function public.log_crm_forecast_blocker_history();

create or replace view public.v_crm_forecast_blocker_impact as
select
  f.id as forecast_id,
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
    when 1 then 'Ocak' when 2 then 'Şubat' when 3 then 'Mart' when 4 then 'Nisan'
    when 5 then 'Mayıs' when 6 then 'Haziran' when 7 then 'Temmuz' when 8 then 'Ağustos'
    when 9 then 'Eylül' when 10 then 'Ekim' when 11 then 'Kasım' when 12 then 'Aralık' else '-'
  end || ' ' || f.forecast_year::text as forecast_period_label,
  f.owner_name,
  f.owner_email,
  f.is_active,
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
from public.crm_forecasts f
join public.musteriler m on m.id = f.customer_id
left join public.crm_forecast_blockers b on b.forecast_id = f.id;
