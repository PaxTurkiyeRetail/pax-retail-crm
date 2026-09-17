-- 20260917_038_entegrasyon_hedefi_cihaz_adedi.sql
-- ENTEGRASYON HEDEFİ — birim CİHAZ ADEDİ, gerçekleşen hizmet faturası kalemlerinden
--
-- KAYNAK (Sinan, 17.09.2026, Canlı Ekran ekran görüntüsüyle): "Entegrasyon büyük simit için AYLIK
--   sayı gelmeli, sağ üst köşesine year-to-date entegrasyon toplamını koyabilirsin; 10 sayısı burada
--   dolayısıyla doğru değil; attığım Excel'deki eski verileri de girelim."
--   Seçim (soruldu): birim = Excel'deki ADET sütunu = crm_service_invoice_items.quantity (cihaz).
--   2.000/yıl · Q3 500 hedefi bu birime uyar; firma sayısına uymaz. Çağdaş Bey'in 11.09'daki
--   "entegrasyon adedi Furkan'ın fatura kalemlerinden sayılsın" isteği de bu — o gün veri yoktu,
--   16.09'da Nebim Excel'i (55 fatura, Ocak–Eylül 2026) içe aktarıldı; yeni veri girişi GEREKMEDİ.
--
-- Bu dosya yalnız hedef tanımının AÇIKLAMASINI günceller (Hedefler ekranı). Veri değişmez, tablo
-- değişmez. Sayaç kodda: lib/reports/live-board.ts → Q_INTEGRATION_DEVICES (yıl / çeyrek / ay,
-- firmanın KÜNYE sorumlusuna — 16.09 sahiplik kararı korunur). İdempotenttir.
--
-- NOT: Firma bazlı faz sayacı (crm_entegrasyon_durumu, migration 037) kalkmadı — Entegrasyon
-- Raporu "kaç firma Rollout / Entegrasyon Süreci Tamamlandı" sorusunu onunla yanıtlar; bu hedef
-- "kaç cihaz faturalandı" sorusunu yanıtlar. İki ayrı ölçüt, ikisi de tek yerden okunur.

update public.crm_target_definitions
set name = 'Entegrasyon (cihaz adedi)',
    description = 'KasaPOS entegrasyonu faturalanan CİHAZ adedi — aktif hizmet faturası kalemlerinin adedi (crm_service_invoice_items.quantity), faturanın dönemine (period_month) göre yıl / çeyrek / ay; firmanın künye sorumlusuna yazılır. Yıl ve çeyrek hedefi girilir; aylık hedef çeyrek ÷ 3 (yoksa yıl ÷ 12) olarak türetilir.',
    updated_at = now()
where code = 'integration_count';
