/** Independent fact branches; customer joins are one-to-one and never multiply facts. */
export const ACTUAL_FORECAST_FROM=`(
  select s.customer_id,s.owner_user_id::text as owner_user_id,s.owner_email,s.owner_name,
    date_trunc('month',s.sale_date)::date as month,
    coalesce(nullif(upper(trim(i.product_code)),''),'Kod yok (satış): '||i.sale_id::text||':'||i.line_no::text) as model,
    i.quantity::numeric as actual_quantity,0::numeric as forecast_quantity,0::numeric as weighted_forecast_quantity,
    case when s.currency='USD' then i.total_price else 0 end::numeric as actual_usd
  from public.crm_sale_items i join public.crm_sales s on s.id=i.sale_id
  where s.status='active' and public.crm_sale_item_is_device(i.product_type,i.is_recurring)
    and i.sale_type is distinct from 'rental'
  union all
  select f.customer_id,f.owner_user_id::text,f.owner_email,f.owner_name,
    make_date(f.forecast_year,f.forecast_month,1),
    coalesce(nullif(upper(trim(f.product_code_snapshot)),''),'Kod yok (Forecast): '||f.id::text),
    0,f.quantity::numeric,f.quantity*f.probability/100.0,0
  from public.crm_forecasts f
  where f.is_active=true and coalesce(to_jsonb(f)->>'sale_type','sale')<>'rental'
    and exists(select 1 from public.quote_products p where p.id::text=f.product_id and p.product_type in ('device','bundle'))
) af join public.musteriler m on m.id=af.customer_id`;
