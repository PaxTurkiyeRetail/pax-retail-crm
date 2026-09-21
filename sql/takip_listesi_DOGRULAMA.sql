-- ===========================================================================
-- TAKİP LİSTESİ — "sunumdaki sayılar doğru mu?" (SALT OKUNUR, hiçbir şey yazmaz)
-- ===========================================================================
-- Sinan, 18.09.2026: "Sunumdaki veriler doğru mu, son attığım Cem Koç verileri?"
--   Ekranda görünen: Açık Takip 1 · Toplam Adet 800 · Yakın Vadeli Takip 800
--   (Eylül–Kasım: KARACA ZÜCCACİYE)
--
-- Sayıların TANIMI (lib/reports/seller-followup.ts):
--   Açık Takip   = v_crm_forecast_blocker_impact'te effective_status
--                  ('open','in_progress','overdue') olan SATIR sayısı — firma başına bir satır.
--   Toplam Adet  = o firmaların **tüm aktif forecast kalemlerinin** adet toplamı.
--                  DİKKAT: forecast'in ayı/yılı SÜZÜLMEZ — 2027 kalemi de bu toplama girer.
--   Yakın Vadeli = engelin `resolution_due_date` değeri ≤ pencerenin son günü olan
--                  satırların adet toplamı. DİKKAT: ALT SINIR YOK — çözüm tarihi geçmişte
--                  kalan (overdue) engeller de "Eylül–Kasım" etiketiyle buraya girer.
--
-- Bu betik ekrandaki üç sayıyı satır satır yeniden üretir; rakam tutmuyorsa nerede
-- ayrıldığı §D'de görünür.
--
-- Kullanım (sunucuda):
--   cd /home/tahabitim/apps/pax-retail-crm
--   set -a && . ./.env.local && set +a
--   psql "$DATABASE_URL" -v owner="'Cem Koç'" -f sql/takip_listesi_DOGRULAMA.sql
-- (owner verilmezse tüm satış ekibi listelenir.)
-- ---------------------------------------------------------------------------

\if :{?owner} \else \set owner NULL \endif
\timing off
\pset pager off

\echo '=== A) Açık takip satırları (ekrandaki liste) ==='
select
  sorumlu,
  musteri,
  effective_status                              as durum,
  resolution_owner_name                         as konu_kimde,
  resolution_due_date                           as cozum_tarihi,
  case
    when resolution_due_date is null then 'tarih yok'
    when resolution_due_date < current_date then 'GEÇMİŞTE (' || (current_date - resolution_due_date) || ' gün)'
    when resolution_due_date <= (date_trunc('month', current_date) + interval '3 months - 1 day')::date then 'pencere içi'
    else 'pencere dışı'
  end                                           as vade_konumu,
  total_forecast_quantity                       as toplam_adet_view,
  active_forecast_count                         as aktif_forecast_kalem
from public.v_crm_forecast_blocker_impact
where effective_status in ('open', 'in_progress', 'overdue')
  and (:owner is null or sorumlu = :owner)
order by sorumlu, resolution_due_date nulls last, musteri;

\echo ''
\echo '=== B) "Toplam Adet" nereden geliyor: forecast kalemleri tek tek ==='
-- Ekrandaki adet bu satırların toplamıdır. forecast_year/month kolonu, adetin hangi
-- döneme ait olduğunu gösterir — yakın vade etiketiyle ilgisi YOKTUR (etiket engelin
-- çözüm tarihinden gelir), tutarsızlık buradan görülür.
select
  m.sorumlu,
  m.musteri,
  f.product_code_snapshot                       as model,
  f.quantity                                    as adet,
  f.forecast_year || '-' || lpad(f.forecast_month::text, 2, '0') as forecast_donemi,
  f.probability                                 as olasilik,
  f.owner_name                                  as forecast_sahibi,
  f.updated_at                                  as son_guncelleme
from public.crm_forecasts f
join public.musteriler m on m.id = f.customer_id
join public.crm_forecast_blockers b on b.customer_id = m.id
where f.is_active = true
  and b.has_blocker = true
  and coalesce(b.workflow_status, '') <> 'resolved'
  and (:owner is null or m.sorumlu = :owner)
order by m.sorumlu, m.musteri, f.forecast_year, f.forecast_month, f.product_code_snapshot;

\echo ''
\echo '=== C) Pencere sınırları (ekrandaki "Eylül–Kasım" etiketi neyi kapsıyor) ==='
select
  current_date                                                                  as bugun,
  date_trunc('month', current_date)::date                                       as pencere_baslangici_etiketteki,
  (date_trunc('month', current_date) + interval '3 months - 1 day')::date        as pencere_sonu_koddaki,
  'Kodda ALT SINIR YOK: due_date <= pencere sonu olan her kayıt sayılır'         as not;

\echo ''
\echo '=== D) Ekrandaki üç kart — birebir yeniden üretim ==='
with acik as (
  select
    sorumlu,
    musteri,
    resolution_due_date,
    coalesce((
      select sum(f.quantity)::int
      from public.crm_forecasts f
      where f.customer_id = v.customer_id and f.is_active = true
    ), total_forecast_quantity, 0) as adet
  from public.v_crm_forecast_blocker_impact v
  where effective_status in ('open', 'in_progress', 'overdue')
    and (:owner is null or sorumlu = :owner)
)
select
  sorumlu,
  count(*)                                                                      as acik_takip,
  sum(adet)                                                                     as toplam_adet,
  sum(adet) filter (
    where resolution_due_date is not null
      and resolution_due_date <= (date_trunc('month', current_date) + interval '3 months - 1 day')::date
  )                                                                             as yakin_vadeli_ekrandaki,
  sum(adet) filter (
    where resolution_due_date between date_trunc('month', current_date)::date
      and (date_trunc('month', current_date) + interval '3 months - 1 day')::date
  )                                                                             as yakin_vadeli_etikete_uyan,
  string_agg(distinct musteri, ', ' order by musteri)                           as firmalar
from acik
group by sorumlu
order by sorumlu;

\echo ''
\echo 'yakin_vadeli_ekrandaki ile yakin_vadeli_etikete_uyan FARKLIYSA: aradaki adet,'
\echo 'çözüm tarihi GEÇMİŞTE kalan engellerden geliyor ve "Eylül–Kasım" etiketi yanlış.'
