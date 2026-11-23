-- 20261123_054_satis_sozlesme_fatura_baslangic.sql
-- SATIŞ SÖZLEŞMESİ + FATURA BAŞLANGIÇ TARİHİ (23.11.2026)
--
-- İSTEK: "Satış Ekle (teklifsiz) kısmında sözleşme ... Fatura Başlangıç Tarihi olması gerekli;
-- başlayacakları başka raporda çekeceğiz: fatura başlangıç tarihi varsa al, yoksa satış tarihi."
--
-- KARARLAR:
--   * Sözleşme = satış kaydının kendisi (030/045: aynı gün + aynı firma tek satış = tek sözleşme).
--     Ayrı tablo açılmaz; crm_sales'e üç opsiyonel alan eklenir.
--       billing_start_date  Fatura başlangıç tarihi (tüm satış tiplerinde, opsiyonel)
--       contract_no         Sözleşme no (opsiyonel)
--       contract_months     Sözleşme süresi, ay (opsiyonel)
--   * Kira başlangıcı (rental_start_date) ile fatura başlangıcı ayrı kavram: kurulum sonrası
--     fatura başlayabilir. Mevcut alanlara dokunulmaz.
--   * Rapor tek kaynaktan okur: crm_sales_billing_v.
--       effective_billing_date = coalesce(billing_start_date, sale_date)
--       billing_date_source    = 'fatura_baslangic' | 'satis_tarihi'
--     Yalnız aktif satışlar (ciro tanımıyla aynı).
--   * Eski kayıtlar güncellenmez; boş kalır, rapor satış tarihine düşer.
--
-- Dosya idempotenttir. Veri silmez/güncellemez.

alter table public.crm_sales add column if not exists billing_start_date date;
alter table public.crm_sales add column if not exists contract_no text;
alter table public.crm_sales add column if not exists contract_months integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_sales_contract_months_check') then
    alter table public.crm_sales add constraint crm_sales_contract_months_check
      check (contract_months is null or (contract_months between 1 and 240));
  end if;
end $$;

comment on column public.crm_sales.billing_start_date is
  'Fatura başlangıç tarihi (054). Boşsa raporlar satış tarihini kullanır: crm_sales_billing_v.effective_billing_date.';
comment on column public.crm_sales.contract_no is 'Sözleşme numarası (054), opsiyonel.';
comment on column public.crm_sales.contract_months is 'Sözleşme süresi ay (054), opsiyonel. Bitiş = fatura başlangıcı + süre.';

-- Sözleşme süresiz: bitiş tarihi girilene ("Sözleşmeyi Bitir") kadar her ay devam eder.
alter table public.crm_sales add column if not exists contract_ended_on date;
comment on column public.crm_sales.contract_ended_on is
  'Sözleşme bitiş tarihi (054). Boşsa sözleşme devam ediyor; raporda bitiş ayına kadar sayılır.';

create index if not exists crm_sales_billing_start_idx
  on public.crm_sales (billing_start_date) where billing_start_date is not null;

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

comment on view public.crm_sales_billing_v is
  'Faturalama raporu kaynağı (054): effective_billing_date = coalesce(billing_start_date, sale_date). Yalnız aktif satışlar.';
