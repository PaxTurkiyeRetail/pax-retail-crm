-- 20260910_027_dogrudan_satis_ve_satis_kanali.sql
-- DOĞRUDAN SATIŞ + SATIŞ KANALI — Sinan/Furkan, 10.09.2026.
--
-- İSTEK: "Tekliften satış girilebilir ve direkt satışta eklenebilir olsun" · "Satış Tipi yerine
-- Satış Kanalı kullan".
--
-- KARARLAR (Sinan, 10.09):
--   * Satış kaydı artık teklife bağlı olmak zorunda değil: `quote_id`/`quote_no` NULL olabilir.
--     Teklifsiz kayıtlar `source='direct'`, teklif kazanılınca açılanlar `source='quote'`.
--     `crm_sales_quote_id_key` benzersiz indeksi kalır (NULL'lar birbirinden ayrı sayılır) —
--     bir teklif yine tek satış kaydı üretir, doğrudan satışlar sınırsızdır.
--   * "Satış Tipi" (sale/rental/mixed) DURUYOR: fiyat ve kiralama dönemi ona bağlı. Yeni alan
--     `sales_channel` bağımsız bir kırılım (Banka · Direkt Satış · Kanal) ve Forecast'in
--     kullandığı `forecast_sales_channel` parametre listesinden okunur — ikinci bir kanal
--     listesi ÜRETİLMEZ (tek kaynak kuralı). Serbest metin: liste parametrelerden yönetilir,
--     bu yüzden check constraint yok; boş bırakılabilir (eski kayıtlar).
--   * Yeni yetki `sale.create`: account_manager (kendi müşterisine), admin ve super_admin
--     (kısıtsız). Sahiplik kontrolü API'de: `quote.read.any` yoksa müşteri kendi portföyünde olmalı.
--
-- Ciro tanımı DEĞİŞMEDİ: aktif satışların (`status='active'`) tutarı — doğrudan satışlar da
-- aynı toplama girer (Canlı Ekran, Teklif Raporları).
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Teklifsiz satış: quote_id / quote_no boş olabilir + kaynak işareti
-- ---------------------------------------------------------------------------
alter table public.crm_sales alter column quote_id drop not null;
alter table public.crm_sales alter column quote_no drop not null;

alter table public.crm_sales add column if not exists source text not null default 'quote';
alter table public.crm_sales drop constraint if exists crm_sales_source_check;
alter table public.crm_sales
  add constraint crm_sales_source_check check (source in ('quote', 'direct'));

-- Var olan kayıtların hepsi teklif kaynaklı; yeni sütun varsayılanı zaten 'quote'.
update public.crm_sales set source = 'quote' where source is distinct from 'quote' and quote_id is not null;

-- Teklifsiz satışta teklif bağı olmamalı, teklifli satışta olmalı.
alter table public.crm_sales drop constraint if exists crm_sales_source_quote_check;
alter table public.crm_sales
  add constraint crm_sales_source_quote_check
  check ((source = 'quote' and quote_id is not null) or (source = 'direct' and quote_id is null));

-- ---------------------------------------------------------------------------
-- 2) Satış kanalı (Forecast'teki forecast_sales_channel listesiyle aynı değerler)
-- ---------------------------------------------------------------------------
alter table public.crm_sales add column if not exists sales_channel text;

comment on column public.crm_sales.sales_channel is
  'Satış kanalı: system_parameters.forecast_sales_channel listesinden (Banka · Direkt Satış · Kanal). Satış Tipi (sale/rental/mixed) ayrı bir kavramdır.';
comment on column public.crm_sales.source is
  'quote = kazanılan teklifden türedi · direct = Satışlar ekranından teklifsiz girildi.';

create index if not exists crm_sales_channel_idx on public.crm_sales (sales_channel) where sales_channel is not null;

-- Kanal listesi yoksa (temiz kurulum) Forecast'in listesini kur — varsa dokunma.
insert into public.system_parameters (group_key, param_key, label, value, sort_order)
values
  ('forecast_sales_channel', 'banka', 'Banka', 'Banka', 10),
  ('forecast_sales_channel', 'direkt_satis', 'Direkt Satış', 'Direkt Satis', 20),
  ('forecast_sales_channel', 'kanal', 'Kanal', 'Kanal', 30)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3) Yetki: teklifsiz satış kaydı açma
-- ---------------------------------------------------------------------------
insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('sale.create', 'quote', 'Doğrudan satış kaydı',
   'Satışlar ekranından teklife bağlı olmadan satış kaydı açma. Account manager yalnız kendi portföyündeki firmaya; admin ve super_admin kısıtsız.')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, 'sale.create', true
from (values ('account_manager'), ('admin'), ('super_admin')) r(role_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions p where p.permission_key = 'sale.create')
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();
