-- Bekleyen pivot satırları için CRM'de olası firma adayları (SALT OKUNUR, hiçbir şey yazmaz).
-- 11.09 turundan sonra kalan 14 satır / 10 firma içindir. Karar Sinan'da: eşleşme onaylanırsa
-- `sql/satis_pivot_eslestir.sql` içindeki "Onaylananlar" bloğuna çift eklenip tekrar koşturulur.
with cust as (
  select m.id, m.musteri,
         regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k
  from public.musteriler m
),
bekleyen as (
  select p.firma,
         regexp_replace(upper(translate(p.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k,
         count(*)::int as satir, sum(p.amount)::int as tutar
  from public.crm_sales_import_pivot p
  where p.customer_id is null
  group by 1, 2
)
select b.firma as excel_adi, b.satir, b.tutar,
       coalesce((
         select string_agg(x.musteri, '  |  ')
         from (
           select c.musteri
           from cust c
           where (length(b.k) >= 5 and position(left(b.k, 5) in c.k) > 0)
              or (length(c.k) >= 5 and position(left(c.k, 5) in b.k) > 0)
           order by length(c.musteri)
           limit 5
         ) x
       ), '(aday yok — firma kartı açılmamış olabilir)') as crm_adaylari
from bekleyen b
order by b.tutar desc;
