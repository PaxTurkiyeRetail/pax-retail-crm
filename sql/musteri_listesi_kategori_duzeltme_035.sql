-- ===========================================================================
-- Migration 035 SONRASI tek seferlik düzeltme — SALT VERİ (şema yok, migration DEĞİL).
--
-- Sinan, 15.09.2026 gece — DOGRULAMA'da "Kategori çelişkisi" 4 çıktı:
--   DEHASOFT, ECE AŞ, ALSHAYA, EMLAK KATILIM — künye-only firma olarak migration-035
--   tarafından listeye "L" (Lead) diye eklendi (§6), ama bu 4 künyede migrasyondan
--   ÖNCE zaten gerçek bir Satıcı Etiketi vardı ("Hunter"). Migrasyonun künye-only
--   ekleme adımı (§6) bunu kontrol etmeden sabit 'L' yazdı; 7. bölümdeki senkron
--   trigger'ları bu satırlar zaten eklendikten SONRA oluşturulduğu için (script sırası)
--   geriye dönük düzeltmediler.
--
-- Kural: künyenin ÖNCEDEN VAR OLAN gerçek etiketi, migrasyonun "L" varsayımından
-- daha değerli bilgidir → liste bu 4 satırda künyeye uyar (kategori 'L' → 'H').
-- Kapsam bilinçli olarak dar tutuldu: SADECE migration-035'in kendi açtığı
-- satırlar (created_by = 'migration-035') ve SADECE künyenin etiketi boş
-- olmayıp gerçek bir değere karşılık geliyorsa (crm_etiket_to_kategori NULL
-- dönmüyorsa) çalışır — başka hiçbir satıra dokunmaz.
--
-- Not: Bu satır güncellenince trg_crm_liste_to_kunye tetiklenir, ama o trigger
-- künyenin satici_etiketi'ni zaten aynı değere (crm_kategori_to_etiket('H')='Hunter')
-- yeniden yazar — no-op, veri kaybı yok. sorumlu/owner_user_id'ye dokunmaz.
--
-- ÖNCE: bu SELECT ile hangi satırların değişeceğini gör (aynı WHERE, dry-run):
--   select l.firma, l.kategori as eski_kategori,
--          public.crm_etiket_to_kategori(k.satici_etiketi) as yeni_kategori,
--          k.satici_etiketi as kunye_etiketi
--   from public.crm_musteri_listesi l
--   join public.musteri_kunye_v2 k on k.musteri_id = l.musteri_id
--   where l.is_active and l.created_by = 'migration-035'
--     and public.crm_etiket_to_kategori(k.satici_etiketi) is not null
--     and public.crm_etiket_to_kategori(k.satici_etiketi) is distinct from l.kategori;
--
-- Çalıştırma:
--   psql "$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2-)" -f sql/musteri_listesi_kategori_duzeltme_035.sql
-- ===========================================================================

update public.crm_musteri_listesi l
set kategori = public.crm_etiket_to_kategori(k.satici_etiketi),
    updated_at = now(),
    updated_by = 'kategori-duzeltme-035'
from public.musteri_kunye_v2 k
where l.is_active
  and l.musteri_id = k.musteri_id
  and l.created_by = 'migration-035'
  and public.crm_etiket_to_kategori(k.satici_etiketi) is not null
  and public.crm_etiket_to_kategori(k.satici_etiketi) is distinct from l.kategori
returning l.firma, l.kategori as yeni_kategori;
