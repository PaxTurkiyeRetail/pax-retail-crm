-- ===========================================================================
-- EKSİK 3 FİRMA + ROLLOUT FAZI — TANI RAPORU (SALT OKUNUR, hiçbir şey yazmaz)
-- ===========================================================================
-- Sinan (16.09): "sen ekle kanka, bunlar da rollout'ta, çünkü satış yapılmış,
--   hatta bunlar farmer falan yani" → Naramaxx, Simkoza Mağazacılık, Sınırlı Sorumlu
--   künyeye açılacak; ayrıca fatura kesilen diğer 9 firma da rollout'ta.
--
-- Bu rapor, firmaları YAZMADAN önce üç bilinmeyeni kapatır:
--   1) İş ortağı faz listesinde "rollout" hangi numara? (yerel 24.08 yedeğinde bu tablo boş)
--   2) Üç firma gerçekten yok mu, yoksa benzer adla mı duruyor?
--   3) Yeni firma hangi alanlarla kurulmalı? — YARGICI örnek satır olarak dökülüyor.
--
-- Kullanım:
--   set -a; . ./.env.local; set +a
--   psql "$DATABASE_URL" -P pager=off -f sql/hizmet_faturalari_eksik_firmalar_RAPOR.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

\echo ''
\echo '=== A) İŞ ORTAĞI FAZ LİSTESİ (rollout hangi numara?) ========================='
select faz_no, asama_adi, owner, is_active
from public.is_ortagi_faz_tanimlari
order by faz_no;

\echo ''
\echo '=== B) MÜŞTERİ (satış) FAZ LİSTESİ — karşılaştırma için ====================='
select faz_no, asama_adi
from public.faz_tanimlari
order by faz_no;

\echo ''
\echo '=== C) ÜÇ FİRMA GERÇEKTEN YOK MU? (benzer ad taraması) ======================='
with aranan(ad) as (values ('Naramaxx'), ('Simkoza'), ('Sınırlı Sorumlu'), ('Kooperatif'))
select a.ad as aranan,
       coalesce(m.musteri, '— hiç eşleşme yok —') as crm_musteri,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as sorumlu,
       k.satici_etiketi, m.customer_type, m.integration_enabled
from aranan a
left join public.musteriler m
       on position(public.crm_firma_key(a.ad) in public.crm_firma_key(m.musteri)) > 0
left join public.musteri_kunye_v2 k on k.musteri_id = m.id
order by a.ad, m.musteri;

\echo ''
\echo '=== D) ÖRNEK SATIR — YARGICI (yeni firmalar buna benzetilecek) ==============='
select m.musteri, m.sorumlu, m.owner_user_id::text, m.sektor, m.customer_type,
       m.pipeline_policy, m.is_kolu, m.integration_enabled
from public.musteriler m
where public.crm_firma_key(m.musteri) = public.crm_firma_key('Yargıcı');

\echo '--- YARGICI künye ---'
select k.satici_etiketi, k.musteri_id::text
from public.musteri_kunye_v2 k
join public.musteriler m on m.id = k.musteri_id
where public.crm_firma_key(m.musteri) = public.crm_firma_key('Yargıcı');

\echo '--- YARGICI müşteri listesi satırı ---'
select l.firma, l.kategori, l.satici, l.is_active, l.created_by
from public.crm_musteri_listesi l
join public.musteriler m on m.id = l.musteri_id
where public.crm_firma_key(m.musteri) = public.crm_firma_key('Yargıcı');

\echo '--- YARGICI iş ortağı hattı (faz 24 buradan geliyor) ---'
select ps.context_key, ps.active_phase_no, ps.updated_at
from public.organization_pipeline_states ps
join public.musteriler m on m.id = ps.customer_id
where public.crm_firma_key(m.musteri) = public.crm_firma_key('Yargıcı');

\echo '--- YARGICI firma rolleri ---'
select r.role_key, r.is_active
from public.organization_roles r
join public.musteriler m on m.id = r.customer_id
where public.crm_firma_key(m.musteri) = public.crm_firma_key('Yargıcı');

\echo ''
\echo '=== E) FATURA KESİLEN 10 FİRMANIN ŞU ANKİ DURUMU ============================='
select m.musteri,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as sorumlu,
       k.satici_etiketi                        as kunye_etiketi,
       l.kategori                              as liste_kategorisi,
       m.integration_enabled,
       ps.active_phase_no                      as is_ortagi_faz,
       (select count(*) from public.organization_roles r
         where r.customer_id = m.id and r.role_key = 'business_partner' and r.is_active) as is_ortagi_rolu
from public.musteriler m
join (select distinct customer_id from public.crm_service_invoices
       where created_by = 'nebim-import-2026') s on s.customer_id = m.id
left join public.musteri_kunye_v2 k on k.musteri_id = m.id
left join public.crm_musteri_listesi l on l.musteri_id = m.id and l.is_active
left join public.organization_pipeline_states ps
       on ps.customer_id = m.id and ps.context_key = 'business_partner'
order by m.musteri;

rollback;
