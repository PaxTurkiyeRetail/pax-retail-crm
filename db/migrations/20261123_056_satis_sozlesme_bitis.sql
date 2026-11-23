-- 20261123_056_satis_sozlesme_bitis.sql
-- SÖZLEŞME BİTİŞİ (23.11.2026)
--
-- İSTEK: "Sözleşme bitiş tarihi olmadan her ay devam ediyor; başlangıcı belirlenip bitiş tarihine kadar devam edebilmeli."
--   * Sözleşme süresiz: fatura başlangıcından contract_ended_on'a ("Sözleşmeyi Bitir") kadar her ay devam eder.
--   * contract_ended_on boşsa sözleşme devam ediyor.
--   * crm_sales_billing_v.contract_end_date artık süre hesabı değil, girilen bitiş tarihidir.
--
-- Dosya idempotenttir. Veri silmez/güncellemez.

alter table public.crm_sales add column if not exists contract_ended_on date;
comment on column public.crm_sales.contract_ended_on is
  'Sözleşme bitiş tarihi (056). Boşsa sözleşme devam ediyor; raporda bitiş ayına kadar sayılır.';

create or replace view public.crm_sales_billing_v as
select
  s.id as sale_id,
  s.customer_id,
  m.musteri,
  s.quote_id,
  s.quote_no,
  s.source,
  s.owner_user_id,
  s.owner_name,
  s.sales_channel,
  s.sale_type,
  s.sale_date,
  s.billing_start_date,
  coalesce(s.billing_start_date, s.sale_date) as effective_billing_date,
  case when s.billing_start_date is null then 'satis_tarihi' else 'fatura_baslangic' end as billing_date_source,
  s.contract_no,
  s.contract_months,
  s.contract_ended_on as contract_end_date,
  s.rental_start_date,
  s.rental_end_date,
  s.device_count,
  s.amount,
  s.hardware_amount,
  s.rental_monthly_amount,
  s.rental_ops_status
from public.crm_sales s
left join public.musteriler m on m.id = s.customer_id
where s.status = 'active';
