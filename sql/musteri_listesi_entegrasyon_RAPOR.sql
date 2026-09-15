-- ===========================================================================
-- MÜŞTERİ LİSTESİ (H/F/L/K) ↔ MÜŞTERİ KÜNYESİ — ENTEGRASYON ÖN RAPORU
--
-- SALT OKUNUR. Hiçbir satır yazmaz, değiştirmez, silmez. Sadece SELECT.
-- Sinan, 15.09.2026: "Hunter/Farmer'daki her şirketi müşteriler ile entegre et;
-- olmayanları Lead'in Havuz Account'una at; her yapılan işlem diğerini de
-- tetiklesin ki iki taraf sürekli düzgün kalsın."
--
-- Migration YAZILMADAN ÖNCE bu rapor canlıda koşturulur; sayılar ve örnek satırlar
-- Sinan tarafından gözden geçirilir. Onay çıkınca eşleme + açma migration'ı yazılır.
--
-- ÇALIŞTIRMA (sunucuda, tahabitim ile):
--   cd ~/apps/pax-retail-crm
--   psql "$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2-)" -f sql/musteri_listesi_entegrasyon_RAPOR.sql
--
-- EŞLEŞTİRME KURALI (Hareketsiz Firmalar ekranıyla AYNI — ikinci bir kural üretilmedi):
--   ad NFC + Türkçe harf çevirisi + yalnız A-Z0-9 → normalize anahtar;
--   aynı anahtarda TEK künye varsa eşleşir, birden fazlaysa BELİRSİZ sayılır.
-- ===========================================================================

\set ON_ERROR_STOP on
\timing off

create temporary view r_liste as
  select l.id, l.kategori, trim(l.satici) as satici, l.owner_user_id, trim(l.firma) as firma, l.musteri_id,
         regexp_replace(upper(translate(l.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k
  from public.crm_musteri_listesi l
  where l.is_active;

create temporary view r_kunye as
  select m.id, m.musteri, coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as sorumlu,
         m.owner_user_id, m.customer_type, kv.satici_etiketi,
         regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as k
  from public.musteriler m
  left join public.musteri_kunye_v2 kv on kv.musteri_id = m.id;

create temporary view r_tek as
  select k, (array_agg(id order by id))[1] as id, (array_agg(musteri order by id))[1] as musteri
  from r_kunye group by k having count(*) = 1;

\echo ''
\echo '=== A) ÖZET ==============================================================='
select 'Liste satırı (aktif)'            as konu, count(*)::text as adet from r_liste
union all select 'Künye (müşteri) sayısı',            count(*)::text from r_kunye
union all select 'Liste → künye: TEK adayla eşleşir', count(*)::text from r_liste l join r_tek t on t.k = l.k
union all select 'Liste → künye: BELİRSİZ (aynı ada çok künye)',
                 count(*)::text from r_liste l where exists (select 1 from r_kunye c where c.k = l.k)
                                              and not exists (select 1 from r_tek t where t.k = l.k)
union all select 'Liste → künye: YOK (künye açılacak)',
                 count(*)::text from r_liste l where not exists (select 1 from r_kunye c where c.k = l.k)
union all select 'Künye → liste: listede YOK (Lead/Havuz''a eklenecek)',
                 count(*)::text from r_kunye c where not exists (select 1 from r_liste l where l.k = c.k)
union all select '  bunlardan iş ortağı (ayrı karar)',
                 count(*)::text from r_kunye c where c.customer_type = 'business_partner'
                                              and not exists (select 1 from r_liste l where l.k = c.k)
union all select 'Zaten bağlı satır (musteri_id dolu)', count(*)::text from r_liste where musteri_id is not null;

\echo ''
\echo '=== B) ÇAKIŞMA: aynı firma birden çok kişinin listesinde ==================='
\echo '    (iki yönlü senkronda künyenin sorumlusu kim olacak? — karar gerekir)'
select l.firma, count(*) as satir, string_agg(distinct l.satici || ' (' || l.kategori || ')', ' · ' order by l.satici || ' (' || l.kategori || ')') as kolonlar
from r_liste l group by l.firma having count(distinct l.satici) > 1 order by 2 desc, 1 limit 50;

\echo ''
\echo '=== C) ÇAKIŞMA: liste satıcısı ≠ künye sorumlusu =========================='
\echo '    (eşleşen satırlarda; senkron hangisini doğru kabul edecek?)'
select l.firma, l.satici as liste_saticisi, c.sorumlu as kunye_sorumlusu, l.kategori
from r_liste l join r_tek t on t.k = l.k join r_kunye c on c.id = t.id
where coalesce(nullif(trim(l.satici), ''), '-') is distinct from coalesce(nullif(trim(c.sorumlu), ''), '-')
order by 1 limit 50;

\echo ''
\echo '=== D) ÇAKIŞMA: liste kategorisi ≠ künye satıcı etiketi ==================='
\echo '    (Satıcı Etiketi bugün yalnız Hunter/Farmer; Lead + Kasa eklenecek)'
select l.kategori as liste_kategori, coalesce(c.satici_etiketi, '(boş)') as kunye_etiketi, count(*) as adet
from r_liste l join r_tek t on t.k = l.k join r_kunye c on c.id = t.id
group by 1, 2 order by 3 desc;

\echo ''
\echo '=== E) KÜNYE AÇILACAKLAR (listede var, künyede yok) ======================='
select l.satici, l.kategori, l.firma
from r_liste l where not exists (select 1 from r_kunye c where c.k = l.k)
order by 1, 2, 3 limit 200;

\echo ''
\echo '=== F) BELİRSİZ EŞLEŞMELER (aynı ada birden çok künye) ===================='
\echo '    (elle karar verilecek; migration bunlara DOKUNMAZ)'
select l.firma as liste_adi, l.satici, l.kategori,
       (select string_agg(c.musteri || ' [' || c.sorumlu || ']', '  |  ') from r_kunye c where c.k = l.k) as adaylar
from r_liste l
where exists (select 1 from r_kunye c where c.k = l.k) and not exists (select 1 from r_tek t where t.k = l.k)
order by 1 limit 100;

\echo ''
\echo '=== G) LİSTEYE EKLENECEKLER (künyede var, listede yok) ===================='
\echo '    (Lead → o firmanın künye sorumlusunun kolonuna; sorumlusu yoksa Havuz Account)'
select c.sorumlu as gidecegi_kolon, count(*) as adet
from r_kunye c where not exists (select 1 from r_liste l where l.k = c.k)
group by 1 order by 2 desc;

\echo ''
\echo '--- G2) örnek satırlar ---'
select c.sorumlu as gidecegi_kolon, c.musteri, coalesce(c.customer_type, '-') as tip
from r_kunye c where not exists (select 1 from r_liste l where l.k = c.k)
order by 1, 2 limit 200;
