-- 20260908_021_musteri_tipi_is_ortagi.sql
-- "Firma Rolü" alanı Müşteri Ekle/Düzenle formundan kaldırıldı (Sinan, 08.09.2026:
-- "firma rolünü çıkar, zaten müşteri tipi var"). Rol artık MÜŞTERİ TİPİ'nden türetilir:
-- tip 'business_partner' → iş ortağı rolü, diğer her tip → müşteri rolü
-- (organization_roles ve customer_type buna göre yazılır).
--
-- Bu yüzden Müşteri Tipi listesinde 'business_partner' seçeneği ZORUNLU: yoksa hiçbir
-- firma iş ortağı işaretlenemez ve `assertActiveParameterValue('crm_customer_type', …)`
-- doğrulaması reddeder. Liste Yönetimleri'nden elle silinmiş/pasife alınmış olabileceği
-- için bu dosya seçeneği garanti eder.
--
-- Dosya idempotenttir; mevcut etiket/sıra elle değiştirilmişse KORUNUR (sadece aktifleştirir).

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active)
values ('crm_customer_type', 'business_partner', 'İş Ortağı', 'business_partner', 50, true)
on conflict (group_key, param_key) do update
  set is_active = true,
      value = 'business_partner',
      updated_at = now();
