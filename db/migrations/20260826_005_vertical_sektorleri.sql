-- 20260826_005_vertical_sektorleri.sql
-- Vertical iş kolu sektörleri (Seda ile 26.08.2026 toplantısı).
--
-- Genel "Vertical" sektör başlığı yerine seçilebilir gerçek sektörler tanımlanır.
-- Etikette "Vertical" öneki KULLANILMAZ; iş kolu bilgisi meta.business_line
-- alanında tutulur. Raporlar (satışçı sunumu başlığı vb.) Vertical ayrımını
-- bu meta alanından yapar — bkz. lib/weekly-management-presentation.ts.
--
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir.

-- 0) Ara sürümde "Vertical - X" önekiyle kaydedilmiş müşteri varsa düz ada çevrilir.
update public.musteriler m
set sektor = regexp_replace(m.sektor, '^Vertical - ', '')
where m.sektor like 'Vertical - %';

-- 1) Vertical sektörleri eklenir / güncellenir (param_key sabit kimliktir).
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('crm_sector', 'vertical_ev_charge',       'EV Charge',         'EV Charge',         81, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb),
  ('crm_sector', 'vertical_otopark',         'Otopark',           'Otopark',           82, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb),
  ('crm_sector', 'vertical_otomobil',        'Otomobil',          'Otomobil',          83, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb),
  ('crm_sector', 'vertical_ulasim_belediye', 'Ulaşım & Belediye', 'Ulaşım & Belediye', 84, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb),
  ('crm_sector', 'vertical_eglence_oyun',    'Eğlence & Oyun',    'Eğlence & Oyun',    85, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb),
  ('crm_sector', 'vertical_ozel_projeler',   'Özel Projeler',     'Özel Projeler',     86, '{"source":"manual","module":"CRM","category":"Sektör","business_line":"vertical"}'::jsonb)
on conflict (group_key, param_key) do update
  set label = excluded.label,
      value = excluded.value,
      sort_order = excluded.sort_order,
      meta = excluded.meta,
      is_active = true,
      updated_at = now();

-- 2) Hiçbir müşteriye bağlı olmayan genel "Vertical" başlıkları pasife çekilir.
--    Seed satırı hard-delete edilirse baseline migration tekrar çalıştığında geri
--    gelir; bu yüzden delete yerine is_active = false kullanılır. Müşterisi olan
--    genel "Vertical" başlığı (varsa) müşteriler yeni sektörlere taşınana kadar
--    aktif kalır.
update public.system_parameters p
set is_active = false,
    updated_at = now()
where p.group_key = 'crm_sector'
  and lower(p.value) = 'vertical'
  and p.is_active = true
  and not exists (
    select 1 from public.musteriler m where m.sektor = p.value
  );
