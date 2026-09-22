-- ===========================================================================
-- ENTEGRASYON CİHAZ SAYACI — hizmet kalemi süzgeci ÖNCE / SONRA (SALT OKUNUR, hiçbir şey yazmaz)
-- ===========================================================================
-- Sinan, 22.09.2026: "Cem Koç entegrasyon hedefi doğru gelmiyor; orası KasaPOS ve KasaPOS + TMS
--   sayılmalı, diğerini hedefe dahil etmeyelim."
--
-- Canlı Ekran'ın cihaz sayacı (lib/reports/live-board.ts Q_INTEGRATION_DEVICES) 17–21.09 arasında
-- hizmet faturasının TÜM kalemlerini sayıyordu (Max Store Kullanım, AirViewer Kullanım dahil). 22.09'dan
-- itibaren yalnız `kasapos_entegrasyonu` ve `kasapos_entegrasyonu_tms` anahtarlı kalemler sayılır
-- (tanım: lib/sales/service-invoices-shared.ts INTEGRATION_DEVICE_SERVICE_KEYS).
--
-- ⚠️ 22.09 DERSİ: `service_key` İKİ BİÇİMDE kayıtlı — Nebim içe aktarımı param_key ('kasapos_entegrasyonu_tms'),
-- ekrandan giriş değerin kendisi ('KasaPOS Entegrasyonu + TMS') yazıyor. İlk süzgeç yalnız birincisini tanıdığı
-- için Canlı Ekran'da entegrasyon 0'a düştü. Eşleşme artık key VE label üzerinden, küçük harf tam eşleşme.
-- §A'daki `service_key` sütunu hangi biçimin ne kadar olduğunu gösterir.
--
-- Bu betik iki hesabı yan yana koyar: §A kalem türlerine göre adet (neyin dışarıda kaldığı görünür),
-- §B satışçı bazında ESKİ ve YENİ kural ile YTD "yeni entegre cihaz" — ekrandaki sayı §B'nin YENİ
-- sütunuyla birebir aynı olmalı. §C Cem Koç'un firma firma kırılımı.
--
-- Kullanım (sunucuda):
--   cd /home/tahabitim/apps/pax-retail-crm
--   set -a && . ./.env.local && set +a
--   psql "$DATABASE_URL" -v yil=2026 -f sql/entegrasyon_cihaz_kalem_KARSILASTIRMA.sql
-- ---------------------------------------------------------------------------

\if :{?yil} \else \set yil 2026 \endif
\timing off
\pset pager off

\echo '=== A) Aktif hizmet faturası kalemleri — tür bazında adet (yıl içi) ==='
select li.service_key,
       li.service_label,
       case when lower(btrim(li.service_key)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms')
            or lower(btrim(li.service_label)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms')
         then 'SAYILIR' else 'sayılmaz' end as hedefte,
       count(*)                     as satir,
       sum(li.quantity)             as adet_toplam_ham,
       count(distinct s.customer_id) as firma
from public.crm_service_invoice_items li
join public.crm_service_invoices s on s.id = li.invoice_id
where s.status = 'active'
  and extract(year from s.period_month) = :yil
group by 1, 2, 3
order by 3, 5 desc;

\echo ''
\echo '=== B) Satışçı bazında YTD yeni entegre cihaz — ESKİ (tüm kalemler) vs YENİ (yalnız KasaPOS) ==='
-- Sayma kuralı ekrandakiyle aynı: firma bazında ayın adedi − önceki faturalı ay (ilk fatura tamamen yeni, azalış 0).
with aylik_eski as (
  select s.customer_id, date_trunc('month', s.period_month)::date as month, sum(li.quantity)::int as adet
  from public.crm_service_invoices s
  join public.crm_service_invoice_items li on li.invoice_id = s.id
  where s.status = 'active' and s.period_month <= current_date
  group by 1, 2
),
aylik_yeni as (
  select s.customer_id, date_trunc('month', s.period_month)::date as month, sum(li.quantity)::int as adet
  from public.crm_service_invoices s
  join public.crm_service_invoice_items li on li.invoice_id = s.id
  where s.status = 'active' and s.period_month <= current_date
    and (lower(btrim(li.service_key)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms')
         or lower(btrim(li.service_label)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms'))
  group by 1, 2
),
artis_eski as (
  select customer_id, month, greatest(adet - coalesce(lag(adet) over (partition by customer_id order by month), 0), 0) as yeni from aylik_eski
),
artis_yeni as (
  select customer_id, month, greatest(adet - coalesce(lag(adet) over (partition by customer_id order by month), 0), 0) as yeni from aylik_yeni
),
sahip as (
  select m.id as customer_id, coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as owner from public.musteriler m
)
select sh.owner                                                           as satisci,
       coalesce(sum(e.yeni) filter (where e.month >= make_date(:yil, 1, 1)), 0) as ytd_eski_tum_kalemler,
       coalesce(sum(y.yeni) filter (where y.month >= make_date(:yil, 1, 1)), 0) as ytd_yeni_yalniz_kasapos,
       coalesce(sum(e.yeni) filter (where e.month >= make_date(:yil, 1, 1)), 0)
         - coalesce(sum(y.yeni) filter (where y.month >= make_date(:yil, 1, 1)), 0) as fark
from sahip sh
left join artis_eski e on e.customer_id = sh.customer_id
left join artis_yeni y on y.customer_id = sh.customer_id and y.month = e.month
group by 1
having coalesce(sum(e.yeni), 0) > 0 or coalesce(sum(y.yeni), 0) > 0
order by 2 desc;

\echo ''
\echo '=== C) Cem Koç — firma ve kalem türü bazında ham adet (yıl içi) ==='
select m.musteri,
       to_char(s.period_month, 'YYYY-MM') as donem,
       li.service_label,
       li.quantity as adet,
       case when lower(btrim(li.service_key)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms')
            or lower(btrim(li.service_label)) in ('kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms', 'kasapos entegrasyonu', 'kasapos entegrasyonu + tms')
         then 'SAYILIR' else 'sayılmaz' end as hedefte
from public.crm_service_invoice_items li
join public.crm_service_invoices s on s.id = li.invoice_id
join public.musteriler m on m.id = s.customer_id
where s.status = 'active'
  and extract(year from s.period_month) = :yil
  and trim(m.sorumlu) = 'Cem Koç'
order by m.musteri, s.period_month, li.service_label;

\echo ''
\echo 'Ekrandaki Cem Koç YTD = §B "ytd_yeni_yalniz_kasapos" olmalı. Fark sütunu, hedeften çıkan Max Store / AirViewer adedidir.'
