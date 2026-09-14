-- İçe aktarım sonrası kontrol (SALT OKUNUR).
\echo '--- Yıl / kaynak bazında aktif satışlar ---'
select extract(year from s.sale_date)::int as yil, s.source,
       count(*) as satis, sum(s.device_count) as cihaz, sum(s.amount)::int as tutar
from public.crm_sales s where s.status = 'active' group by 1, 2 order by 1, 2;

\echo '--- 2026 satışçı kırılımı (Canlı Ekran YTD cirosu bununla aynı olmalı) ---'
select coalesce(nullif(trim(owner_name), ''), '(boş)') as satisci,
       count(*) as satis, sum(device_count) as cihaz, sum(amount)::int as tutar
from public.crm_sales
where status = 'active' and extract(year from sale_date) = 2026
group by 1 order by 4 desc;

\echo '--- 2026 model bazlı cihaz kırılımı (kişi slaydındaki çubuklar) ---'
select i.product_code, i.sale_type, sum(i.quantity) as adet
from public.crm_sale_items i join public.crm_sales s on s.id = i.sale_id
where s.status = 'active' and extract(year from s.sale_date) = 2026
group by 1, 2 order by 3 desc;

\echo '--- Tutarlılık: başlık ile kalem toplamı uyuşmayan satış (0 olmalı) ---'
select count(*) as tutarsiz
from public.crm_sales s
where s.status = 'active'
  and exists (select 1 from public.crm_sale_items i where i.sale_id = s.id)
  and s.amount <> (select coalesce(sum(i.total_price), 0) from public.crm_sale_items i where i.sale_id = s.id);

\echo '--- Aynı gün + aynı firma mükerrer içe aktarım satışı (0 olmalı) ---'
select count(*) as mukerrer from (
  select customer_id, sale_date from public.crm_sales
  where created_by like 'import:%' group by 1, 2 having count(*) > 1
) x;
