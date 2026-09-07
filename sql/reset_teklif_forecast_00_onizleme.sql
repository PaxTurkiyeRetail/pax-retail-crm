-- ============================================================================
-- TEKLİF + FORECAST + ENGEL & ETKİ SIFIRLAMA — 0) ÖNİZLEME (salt okunur, hiçbir şey silmez)
-- Çağdaş Bey'in 07.09 kararı: "teklif ve forecast'i baştan, tertemiz girin —
-- AKTİVİTE HARİÇ"; Sinan: Engel & Etki de dahil. Bu dosya ne silineceğini sayar;
-- önce bunu koştur, çıktıyı sakla.
-- Kullanım (sunucu, tahabitim, proje kökü): psql "$DB" -f sql/reset_teklif_forecast_00_onizleme.sql
-- ============================================================================
\echo '--- SİLİNECEKLER ---'
select 'quotes (tüm teklifler)'                          as tablo, count(*) as adet from public.quotes
union all select 'quote_items (teklif satırları)',        count(*) from public.quote_items
union all select 'crm_forecasts (forecast kalemleri)',    count(*) from public.crm_forecasts
union all select 'crm_forecast_blockers (Engel & Etki)',  count(*) from public.crm_forecast_blockers
union all select 'crm_forecast_blocker_history (Engel & Etki geçmişi)', count(*) from public.crm_forecast_blocker_history;

\echo '--- ETKİSİZLEŞTİRİLECEKLER (silinmez; durum Tamamlandı, hedef tarihi kaldırılır) ---'
select 'pipeline_eventleri · quote_sent (Teklif Paylaşıldı otomatik kaydı)' as tablo, count(*) as adet,
       count(*) filter (where durum = 'Başlamadı') as bekleyen
from public.pipeline_eventleri where event_type = 'quote_sent';
\echo '--- Faz durumu değişecek müşteriler (son kaydı teklif olanlar: durum Başlamadı → Tamamlandı, faz numarası aynı) ---'
select m.musteri, mp.aktif_faz_no, mp.durum::text
from public.musteri_pipeline mp
join public.musteriler m on m.id = mp.musteri_id
join lateral (select pe.event_type from public.pipeline_eventleri pe where pe.musteri_id = mp.musteri_id order by pe.created_at desc, pe.id desc limit 1) last on true
where last.event_type = 'quote_sent' and mp.durum::text = 'Başlamadı'
order by m.musteri;

\echo '--- DOKUNULMAYACAKLAR (bilgi) ---'
select 'pipeline_eventleri · tüm aktivite/faz kayıtları (KORUNUR)' as tablo, count(*) as adet
  from public.pipeline_eventleri
union all select 'pipeline_eventleri · engelli işaretli aktivite, is_blocked (KORUNUR)', count(*) from public.pipeline_eventleri where is_blocked
union all select 'quote_products / quote_pricing_rules · katalog (KORUNUR)', count(*) from public.quote_products
union all select 'musteri_pipeline · faz durumları (KORUNUR)', count(*) from public.musteri_pipeline;

\echo '--- TEKLİF ÖZETİ (durum × yıl) ---'
select quote_year, status, coalesce(closed_reason, '-') as closed_reason, count(*) as adet, sum(total_amount)::numeric(14,2) as tutar
from public.quotes group by 1, 2, 3 order by 1, 2, 3;

\echo '--- FORECAST ÖZETİ (yıl × sorumlu) ---'
select forecast_year, owner_name, count(*) as kalem, sum(quantity) as adet
from public.crm_forecasts group by 1, 2 order by 1, 2;

\echo '--- ENGEL & ETKİ ÖZETİ (durum × kategori) ---'
select workflow_status, coalesce(blocker_category, '-') as kategori, count(*) as adet
from public.crm_forecast_blockers group by 1, 2 order by 1, 2;
