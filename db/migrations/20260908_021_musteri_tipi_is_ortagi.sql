-- 20260908_021_musteri_tipi_is_ortagi.sql
-- Partner-only kayıtların geriye uyumlu customer_type değerini garanti eder.
-- Firma rolleri organization_roles üzerinde bağımsız tutulur; bir firma aynı anda
-- hem müşteri hem iş ortağı olabilir. Entegrasyon yeteneği de bu rollerden bağımsızdır.
--
-- Müşteri Tipi listesindeki 'business_partner' seçeneği eski istemciler ve partner-only
-- kayıtlar için kullanılmaya devam eder. Liste Yönetimleri'nden elle silinmiş/pasife
-- alınmış olabileceği için bu dosya seçeneği garanti eder.
--
-- Dosya idempotenttir; mevcut etiket/sıra elle değiştirilmişse KORUNUR (sadece aktifleştirir).

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active)
values ('crm_customer_type', 'business_partner', 'İş Ortağı', 'business_partner', 50, true)
on conflict (group_key, param_key) do update
  set is_active = true,
      value = 'business_partner',
      updated_at = now();
