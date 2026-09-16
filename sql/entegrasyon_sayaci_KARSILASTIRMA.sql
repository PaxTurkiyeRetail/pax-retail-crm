-- ===========================================================================
-- ENTEGRASYON SAYACI — MEVCUT vs ÖNERİLEN TANIM (SALT OKUNUR, hiçbir şey yazmaz)
-- ===========================================================================
-- Sinan (16.09): "özette gelen entegrasyon hedefi kişi bazlıda gelmiyor…
--   Furkan'a bir sürü entegrasyon girdik, görünmüyor." Takım 35, Furkan 1.
--
-- SEBEP: Canlı Ekran ve Entegrasyon Raporu entegrasyonu şöyle sayıyor —
--   `musteriler.integration_enabled` + `organization_pipeline_states`ta
--   `context_key='business_partner'` satırının `active_phase_no >= 9` olması.
--   Takım sayısı kişilerin TOPLAMIdır, ayrı bir sorgu değildir.
--
--   Ne var ki `business_partner` bağlamı İKİ AYRI numaralandırma taşıyor:
--     * baseline 004'ün tohumladığı eski satırlar → 25'lik MÜŞTERİ numarası
--       (o gün customer_type='business_partner' olan firmaların müşteri fazı
--        bu bağlama kopyalanmış; ör. YARGICI = 24 "Rollout")
--     * aktiviteden üretilen yeni satırlar → 14'lük İŞ ORTAĞI numarası
--   `>= 9` eşiği ikisine birden uygulanıyor. Sonuç: hizmet faturası kesilen 10
--   firmadan yalnız YANLIŞ etiketlenmiş olan (YARGICI) sayılıyor; müşteri
--   bağlamında Rollout'ta (faz 24) olan doğru 9 firma sayılmıyor.
--
-- Bu betik HİÇBİR ŞEYİ DEĞİŞTİRMEZ; yalnız "tanımı değiştirirsek sayılar ne olur"
-- sorusunu kişi kişi yanıtlar. Karar verilmeden kod değiştirilmeyecek.
--
-- Kullanım:
--   set -a; . ./.env.local; set +a
--   psql "$DATABASE_URL" -P pager=off -f sql/entegrasyon_sayaci_KARSILASTIRMA.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

create temp table sayac as
with roller as (
  select customer_id,
         bool_or(role_key = 'business_partner' and is_active) as is_ortagi_rolu,
         bool_or(role_key = 'customer'         and is_active) as musteri_rolu
  from public.organization_roles group by customer_id
),
faz as (
  select customer_id,
         max(active_phase_no) filter (where context_key = 'business_partner') as ortak_faz,
         max(active_phase_no) filter (where context_key = 'customer')         as musteri_faz
  from public.organization_pipeline_states group by customer_id
)
select m.id,
       m.musteri,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as sorumlu,
       coalesce(r.is_ortagi_rolu, false) as is_ortagi_rolu,
       f.ortak_faz,
       f.musteri_faz,
       -- MEVCUT: iş ortağı bağlamındaki faz >= 9 (numaralandırma karışık)
       (coalesce(f.ortak_faz, 0) >= 9) as mevcut_sayilir,
       -- ÖNERİLEN: firmanın KENDİ hattındaki tamamlanma eşiği
       --   gerçek iş ortağı  → iş ortağı fazı >= 10 "Entegrasyon Süreci Tamamlandı"
       --   son müşteri       → müşteri fazı  >= 24 "Rollout"
       (case when coalesce(r.is_ortagi_rolu, false)
             then coalesce(f.ortak_faz, 0) >= 10
             else coalesce(f.musteri_faz, 0) >= 24 end) as onerilen_sayilir
from public.musteriler m
left join roller r on r.customer_id = m.id
left join faz    f on f.customer_id = m.id
where m.integration_enabled = true;

\echo ''
\echo '=== A) KİŞİ BAZINDA: MEVCUT vs ÖNERİLEN ====================================='
select sorumlu,
       count(*)                                  as entegrasyon_acik_firma,
       count(*) filter (where mevcut_sayilir)    as mevcut_gerceklesen,
       count(*) filter (where onerilen_sayilir)  as onerilen_gerceklesen,
       count(*) filter (where onerilen_sayilir) - count(*) filter (where mevcut_sayilir) as fark
from sayac group by sorumlu order by 4 desc nulls last, 1;

\echo ''
\echo '=== B) TAKIM TOPLAMI ========================================================'
select count(*) as entegrasyon_acik_firma,
       count(*) filter (where mevcut_sayilir)   as mevcut_gerceklesen,
       count(*) filter (where onerilen_sayilir) as onerilen_gerceklesen
from sayac;

\echo ''
\echo '=== C) YENİ SAYILMAYA BAŞLAYACAK FİRMALAR (kazanılan) ======================='
select sorumlu, musteri, is_ortagi_rolu, ortak_faz, musteri_faz
from sayac where onerilen_sayilir and not mevcut_sayilir
order by sorumlu, musteri;

\echo ''
\echo '=== D) SAYILMAZ OLACAK FİRMALAR (kaybedilen — DİKKAT) ======================='
-- Bunlar bugün sayılıyor ama önerilen tanımda düşüyor: çoğu, 004'ün yanlış
-- etiketlediği "iş ortağı bağlamında müşteri numarası" satırları olmalı.
select sorumlu, musteri, is_ortagi_rolu, ortak_faz, musteri_faz
from sayac where mevcut_sayilir and not onerilen_sayilir
order by sorumlu, musteri;

\echo ''
\echo '=== E) KARIŞIK NUMARALANDIRMA KANITI ========================================'
-- İş ortağı listesi 14 fazda bitiyor; bağlamda 14''ten büyük faz varsa o satır
-- müşteri numarasıyla doldurulmuş demektir.
select count(*) filter (where ortak_faz > 14)  as ortak_baglaminda_14_ustu,
       count(*) filter (where ortak_faz <= 14) as ortak_baglaminda_gecerli,
       count(*) filter (where ortak_faz > 14 and not is_ortagi_rolu) as hem_14_ustu_hem_rol_yok
from sayac;

rollback;
