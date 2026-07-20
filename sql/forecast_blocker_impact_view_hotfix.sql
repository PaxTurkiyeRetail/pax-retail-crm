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
