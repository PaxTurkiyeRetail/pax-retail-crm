-- 20260911_031_hedefler_kapsama_ve_ceyrek_entegrasyon.sql
-- HEDEFLER v3 — Çağdaş Bey, 11.09.2026 toplantısı + Sinan'ın KPI listesi.
--
--   * "İntegrasyon aleti de aynı şekilde çeyreklere bölünecek. Aynı zamanda donut'ta da
--     gözükecek." → `integration_count` artık yıl + ÇEYREK girilir. Tablo tarafında iş yok
--     (026 period_type='quarter' desteğini açtı); tanımın açıklaması güncellenir.
--   * Yeni KPI'lar (Sinan'ın listesi · "Account Performansı" bloğu):
--       - Kapsanan Firma        : yıl içinde en az 1 aktivite girilen tekil firma sayısı
--       - Ortalama Temas/Firma  : yıl içi aktivite / kapsanan firma (hedef: firma başına temas)
--     İkisi de yıllık hedeftir; çeyreğe bölünmez (Sinan, 11.09).
--
-- ENTEGRASYON GERÇEKLEŞEN NOTU: Çağdaş Bey entegrasyon adedinin Furkan'ın fatura kalemlerinden
-- sayılmasını istedi; o veri henüz gelmedi. Sinan'ın kararı (11.09): "boş bırak, veri gelince
-- doldur" — Canlı Ekran hedefi ve çeyreği gösterir, gerçekleşen yerinde "veri bekleniyor" yazar.
-- Faz ≥ 9 sayacı yanlış sayı üretmesin diye kişi slaytında kullanılmaz (takım raporlarında kalır).
--
-- Dosya idempotenttir.

insert into public.crm_target_definitions (code, name, description, unit, source_type, display_order)
values
  ('covered_customers', 'Kapsanan Firma',
   'Yıl içinde en az bir aktivite girilen tekil firma sayısı (pipeline_eventleri; aktiviteyi giren kişiye göre).',
   'count', 'activities', 80),
  ('contacts_per_customer', 'Ortalama Temas / Firma',
   'Yıl içi aktivite sayısı / kapsanan firma sayısı. Portföyün ne kadar sık dokunulduğunu ölçer.',
   'count', 'activities', 90)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, unit = excluded.unit,
      source_type = excluded.source_type, display_order = excluded.display_order, is_active = true, updated_at = now();

update public.crm_target_definitions
set description = 'KasaPOS entegrasyonu tamamlanan firma adedi. Yıl ve çeyrek hedefi girilir; gerçekleşen sayaç Furkan''ın fatura verisi bağlanınca açılacak.',
    updated_at = now()
where code = 'integration_count';
