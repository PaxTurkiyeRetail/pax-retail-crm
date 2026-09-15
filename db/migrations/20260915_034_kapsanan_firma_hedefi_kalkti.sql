-- ---------------------------------------------------------------------------
-- 034 — "Kapsanan firma" hedefi kalkıyor (Sinan, 15.09.2026 akşam)
--
-- Sinan: "kapsanan firmayı kaldıralım" → HEDEF kalkıyor; Canlı Ekran'daki kutu ise
-- **"Temas Edilen Müşteri"** adıyla duruyor (Sinan: "temas edilen müşteri sayısı olarak
-- değiştirelim") — yalnız sayı, "/ hedef" kısmı yok.
-- 033'teki `quotes_won_count` ile aynı yöntem: tanım SİLİNMEZ, **pasife alınır** —
-- girilmiş değerler (`crm_target_values`) tarihçe olarak durur, ekranlarda görünmez.
-- Kod tarafı: `TARGET_DEFINITIONS` listesinden çıkarıldı (Hedefler ekranı) ve
-- Canlı Ekran'ın Portföy Sağlığı kutusundaki hücre "Temas Edilen Müşteri" olarak yeniden
-- adlandırıldı, hedef karşılaştırması kaldırıldı.
--
-- "Ortalama temas / firma" DURUYOR: paydası bu sayıdır.
-- ---------------------------------------------------------------------------

update public.crm_target_definitions
set is_active = false, updated_at = now()
where code = 'covered_customers';
