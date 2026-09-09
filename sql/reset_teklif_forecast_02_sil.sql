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
--
-- ⚠️ İKİNCİ ÇALIŞTIRMA KORUMASI (09.09.2026, gerçek veri kaybından sonra eklendi):
--    Betik her çalışmasını public.crm_reset_log'a yazar. Bir sonraki çalışmada,
--    son çalışmadan SONRA girilmiş teklif/forecast/engel kaydı varsa DURUR ve
--    hiçbir şey silmez. Bilerek yine silinecekse: -v TEKRAR=EVET
--    (Olay: 07.09'da istenen sıfırlama yapıldı; ekip aynı akşam 19 forecast girdi;
--     betik 08.09'da ikinci kez çalıştırılınca o 19 kaydı uyarmadan sildi.)
-- ============================================================================

-- TEKRAR değişkeni komut satırından gelmediyse boş kabul edilir.
\if :{?TEKRAR}
\else
\set TEKRAR ''
\endif

begin;

-- TEKRAR değeri dollar-quote içine değişken olarak geçmez (psql orada genişletme yapmaz);
-- oturum ayarına yazıp plpgsql içinde current_setting ile okuyoruz.
set local reset.tekrar = :'TEKRAR';

-- 0) KORUMA: daha önce çalıştıysa ve arada yeni kayıt girilmişse dur.
do $guard$
declare
  v_last  timestamptz;
  v_fresh bigint := 0;
  v_onay  text := upper(coalesce(current_setting('reset.tekrar', true), ''));
begin
  if to_regclass('public.crm_reset_log') is null then
    raise notice 'crm_reset_log tablosu yok (migration 024 uygulanmamış) — ikinci çalıştırma koruması DEVRE DIŞI.';
    return;
  end if;

  select max(ran_at) into v_last from public.crm_reset_log;
  if v_last is null then
    raise notice 'İlk sıfırlama çalışması — koruma kontrolü atlandı.';
    return;
  end if;

  select count(*) into v_fresh from (
    select created_at from public.quotes                 where created_at > v_last
    union all select created_at from public.crm_forecasts        where created_at > v_last
    union all select created_at from public.crm_forecast_blockers where created_at > v_last
  ) t;

  if v_fresh > 0 and v_onay <> 'EVET' then
    raise exception using
      message = format('DURDURULDU — hiçbir şey silinmedi. Sıfırlama en son %s tarihinde çalıştı ve o tarihten SONRA %s yeni kayıt girilmiş (teklif/forecast/engel).', to_char(v_last, 'DD.MM.YYYY HH24:MI'), v_fresh),
      hint    = 'Bu kayıtlar ekibin temiz girişleri olabilir — önce kontrol et. Bilerek silinecekse: psql "$DB" -v ON_ERROR_STOP=1 -v TEKRAR=EVET -f sql/reset_teklif_forecast_02_sil.sql';
  end if;

  if v_fresh > 0 then
    raise notice 'UYARI: son çalışmadan sonra girilmiş % kayıt TEKRAR=EVET ile silinecek.', v_fresh;
  end if;
end
$guard$;

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

-- 6) Çalışma kaydı (sonraki çalışmanın koruması buna bakar).
--    Tablo yoksa (024 uygulanmamışsa) betik yine de tamamlanmalı → dinamik SQL,
--    çünkü doğrudan yazılan INSERT tablo yokken ayrıştırma aşamasında hata verir.
do $log$
begin
  if to_regclass('public.crm_reset_log') is null then
    raise notice 'crm_reset_log yok — çalışma kaydı YAZILAMADI (migration 024 uygulanmalı).';
    return;
  end if;
  execute $q$
    insert into public.crm_reset_log (ran_by, deleted, note)
    select current_user,
           coalesce((select jsonb_object_agg(adim, adet) from _reset_log), '{}'::jsonb),
           case when upper(coalesce(current_setting('reset.tekrar', true), '')) = 'EVET'
                then 'TEKRAR=EVET ile çalıştırıldı' else null end
  $q$;
end
$log$;

commit;
\echo 'Tamam: teklif + forecast + Engel & Etki sıfırlandı. Teklif numarası Q-<yıl>-001 den başlar.'
\echo 'Çalışma crm_reset_log tablosuna yazıldı; bir sonraki çalıştırmada arada girilen kayıt varsa betik duracak.'
