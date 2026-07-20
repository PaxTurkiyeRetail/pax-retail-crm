-- Müşteri bazlı Engel ve Etki geçiş düzeltmesi
-- Güvenlidir ve tekrar çalıştırılabilir. Veri silmez.

begin;

alter table public.crm_forecast_blocker_history
  add column if not exists customer_id uuid null;

alter table public.crm_forecast_blocker_history
  add column if not exists forecast_id uuid null;

-- Forecast olmayan müşteriler için history kaydı da tutulabilmelidir.
alter table public.crm_forecast_blocker_history
  alter column forecast_id drop not null;

commit;

select
  table_schema,
  table_name,
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'crm_forecast_blocker_history'
  and column_name in ('customer_id', 'forecast_id')
order by column_name;
