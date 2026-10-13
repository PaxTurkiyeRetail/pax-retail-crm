-- 20261013_043_tv_device_screens.sql
-- TV cihazı başına gösterilecek Dashboard sekmeleri (live / followup / activity / faz).
-- Varsayılan yalnız Canlı Ekran; mevcut cihazlar bu varsayılanı alır.
--
-- Dosya idempotenttir. Veri silmez.

alter table public.tv_devices add column if not exists screens text[] not null default '{live}';
