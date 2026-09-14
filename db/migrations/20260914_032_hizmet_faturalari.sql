-- 20260914_032_hizmet_faturalari.sql
-- HİZMET FATURALARI — Furkan'ın talebi (11.09 e-postası), Çağdaş Bey onayı, Sinan'ın tarifi (14.09):
--   "Hizmet ve entegrasyon kullanan firmalar için de fatura kesmek üzere kayıt girmek istiyoruz;
--    buna hizmet alanı diyebiliriz. Satış ekranında hizmet için ayrı bir sekme. Girilecekler:
--    hizmet türü, firma, hangi kalemlere fatura kesildiği, tutar (TL ya da USD), ay — geçmişe
--    dair de girilebilsin — ve adet. Her ay kesilmesi zorunlu."
--
-- Gerçek faturalardan (PSX2026000000025 / 232 / 305) görülen kalemler:
--   PAX PERAKENDE KASAPOS ENTEGRASYONU+TMS · PAX PERAKENDE KASAPOS ENTEGRASYONU ·
--   PAX PERAKENDE MAX STORE KULLANIM · PAX PERAKENDE AIRVIEWER KULLANIM
-- Bir faturada aynı kalem mağaza başına 9 kez geçebiliyor → adet zorunlu.
--
-- KARARLAR:
--   * AYRI TABLO, `crm_sales`'e karışmaz. Sebep: hizmet faturası TL de olabilir; USD cinsinden
--     hesaplanan cihaz cirosuna (Canlı Ekran, Teklif Raporları) karışırsa toplam bozulur.
--     Ciro tanımı DEĞİŞMEDİ (kılavuz kural 17). Hizmet cirosu ekranda para birimine göre AYRI
--     toplanır; Canlı Ekran'a taşınması TL→USD kuru kararına bağlı (bekleyen karar).
--   * Kalem listesi `system_parameters` grubu `service_invoice_item` — Liste Yönetimleri'nden
--     yönetilir (yeni hizmet çıkınca kod değişmez). Faturada kalem adı KOPYA olarak saklanır
--     (`service_label`): liste sonradan değişse fatura satırı değişmez.
--   * Dönem = ay (`period_month`, ayın 1'i). Geçmiş aya kayıt girilebilir. Fatura tarihi ve
--     fatura no isteğe bağlı; fatura no aktif kayıtlar arasında benzersiz (aynı numara iki kez
--     girilemez; iptal edilip yeniden girilebilir).
--   * Sahiplik kısıtı YOK: hizmet faturalarını entegrasyon ekibi (Furkan) tüm firmalar için
--     giriyor; `sale.create` yetkisi yeter. Satışçı alanı firmanın sorumlusuyla dolar, değiştirilebilir.
--
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Fatura başlığı
-- ---------------------------------------------------------------------------
create table if not exists public.crm_service_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.musteriler(id) on delete restrict,
  -- Faturanın yazıldığı satışçı (varsayılan: firmanın CRM sorumlusu; değiştirilebilir)
  owner_name text not null,
  owner_user_id text,
  -- Dönem: ayın ilk günü (2026-09-01). Geçmiş ay girilebilir.
  period_month date not null,
  invoice_date date,
  invoice_no text,
  currency text not null default 'TRY',
  amount numeric(14,2) not null default 0,
  status text not null default 'active',
  note text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz not null default now(),
  created_by text,
  created_by_user_id text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint crm_service_invoices_currency_check check (currency in ('TRY', 'USD')),
  constraint crm_service_invoices_amount_check check (amount >= 0),
  constraint crm_service_invoices_status_check check (status in ('active', 'cancelled')),
  constraint crm_service_invoices_period_check check (period_month = date_trunc('month', period_month)::date)
);

create index if not exists crm_service_invoices_customer_idx on public.crm_service_invoices (customer_id);
create index if not exists crm_service_invoices_period_idx on public.crm_service_invoices (period_month);
create index if not exists crm_service_invoices_owner_idx on public.crm_service_invoices (owner_name);
create index if not exists crm_service_invoices_status_idx on public.crm_service_invoices (status);
-- Aynı fatura numarası aktif kayıtlar arasında bir kez (iptal edilip yeniden girilebilir).
create unique index if not exists crm_service_invoices_no_active_uniq
  on public.crm_service_invoices (upper(trim(invoice_no)))
  where invoice_no is not null and status = 'active';

comment on table public.crm_service_invoices is
  'Aylık hizmet / entegrasyon faturaları (KasaPOS entegrasyonu, TMS, Max Store, AirViewer…). Cihaz satışlarından (crm_sales) AYRI; TL ya da USD. Ciro tanımına girmez.';
comment on column public.crm_service_invoices.period_month is
  'Fatura dönemi — ayın ilk günü. "Her ay kesilmesi zorunlu": eksik ay kontrolü bu alandan yapılır.';

drop trigger if exists crm_service_invoices_touch_updated_at on public.crm_service_invoices;
create trigger crm_service_invoices_touch_updated_at
  before update on public.crm_service_invoices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Fatura kalemleri (hizmet × adet × birim fiyat)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_service_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.crm_service_invoices(id) on delete cascade,
  line_no integer not null default 1,
  -- system_parameters.service_invoice_item.value (ör. 'KasaPOS Entegrasyonu + TMS')
  service_key text not null,
  -- Kalem adının fatura anındaki kopyası
  service_label text not null,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null default 0,
  total_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint crm_service_invoice_items_qty_check check (quantity > 0),
  constraint crm_service_invoice_items_price_check check (unit_price >= 0 and total_price >= 0)
);

create index if not exists crm_service_invoice_items_invoice_idx on public.crm_service_invoice_items (invoice_id);
create index if not exists crm_service_invoice_items_key_idx on public.crm_service_invoice_items (service_key);

comment on table public.crm_service_invoice_items is
  'Hizmet faturası satırları: hangi hizmetten kaç adet, birim fiyat, toplam. Kalem listesi Liste Yönetimleri › Hizmet Kalemleri.';

-- ---------------------------------------------------------------------------
-- 3) Hizmet kalemi listesi (Liste Yönetimleri'nden yönetilir)
-- ---------------------------------------------------------------------------
insert into public.system_parameters (group_key, param_key, label, value, sort_order)
values
  ('service_invoice_item', 'kasapos_entegrasyonu_tms', 'KasaPOS Entegrasyonu + TMS', 'KasaPOS Entegrasyonu + TMS', 10),
  ('service_invoice_item', 'kasapos_entegrasyonu',     'KasaPOS Entegrasyonu',       'KasaPOS Entegrasyonu',       20),
  ('service_invoice_item', 'max_store_kullanim',       'Max Store Kullanım',          'Max Store Kullanim',         30),
  ('service_invoice_item', 'airviewer_kullanim',       'AirViewer Kullanım',          'AirViewer Kullanim',         40)
on conflict (group_key, param_key) do nothing;
