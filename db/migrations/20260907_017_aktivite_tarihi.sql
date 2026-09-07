-- 20260907_017_aktivite_tarihi.sql
-- Aktiviteye "aktivite tarihi" alanı (Çağdaş Bey'in 07.09 toplantısı, ara yol):
--   * Ekip geçmiş güne aktivite girmek istedi; Çağdaş üç günü tek günde girmeye karşı.
--     Uzlaşı: en fazla 2 gün geriye tarih seçilebilir (API doğrular), ileri tarih yok.
--   * Sayaçlar (haftalık hedef, Canlı Ekran) aktivite tarihine bakar; kayıt zamanı
--     (created_at) korunur → aktivite_tarihi < created_at::date ise "geç girildi".
--   * Mevcut kayıtlar: aktivite_tarihi = created_at'in İstanbul günü (geriye dönük
--     davranış değişmez).
-- Dosya idempotenttir.

alter table public.pipeline_eventleri add column if not exists aktivite_tarihi date;

update public.pipeline_eventleri
set aktivite_tarihi = (created_at at time zone 'Europe/Istanbul')::date
where aktivite_tarihi is null and created_at is not null;

create index if not exists pipeline_eventleri_aktivite_tarihi_idx
  on public.pipeline_eventleri (aktivite_tarihi);

comment on column public.pipeline_eventleri.aktivite_tarihi is
  'Aktivitenin gerçekleştiği gün (İstanbul). created_at kayıt zamanıdır; fark = geç giriş. En fazla 2 gün geriye (API).';
