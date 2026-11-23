-- 20261123_057_hizmet_faturasi_sozlesme.sql
-- HİZMET FATURASI SÖZLEŞME TARİHLERİ (23.11.2026)
--
-- İSTEK: Sözleşme / Faturalama raporu KasaPOS Adet & Tutar ile aynı kaynaktan (Hizmet Faturaları,
-- /crm/sales?tab=hizmet) ve girilen sözleşme tarihiyle gelmeli. Satışa eklenen alanlar (054/056)
-- artık kullanılmıyor; canlıda veri olduğu için kolonlar silinmez.
--
--   contract_start_date  Sözleşme başlangıcı. Boşsa raporda fatura dönemi (period_month) kullanılır.
--   contract_end_date    Sözleşme bitişi ("Bitir"). Boşsa sözleşme her ay devam eder.
--
-- Dosya idempotenttir. Veri silmez/güncellemez.

alter table public.crm_service_invoices add column if not exists contract_start_date date;
alter table public.crm_service_invoices add column if not exists contract_end_date date;

comment on column public.crm_service_invoices.contract_start_date is
  'Sözleşme başlangıcı (057). Boşsa raporda dönem ayı kullanılır.';
comment on column public.crm_service_invoices.contract_end_date is
  'Sözleşme bitişi (057). Boşsa sözleşme bitene kadar her ay devam eder.';
