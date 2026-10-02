-- 20261002_040_aktif_satis_kasasi.sql
-- KASAPOS ENTEGRASYON RAPORU — "aktif satış kasası" (firmanın sahada aktif satış yapan kasa adedi)
--
-- KAYNAK (Taha, 02.10.2026): Müdürün istediği "KasaPOS entegrasyon adet ve tutarları" raporu
--   (PDF 28.09.2026). Kullanım % = faturalanan cihaz ÷ aktif satış kasası; satış fırsatı =
--   aktif satış kasası − faturalanan; potansiyel/ay = fırsat × firmanın son birim fiyatı.
--
-- KARAR: Künyedeki `toplam_pos_adedi` KULLANILMAZ (serbest metin, toplam POS envanteri — aktif
--   satış kasası değil). Ayrı, sayısal, tarihli alan; rapor ekranından satır içi girilir.
--   Faturalanan adet hizmet faturalarından (crm_service_invoice_items) okunur — yeni veri girişi yok.
--
-- Dosya idempotenttir. Veri silmez.

alter table public.musteriler add column if not exists aktif_satis_kasasi integer;
alter table public.musteriler add column if not exists aktif_satis_kasasi_updated_at timestamptz;
alter table public.musteriler add column if not exists aktif_satis_kasasi_updated_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'musteriler_aktif_satis_kasasi_check'
  ) then
    alter table public.musteriler
      add constraint musteriler_aktif_satis_kasasi_check check (aktif_satis_kasasi is null or aktif_satis_kasasi >= 0);
  end if;
end $$;

comment on column public.musteriler.aktif_satis_kasasi is
  'Firmanın sahada aktif satış yapan kasa adedi. KasaPOS Entegrasyon Raporu''nda kullanım % ve satış fırsatının paydası.';
