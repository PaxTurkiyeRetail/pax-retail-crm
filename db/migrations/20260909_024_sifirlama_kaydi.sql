-- 20260909_024_sifirlama_kaydi.sql
-- SIFIRLAMA ÇALIŞMA KAYDI (09.09.2026 olayının kalıcı önlemi).
--
-- OLAY: sql/reset_teklif_forecast_02_sil.sql 07.09 akşamı çalıştı (istenen sıfırlama:
-- 60 teklif + 47 forecast silindi). Ekip aynı akşam temiz girişe başladı (Ömer 14,
-- Cem 5 = 19 forecast). Betik 08.09 09:43'te İKİNCİ kez çalıştırıldı ve bu 19 taze
-- kaydı uyarmadan sildi. Kayıtlar 01_yedek.sh'ın aldığı CSV'den geri yüklendi.
--
-- ÖNLEM: betik artık her çalışmasını buraya yazar; sonraki çalışmada "son çalışmadan
-- sonra girilmiş kayıt" varsa DURUR (yalnız -v TEKRAR=EVET ile geçilir).
-- Tablo yoksa betik korumayı atlar (to_regclass kontrolü), yani bu migration
-- uygulanmadan da çalışır — ama koruma devreye girmez.

create table if not exists public.crm_reset_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  ran_by text,
  -- {"quotes": 60, "crm_forecasts": 47, ...} — silinen satır sayıları
  deleted jsonb not null default '{}'::jsonb,
  note text
);

create index if not exists idx_crm_reset_log_ran_at on public.crm_reset_log (ran_at desc);

comment on table public.crm_reset_log is
  'Teklif/Forecast sıfırlama betiğinin çalışma kaydı. 02_sil.sql her çalışmada satır ekler; bir sonraki çalışmada taze kayıt kontrolü bu tabloya bakar.';

-- Geçmiş çalışmalar (yedek dosyalarından tespit edildi; koruma bugünden itibaren
-- doğru çalışsın diye geriye dönük işlendi).
insert into public.crm_reset_log (ran_at, ran_by, deleted, note)
select '2026-09-07 16:55:00+03'::timestamptz, 'tahabitim', '{"quotes": 60, "crm_forecasts": 47}'::jsonb,
       '1. çalışma (istenen sıfırlama) — yedek: backups/reset-20260907-165253'
where not exists (select 1 from public.crm_reset_log);

insert into public.crm_reset_log (ran_at, ran_by, deleted, note)
select '2026-09-08 09:43:30+03'::timestamptz, 'tahabitim', '{"quotes": 0, "crm_forecasts": 19}'::jsonb,
       '2. çalışma (KAZA) — ekibin 19 taze forecast kaydını sildi; CSV''den geri yüklendi'
where not exists (select 1 from public.crm_reset_log where ran_at > '2026-09-08'::timestamptz);
