-- 20260910_029_satis_kanali_is_ortagi.sql
-- SATIŞ KANALI: "Paramtech" kalkıyor, yerine "İş Ortağı" — Sinan, 10.09.2026:
-- "Paramtech olmasın, onu kaldıralım; o olanları da iş ortağına çevirebilirsin."
--
-- Paramtech bir iş ortağının adıdır, kanal adı değil (yarın ikinci bir iş ortağı gelince
-- liste isim isim büyürdü). Kanal listesi: Banka · Direkt Satış · İş Ortağı · Kanal.
-- 028 ile içe aktarılan 56 Paramtech satırı (ve elle girilmiş varsa onlar da) İş Ortağı olur;
-- hangi iş ortağı olduğu satışın notunda / kaynak listesinde duruyor.
--
-- Dosya idempotenttir. 028'den SONRA çalışır (aynı deploy'da sırayla).

-- 1) Yeni kanal değeri
insert into public.system_parameters (group_key, param_key, label, value, sort_order)
values ('forecast_sales_channel', 'is_ortagi', 'İş Ortağı', 'Is Ortagi', 25)
on conflict do nothing;

-- 2) Mevcut kayıtların çevrilmesi (satışlar + içe aktarım bekleme tablosu + forecast)
update public.crm_sales set sales_channel = 'Is Ortagi', updated_at = now()
where sales_channel = 'Paramtech';

update public.crm_sales_import_pivot set sales_channel = 'Is Ortagi'
where sales_channel = 'Paramtech';

update public.crm_forecasts set sales_channel = 'Is Ortagi'
where sales_channel = 'Paramtech';

-- 3) Paramtech seçeneği listeden kalkar (kayıt silinmez, pasife alınır: geçmiş değer okunabilsin)
update public.system_parameters
set is_active = false, updated_at = now()
where group_key = 'forecast_sales_channel' and param_key = 'paramtech';
