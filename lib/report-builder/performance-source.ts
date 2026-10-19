/** Common owner/month grain. Facts stay in independent UNION ALL branches: never join
 * sales, forecasts and targets together (that multiplies amounts and quantities).
 * User targets only; company totals must not be added to individual targets.
 * Monthly target allocation mirrors performance-report.monthShare: quarter > year > month.
 */
export const PERFORMANCE_COMPARISON_FROM = `(
  with target_months as (
    select tv.scope_user_id::text as owner_user_id, td.code, g.month::date as month,
      tv.target_value / case tv.period_type when 'quarter' then 3 when 'year' then 12 else 1 end as value,
      row_number() over (
        partition by tv.scope_user_id, td.code, g.month
        order by case tv.period_type when 'quarter' then 1 when 'year' then 2 else 3 end,
          tv.period_start desc, tv.updated_at desc, tv.id
      ) as priority
    from public.crm_target_values tv
    join public.crm_target_definitions td on td.id = tv.definition_id
    cross join lateral generate_series(date_trunc('month', tv.period_start::timestamp),
      date_trunc('month', tv.period_end::timestamp), interval '1 month') g(month)
    where td.is_active = true and td.code in ('device_count', 'sales_revenue')
      and tv.scope_type = 'user' and tv.period_type in ('month', 'quarter', 'year')
      and (g.month::date + 14) between tv.period_start and tv.period_end
  ), facts as (
    select s.owner_user_id::text as owner_user_id, s.owner_email, s.owner_name,
      date_trunc('month', s.sale_date)::date as month,
      case when si.n > 0 then si.sold else s.device_count end::numeric as actual_quantity,
      case when s.currency = 'USD' then s.amount else 0 end::numeric as actual_usd,
      0::numeric as forecast_quantity, 0::numeric as weighted_forecast_quantity,
      null::numeric as target_quantity, null::numeric as target_usd
    from public.crm_sales s
    left join lateral (
      select count(*) as n,
        coalesce(sum(i.quantity) filter (where public.crm_sale_item_is_device(i.product_type, i.is_recurring)
          and i.sale_type is distinct from 'rental'), 0) as sold
      from public.crm_sale_items i where i.sale_id = s.id
    ) si on true
    where s.status = 'active'
    union all
    select f.owner_user_id::text, f.owner_email, f.owner_name,
      make_date(f.forecast_year, f.forecast_month, 1), 0, 0,
      f.quantity, f.quantity * f.probability / 100.0, null, null
    from public.crm_forecasts f
    where f.is_active = true and coalesce(to_jsonb(f)->>'sale_type','sale') <> 'rental' and exists (
      select 1 from public.quote_products p where p.id::text = f.product_id
        and p.product_type in ('device', 'bundle')
    )
    union all
    select t.owner_user_id, null, null, t.month, 0, 0, 0, 0,
      case when t.code = 'device_count' then t.value end,
      case when t.code = 'sales_revenue' then t.value end
    from target_months t where t.priority = 1
  ), monthly as (
    select coalesce(nullif(owner_user_id, ''), nullif(lower(trim(owner_email)), ''),
        'name:' || coalesce(nullif(trim(owner_name), ''), 'Havuz')) as owner_key,
      month, max(nullif(owner_user_id, '')) as owner_user_id,
      max(owner_email) as owner_email, max(owner_name) as owner_name,
      sum(actual_quantity) as actual_quantity, sum(actual_usd) as actual_usd,
      sum(forecast_quantity) as forecast_quantity,
      sum(weighted_forecast_quantity) as weighted_forecast_quantity,
      sum(target_quantity) as target_quantity, sum(target_usd) as target_usd
    from facts group by 1, 2
  )
  select p.*, coalesce(nullif(trim(u.full_name), ''), u.email, p.owner_name, p.owner_email, 'Havuz') as owner_label
  from monthly p left join public.allowed_users u on u.id::text = p.owner_user_id
) pc`;
