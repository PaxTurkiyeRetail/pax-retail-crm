-- 20260916_037_entegrasyon_tamamlandi_tanimi.sql
-- ENTEGRASYON "TAMAMLANDI" — tek ortak tanım (altın kural 17)
--
-- KAYNAK (Sinan, 16.09.2026): "özette gelen entegrasyon hedefi kişi bazlıda gelmiyor…
--   Furkan'a bir sürü entegrasyon girdik, görünmüyor. Takım 35/5500, Furkan'ın kartı 1/2000."
--
-- TEŞHİS (canlı sorgu ile kanıtlandı, sql/entegrasyon_sayaci_KARSILASTIRMA.sql):
--   Canlı Ekran (`Q_INTEGRATIONS`) ve Entegrasyon Raporu, entegrasyon "tamamlandı" sayısını
--   HER FİRMA İÇİN `organization_pipeline_states`te `context_key='business_partner'` olan
--   satırın `active_phase_no >= 9` olmasına bakarak hesaplıyordu.
--
--   Ne var ki `business_partner` bağlamı İKİ AYRI numaralandırma taşıyor:
--     * baseline migration 004'ün tohumladığı eski satırlar → 25 fazlık MÜŞTERİ numarası
--       (o gün customer_type='business_partner' olan firmaların müşteri fazı bu bağlama
--        doğrudan kopyalanmış — ör. YARGICI: faz 24 "Rollout")
--     * gerçek iş ortağı aktivitesinden üretilen satırlar → 14 fazlık İŞ ORTAĞI numarası
--   `>= 9` eşiği ikisine birden uygulandığı için: hizmet faturası kesilen 10 firmadan yalnız
--   YANLIŞ etiketlenmiş olan (YARGICI) sayılıyordu; müşteri bağlamında gerçekten Rollout'ta
--   (faz 24) olan doğru 9 firma (SUWEN dahil) hiç sayılmıyordu.
--
-- KARAR (Sinan, 16.09 — karşılaştırma raporu §A/§D gösterildikten sonra):
--   Sayaç artık firmanın KENDİ hattındaki tamamlanma eşiğine baksın:
--     * gerçek iş ortağı (organization_roles.role_key='business_partner' aktif)
--         → iş ortağı fazı >= 10 "Entegrasyon Süreci Tamamlandı"
--           (faz 9 "Kontrollü Pilot Uygulama" HENÜZ tamamlanmış sayılmaz — bilinçli seçim,
--            Seda Kesikoğlu'nun 8 firması bu yüzden mevcut 32'den 24'e düşüyor; pilot ≠ bitti)
--     * son müşteri (kendi entegrasyonunu kendi yürüten)
--         → müşteri fazı >= 24 "Rollout"
--
-- TEK ORTAK TANIM: Canlı Ekran (`Q_INTEGRATIONS`), Entegrasyon Raporu (`entegrasyon-raporu.ts`)
-- ve ekrandaki yeşil rozet (`EntegrasyonRaporuClient.tsx`) üçü de bu görünümü okur; ayrı ayrı
-- eşik yazılmaz (altın kural 17). Görünüm SALT OKUNUR, veri yazmaz/değiştirmez.
--
-- NOT: `organization_pipeline_states.business_partner` bağlamındaki bazı satırlarda (bu
-- görünüm dışında, ayrı bir bulgu) faz numarası hâlâ 14'ü aşıyor olabilir — bunlar ayrı bir
-- veri temizliği konusu, ILERLEME_GUNLUGU.md'de not edildi, bu migration'ın kapsamı değil.

create or replace view public.crm_entegrasyon_durumu as
with roller as (
  select customer_id,
         bool_or(role_key = 'business_partner' and is_active) as is_ortagi_rolu
  from public.organization_roles
  group by customer_id
),
faz as (
  select customer_id,
         max(active_phase_no) filter (where context_key = 'business_partner') as ortak_faz,
         max(active_phase_no) filter (where context_key = 'customer')         as musteri_faz
  from public.organization_pipeline_states
  group by customer_id
)
select
  m.id as customer_id,
  m.musteri,
  m.sorumlu,
  m.is_kolu,
  coalesce(r.is_ortagi_rolu, false) as is_ortagi_rolu,
  case when coalesce(r.is_ortagi_rolu, false) then 'business_partner' else 'customer' end as aktif_baglam,
  case when coalesce(r.is_ortagi_rolu, false) then f.ortak_faz else f.musteri_faz end as aktif_faz_no,
  case
    when coalesce(r.is_ortagi_rolu, false)
      then (select ft.asama_adi from public.is_ortagi_faz_tanimlari ft where ft.faz_no = f.ortak_faz)
    else (select ft.asama_adi from public.faz_tanimlari ft where ft.faz_no = f.musteri_faz)
  end as aktif_faz_adi,
  case
    when coalesce(r.is_ortagi_rolu, false) then coalesce(f.ortak_faz, 0) >= 10
    else coalesce(f.musteri_faz, 0) >= 24
  end as entegrasyon_tamamlandi
from public.musteriler m
left join roller r on r.customer_id = m.id
left join faz    f on f.customer_id = m.id
where m.integration_enabled = true;

comment on view public.crm_entegrasyon_durumu is
  'Entegrasyonu açık firmaların TEK ortak "tamamlandı" tanımı (altın kural 17) — '
  'iş ortağı: faz>=10, son müşteri: faz>=24. Canlı Ekran + Entegrasyon Raporu ortak kaynağı. '
  '16.09.2026, migration 037.';
