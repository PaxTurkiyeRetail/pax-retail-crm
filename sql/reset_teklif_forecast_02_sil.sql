-- ============================================================================
-- TEKLİF + FORECAST + ENGEL & ETKİ SIFIRLAMA — 2) SİLME (tek transaction; hata olursa hiçbir şey silinmez)
-- Çağdaş Bey 07.09: "teklif ve forecast'i baştan, tertemiz girin — AKTİVİTE HARİÇ";
-- Sinan 07.09: Engel & Etki de sıfırlansın.
-- ÖNCE 00 (önizleme) ve 01 (yedek) koşmuş olmalı.
--
-- Silinen:   quotes, quote_items, crm_forecasts, crm_forecast_blockers (+ history)
-- Etkisiz:   pipeline_eventleri(event_type='quote_sent') → Tamamlandı + hedef tarihi yok (faz korunur)
-- Korunan:   gerçek aktiviteler (is_blocked işaretleri dahil), faz durumları (musteri_pipeline),
--            teklif kataloğu, müşteri/künye, hedefler, talepler.
-- Sonrası:   teklif numarası yıl içinde 1'den başlar (Q-2026-001), Canlı Ekran ciro/YTD
--            kazanılan teklif girilene kadar 0 görünür.
-- Kullanım (proje kökü): psql "$DB" -v ON_ERROR_STOP=1 -f sql/reset_teklif_forecast_02_sil.sql
-- ============================================================================
begin;

create temp table _reset_log (adim text, adet bigint) on commit drop;

-- 1) "Teklif Paylaşıldı" otomatik kayıtları (event_type = 'quote_sent')
--    SİLİNMEZ, etkisizleştirilir. Neden: pipeline_eventleri üzerindeki
--    trg_sync_musteri_pipeline tetikleyicisi müşterinin fazını SON kayıttan türetir;
--    bu kayıtlar silinirse tek kaydı teklif olan müşteri "Fazsız"a düşer, son kaydı
--    teklif olan müşteri önceki faza geri gider (bulut kopyasında denendi: SÜVARİ
--    faz 10 → fazsız). Çağdaş Bey "aktivite hariç" dedi → faz geçmişi korunur.
--    Yapılan: durum 'Tamamlandı', hedef tarihi kaldırılır (Canlı Ekran'da "Quote Q-…
--    paylaşıldı" diye bekleyen next action görünmesin), nota sıfırlama damgası eklenir.
with u as (
  update public.pipeline_eventleri
  set durum = 'Tamamlandı',
      hedef_tarihi = null,
      notlar = '[07.09 sıfırlama — eski teklif kaydı] ' || coalesce(notlar, ''),
      updated_at = now()
  where event_type = 'quote_sent'
    and notlar not like '[07.09 sıfırlama%'
  returning 1
) insert into _reset_log select 'pipeline_eventleri · quote_sent (etkisizleştirildi, silinmedi)', count(*) from u;

-- 2) Teklif satırları (quote_items FK cascade'li ama sayım için açıkça)
with d as (delete from public.quote_items returning 1)
insert into _reset_log select 'quote_items', count(*) from d;

-- 3) Teklifler
with d as (delete from public.quotes returning 1)
insert into _reset_log select 'quotes', count(*) from d;

-- 4) Engel & Etki (Forecast ekranındaki engel kayıtları). Tetikleyici
--    crm_forecast_blockers_history silme anında geçmişe satır yazar → önce
--    engeller, sonra geçmiş tablosu temizlenir.
with d as (delete from public.crm_forecast_blockers returning 1)
insert into _reset_log select 'crm_forecast_blockers (Engel & Etki)', count(*) from d;
with d as (delete from public.crm_forecast_blocker_history returning 1)
insert into _reset_log select 'crm_forecast_blocker_history', count(*) from d;

-- 5) Forecast kalemleri
with d as (delete from public.crm_forecasts returning 1)
insert into _reset_log select 'crm_forecasts', count(*) from d;

\echo '--- SİLİNEN ---'
select * from _reset_log;

\echo '--- KONTROL (hepsi 0 olmalı) ---'
select 'quotes' as tablo, count(*) as kalan from public.quotes
union all select 'quote_items', count(*) from public.quote_items
union all select 'pipeline_eventleri · quote_sent bekleyen (Başlamadı)', count(*) from public.pipeline_eventleri where event_type = 'quote_sent' and durum = 'Başlamadı'
union all select 'crm_forecasts', count(*) from public.crm_forecasts
union all select 'crm_forecast_blockers', count(*) from public.crm_forecast_blockers
union all select 'crm_forecast_blocker_history', count(*) from public.crm_forecast_blocker_history;

\echo '--- KORUNAN (bilgi) ---'
select 'pipeline_eventleri · aktivite/faz kayıtları' as tablo, count(*) as adet from public.pipeline_eventleri
union all select 'pipeline_eventleri · engelli işaretli aktivite (is_blocked)', count(*) from public.pipeline_eventleri where is_blocked
union all select 'musteri_pipeline', count(*) from public.musteri_pipeline
union all select 'quote_products (katalog)', count(*) from public.quote_products;

commit;
\echo 'Tamam: teklif + forecast + Engel & Etki sıfırlandı. Teklif numarası Q-<yıl>-001 den başlar.'
