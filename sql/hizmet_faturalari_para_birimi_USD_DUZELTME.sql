-- ===========================================================================
-- HİZMET FATURALARI — PARA BİRİMİ DÜZELTMESİ: TRY → USD
-- (tek seferlik, İDEMPOTENT — iki kez çalışınca ikinci seferde hiçbir şey değişmez)
-- ===========================================================================
-- Sinan, 18.09.2026: "girilen entegrasyonları dolara çevirir misin, TL'de yanlış
--   import etmişiz oraya belirtmediğim için."
--   Sorulduğunda seçim: "Tutarlar zaten USD'ydi, etiket yanlış."
--
-- NE YAPAR: 16.09'daki Nebim içe aktarımının yazdığı faturaların para birimini
--   'TRY' → 'USD' yapar. TUTARA DOKUNMAZ — kur yoktur, çevrim yoktur; rakamlar
--   baştan USD'ydi, yalnızca etiket yanlıştı.
--
-- KAPSAM: yalnız `created_by = 'nebim-import-2026'` satırları. Elle girilmiş
--   faturalar (Furkan'ın ekrandan girdikleri) DEĞİŞMEZ — onların TL olması doğru
--   olabilir, kimse aksini söylemedi.
--
-- YEDEK: değiştirilen her satırın eski hâli `public.crm_service_invoices_yedek_20260918`
--   tablosuna yazılır (tablo kalır; geri almak gerekirse §5'teki sorgu hazır).
--
-- ETKİ: hizmet cirosu ekranda para birimine göre AYRI toplanıyordu (migration 032
--   kararı) — bu satırlar artık USD kovasında görünür. Cihaz cirosu (crm_sales)
--   ETKİLENMEZ, hizmet faturası ciro tanımına girmiyor.
--
-- Kullanım (sunucuda):
--   cd /home/tahabitim/apps/pax-retail-crm
--   npm run db:backup:predeploy
--   set -a && . ./.env.local && set +a
--   psql "$DATABASE_URL" -f sql/hizmet_faturalari_para_birimi_USD_DUZELTME.sql
-- ---------------------------------------------------------------------------

\timing off
\pset pager off

begin;

-- ---------------------------------------------------------------------------
-- 1) KURU RAPOR — yazmadan önce ne değişecek
-- ---------------------------------------------------------------------------
\echo '=== 1) DEĞİŞECEK KAYITLAR (yazmadan önce) ==================================='
select
  currency                        as para_birimi,
  status                          as durum,
  count(*)                        as fatura,
  sum(amount)                     as tutar,
  min(period_month)               as ilk_donem,
  max(period_month)               as son_donem
from public.crm_service_invoices
where created_by = 'nebim-import-2026'
group by 1, 2
order by 1, 2;

\echo ''
\echo '--- Kapsam dışı (elle girilmiş, DEĞİŞMEYECEK) ---'
select
  coalesce(created_by, '(boş)')   as kaynak,
  currency                        as para_birimi,
  count(*)                        as fatura,
  sum(amount)                     as tutar
from public.crm_service_invoices
where created_by is distinct from 'nebim-import-2026'
group by 1, 2
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 2) YEDEK — değişecek satırların eski hâli
-- ---------------------------------------------------------------------------
create table if not exists public.crm_service_invoices_yedek_20260918 (
  id              uuid primary key,
  customer_id     uuid,
  invoice_no      text,
  period_month    date,
  eski_currency   text,
  amount          numeric(14,2),
  status          text,
  created_by      text,
  yedeklendi_at   timestamptz not null default now()
);

comment on table public.crm_service_invoices_yedek_20260918 is
  '18.09.2026 TRY→USD para birimi düzeltmesinin yedeği. Geri alma sorgusu betiğin §5''inde.';

insert into public.crm_service_invoices_yedek_20260918
  (id, customer_id, invoice_no, period_month, eski_currency, amount, status, created_by)
select i.id, i.customer_id, i.invoice_no, i.period_month, i.currency, i.amount, i.status, i.created_by
from public.crm_service_invoices i
where i.created_by = 'nebim-import-2026'
  and i.currency = 'TRY'
on conflict (id) do nothing;   -- ikinci koşuda yedek büyümez

-- ---------------------------------------------------------------------------
-- 3) YAZMA — para birimini USD yap (tutar aynı kalır)
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== 3) GÜNCELLENEN ==========================================================='
with guncellenen as (
  update public.crm_service_invoices
     set currency   = 'USD',
         updated_by = 'para-birimi-duzeltme-20260918'
   where created_by = 'nebim-import-2026'
     and currency   = 'TRY'          -- idempotent: ikinci koşuda hiçbir satır eşleşmez
  returning id, amount
)
select count(*)                     as guncellenen_fatura,
       coalesce(sum(amount), 0)     as guncellenen_tutar
from guncellenen;

-- ---------------------------------------------------------------------------
-- 4) DOĞRULAMA — betik kendi işini denetler
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== 4) DOĞRULAMA ============================================================='
select
  (select count(*) from public.crm_service_invoices
    where created_by = 'nebim-import-2026' and currency = 'TRY')            as kalan_try_olmali_0,
  (select count(*) from public.crm_service_invoices
    where created_by = 'nebim-import-2026' and currency = 'USD')            as usd_fatura,
  (select coalesce(sum(amount), 0) from public.crm_service_invoices
    where created_by = 'nebim-import-2026' and currency = 'USD')            as usd_tutar,
  (select count(*) from public.crm_service_invoices_yedek_20260918)         as yedeklenen_satir,
  (select coalesce(sum(amount), 0) from public.crm_service_invoices_yedek_20260918)
                                                                            as yedeklenen_tutar;

\echo ''
\echo 'BEKLENEN: kalan_try_olmali_0 = 0 · usd_tutar, yedeklenen_tutar ile AYNI olmalı'
\echo '(tutar değişmedi, yalnız etiket değişti). Farklıysa COMMIT ETME, rollback ver.'

commit;

-- ---------------------------------------------------------------------------
-- 5) GERİ ALMA (gerekirse elle çalıştır — bu betik çalıştırmaz)
-- ---------------------------------------------------------------------------
-- update public.crm_service_invoices i
--    set currency = y.eski_currency, updated_by = 'para-birimi-geri-alma'
--   from public.crm_service_invoices_yedek_20260918 y
--  where y.id = i.id and i.currency = 'USD';
