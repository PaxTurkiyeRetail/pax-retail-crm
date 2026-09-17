-- ===========================================================================
-- FİRMA SAYILARI — "301 nereden geliyor, Genel Bakış'taki 671 ile neden farklı?"
-- (SALT OKUNUR, hiçbir şey yazmaz)
-- ===========================================================================
-- Sinan, 17.09.2026: "buradaki 301 neden hâlâ güncellenmemiş, 301 firma sayısını nereden
--   buldun? toplam sayı Genel Bakış'takiyle neden farklı?"
--
-- CEVAP: Ekranda İKİ AYRI KAYNAK var, ikisi de doğru ama farklı şeyi sayıyor —
--   * Genel Bakış "Toplam Müşteri" (671)  → public.musteriler, yani CRM künyesindeki TÜM firmalar.
--   * Müşteri Takip Statüsü donut'u (301) → public.crm_musteri_listesi (Account Atama tablosu),
--     ve 17.09 öncesinde yalnız **Canlı Ekran rotasyonundaki satıcıların** satırlarını sayıyordu.
--     Rotasyon = allowed_users'ta aktif + account_manager rolü olanlar. Cem Koç ile Seda
--     Kesikoğlu'nun kullanıcı hesabı yok (backlog 25) → satırları düşüyordu; Havuz Account,
--     İş Ortakları ve Yemek Kartları kolonları da hiç sayılmıyordu.
--
-- 17.09 DÜZELTMESİ (Sinan: "iki farklı sonuç istemiyoruz, fark neyse orada belirtilsin"):
--   donut'un TOPLAMI artık CRM firma sayısıdır — Genel Bakış'takiyle BİREBİR aynı. Dilimler Account
--   Atama kategorisinden gelir; listede karşılığı olmayan firmalar gri "Listede yok" dilimine düşer.
--   Bu betik aynı farkı kalem kalem gösterir; §F ekrandaki dilimlerin birebir aynısını üretir.
--
-- Not: Account Atama satırı ile CRM firması arasında kimlik bağı henüz YOK
-- (crm_musteri_listesi.musteri_id boş — backlog 39), bu yüzden "listede olmayan firmalar"
-- tek tek eşlenip sayılmaz; iki toplam yan yana konur, uydurma eşleşme üretilmez.
--
-- Kullanım:
--   set -a; . ./.env.local; set +a
--   psql "$DATABASE_URL" -P pager=off -f sql/firma_sayilari_KARSILASTIRMA.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

\echo ''
\echo '=== A) İKİ TOPLAM ==========================================================='
select (select count(*) from public.musteriler)                                as crm_kunye_firma,
       (select count(*) from public.crm_musteri_listesi where is_active)       as account_atama_satir;

\echo ''
\echo '=== B) ACCOUNT ATAMA — SATICI BAZINDA ======================================='
select l.satici,
       count(*)                                  as toplam,
       count(*) filter (where l.kategori = 'H')  as hunter,
       count(*) filter (where l.kategori = 'F')  as farmer,
       count(*) filter (where l.kategori = 'L')  as lead,
       count(*) filter (where l.kategori = 'K')  as kasa,
       exists(
         select 1 from public.allowed_users u
         where u.is_active
           and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
           and lower(coalesce(nullif(trim(u.full_name), ''), u.email)) = lower(trim(l.satici))
       )                                         as canli_ekran_rotasyonunda
from public.crm_musteri_listesi l
where l.is_active
group by l.satici
order by 2 desc;

\echo ''
\echo '=== C) ESKİ 301 NEDEN 301: rotasyondaki satıcıların satırları ==============='
-- 17.09 öncesi donut bu sayıyı gösteriyordu.
with rotasyon as (
  select lower(coalesce(nullif(trim(u.full_name), ''), u.email)) as ad
  from public.allowed_users u
  where u.is_active
    and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
)
select count(*) filter (where lower(trim(l.satici)) in (select ad from rotasyon))     as eski_donut_sayisi,
       count(*) filter (where lower(trim(l.satici)) not in (select ad from rotasyon)) as sayilmayan_satir,
       count(*)                                                                       as yeni_donut_sayisi
from public.crm_musteri_listesi l
where l.is_active;

\echo ''
\echo '=== D) SAYILMAYAN SATIRLAR KİMDE ============================================'
with rotasyon as (
  select lower(coalesce(nullif(trim(u.full_name), ''), u.email)) as ad
  from public.allowed_users u
  where u.is_active
    and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
)
select l.satici, count(*) as sayilmayan
from public.crm_musteri_listesi l
where l.is_active and lower(trim(l.satici)) not in (select ad from rotasyon)
group by l.satici
order by 2 desc;

\echo ''
\echo '=== E) CRM KÜNYESİ — SORUMLU BAZINDA (Yemek Kartları & Havuz slaydının kaynağı) ==='
select coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as sorumlu, count(*)
from public.musteriler m
group by 1 order by 2 desc;

\echo ''
\echo '=== F) EKRANDAKI DONUT ILE BIREBIR AYNI (17.09 sonrasi) ====================='
-- Canlı Ekran "Müşteri Takip Statüsü · Takım" kartı tam olarak bu satırı gösterir:
-- toplam = CRM firma sayısı, dilimler Account Atama kategorisi, eşleşmeyen firmalar "listede_yok".
with liste as (
  select public.crm_firma_key(l.firma) as key, min(l.kategori) as kategori
  from public.crm_musteri_listesi l
  where l.is_active
  group by 1
),
kunye as (
  select public.crm_firma_key(m.musteri) as key from public.musteriler m
)
select count(*) filter (where li.kategori = 'H')::int    as hunter,
       count(*) filter (where li.kategori = 'F')::int    as farmer,
       count(*) filter (where li.kategori = 'L')::int    as lead,
       count(*) filter (where li.kategori = 'K')::int    as kasa,
       count(*) filter (where li.kategori is null)::int  as listede_yok,
       count(*)::int                                     as toplam_donutta,
       (select count(*) from liste l2
         where not exists (select 1 from kunye k2 where k2.key = l2.key))::int as eslesmeyen_liste_satiri
from kunye k
left join liste li on li.key = k.key;

rollback;
