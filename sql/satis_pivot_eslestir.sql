-- Satış pivot içe aktarımı — eşleştirme turu (Sinan onayı, 11.09.2026)
-- 1) Onaylanan birebir eşlemeler  2) ad İÇERME ile otomatik aday (tek adaylıysa)  3) aktarım  4) rapor
-- ÖNKOŞUL: migration 030 uygulanmış olmalı (crm_import_pivot_to_sales fonksiyonu oradan gelir).
-- Hepsi idempotent: yalnız customer_id'si boş satırlara dokunur.

\set ON_ERROR_STOP on


-- 0) Birebir ad eşleşmesi (028'in 3. adımı): sonradan açılan müşteriler de yakalansın ---
with norm as (
  select p.id as import_id,
         regexp_replace(upper(translate(p.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as key
  from public.crm_sales_import_pivot p where p.customer_id is null
),
customers as (
  select m.id, regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as key
  from public.musteriler m
),
tek as (
  select key, (array_agg(id order by id))[1] as customer_id
  from customers group by key having count(*) = 1
)
update public.crm_sales_import_pivot p
set customer_id = tek.customer_id
from norm join tek on tek.key = norm.key
where p.id = norm.import_id;

-- 1) Onaylananlar ------------------------------------------------------------
with pairs(excel, crm) as (values
  ('UNIFREE', 'UNIFREE DUTY FREE'),
  ('ÇAK TEKSTİL', 'ÇAK TEKSTİL LTB'),
  ('NEXİVOX', 'NEXİVOX YAZILIM'),
  ('ÇİÇEK İÇ GİYİM', 'ÇİÇEK RETAIL GROUP'),
  ('PARAMTECH STOK', 'PARAMTECH')
)
update public.crm_sales_import_pivot p
set customer_id = m.id
from pairs, public.musteriler m
where p.customer_id is null
  and regexp_replace(upper(translate(p.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(translate(pairs.excel, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g')
  and regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g')
      = regexp_replace(upper(translate(pairs.crm, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g');

-- 2) Otomatik: Excel adı CRM adının İÇİNDE (ya da tersi) ve TEK aday varsa -----
--    ("PSL - GALLERY CRYSTAL" ⊃ "GALLERY CRYSTAL"). En az 7 karakter şartı, kısa
--    adların yanlış firmaya yapışmasını engeller. Birden çok aday varsa elle karar.
with norm as (
  select p.id, regexp_replace(upper(translate(p.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k
  from public.crm_sales_import_pivot p where p.customer_id is null
),
cust as (
  select m.id, regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k
  from public.musteriler m
),
cand as (
  select n.id as import_id, c.id as customer_id,
         count(*) over (partition by n.id) as adet
  from norm n
  join cust c on (length(n.k) >= 7 and position(n.k in c.k) > 0)
              or (length(c.k) >= 7 and position(c.k in n.k) > 0)
)
update public.crm_sales_import_pivot p
set customer_id = cand.customer_id
from cand
where p.id = cand.import_id and cand.adet = 1 and p.customer_id is null;

-- 3) Eşleşen satırlardan satış kaydı ------------------------------------------
--    Migration 030'daki fonksiyon: AYNI GÜN + AYNI FİRMA + AYNI KANAL satırları TEK satışa
--    (kalemleriyle birlikte) yazar — Çağdaş Bey, 11.09: "aynı gün aynı firma tek fatura,
--    altında kalemler olmalı". Kaç satış açıldığını döner; idempotenttir.
select public.crm_import_pivot_to_sales() as acilan_satis;

-- 4) Rapor --------------------------------------------------------------------
select count(*) filter (where sale_id is not null) aktarilan,
       count(*) filter (where customer_id is null) bekleyen, count(*) toplam
from public.crm_sales_import_pivot;

select p.firma as excel_adi, m.musteri as crm_adi, count(*) satir, sum(p.amount)::int tutar,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as satisci
from public.crm_sales_import_pivot p join public.musteriler m on m.id = p.customer_id
where p.sale_id is not null
group by 1,2,5 order by 4 desc;

select firma, count(*) satir, sum(amount)::int tutar
from public.crm_sales_import_pivot where customer_id is null group by 1 order by 3 desc;
