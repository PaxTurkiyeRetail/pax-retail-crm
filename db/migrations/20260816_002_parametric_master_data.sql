-- CRM ana verisi ve müşteri iş akışı politikalarını kişi/sektör metninden ayırır.
-- Uygulama sürümüyle birlikte, önce staging üzerinde çalıştırılmalıdır.

alter table public.system_parameters
  add column if not exists version integer not null default 1,
  add column if not exists updated_by_user_id uuid null;

alter table public.allowed_users
  add column if not exists weekly_target_sales_physical integer not null default 0,
  add column if not exists weekly_target_sales_online integer not null default 0,
  add column if not exists weekly_target_sales_phone integer not null default 0,
  add column if not exists weekly_target_sales_email integer not null default 0,
  add column if not exists weekly_target_technical_physical integer not null default 0,
  add column if not exists weekly_target_technical_online integer not null default 0,
  add column if not exists weekly_target_total_activities integer not null default 0,
  add column if not exists weekly_target_unique_customers integer not null default 0;

create table if not exists public.is_ortagi_faz_tanimlari (
  id uuid primary key default gen_random_uuid(),
  faz_no integer not null unique,
  asama_adi text not null,
  owner text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_is_ortagi_faz_tanimlari_active_sort
  on public.is_ortagi_faz_tanimlari(is_active, sort_order, faz_no);

insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('customer.classification.manage','customer','Müşteri sınıflandırma yönetimi','Müşteri tipi ve pipeline politikasını yönetme'),
  ('forecast.read.any','forecast','Tüm forecast kayıtlarını görüntüleme','Şirket genelindeki forecast kayıtlarını görüntüleme'),
  ('report.read.own','report','Kendi raporlarını görüntüleme','Yalnız kullanıcı kapsamındaki raporları görüntüleme'),
  ('report.read.team','report','Ekip raporlarını görüntüleme','Kullanıcının ekip kapsamındaki raporları görüntüleme'),
  ('report.read.all','report','Tüm raporları görüntüleme','Şirket geneli raporları görüntüleme')
on conflict (permission_key) do update
set module_key = excluded.module_key,
    label = excluded.label,
    description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key)
values
  ('super_admin','customer.classification.manage'),
  ('admin','customer.classification.manage'),
  ('super_admin','report.read.all'),
  ('admin','report.read.all'),
  ('account_manager','report.read.all'),
  ('itsm','report.read.all')
on conflict do nothing;

alter table public.musteriler
  add column if not exists customer_type text not null default 'standard',
  add column if not exists pipeline_policy text not null default 'phase_required',
  add column if not exists integration_type_key text null;

comment on column public.musteriler.customer_type is
  'Parametrik crm_customer_type kataloğundaki kanonik müşteri tipi.';
comment on column public.musteriler.pipeline_policy is
  'Parametrik crm_pipeline_policy kataloğundaki kanonik faz/aktivite politikası.';
comment on column public.musteriler.integration_type_key is
  'Parametrik crm_integration_type kataloğundaki kanonik entegrasyon kodu; eski enum alanı geriye uyumluluk içindir.';

update public.musteriler
set integration_type_key = entegrasyon_tipi::text
where integration_type_key is null
  and entegrasyon_tipi is not null;

-- Bu yalnızca tek seferlik veri taşımasıdır. Uygulama çalışma zamanında sektör
-- veya kişi adına bakarak müşteri tipi üretmez.
update public.musteriler
set customer_type = 'business_partner'
where customer_type = 'standard'
  and upper(trim(coalesce(sektor, ''))) in ('İŞ ORTAĞI', 'IS ORTAGI');

create index if not exists idx_musteriler_customer_type
  on public.musteriler(customer_type);
create index if not exists idx_musteriler_pipeline_policy
  on public.musteriler(pipeline_policy);
create index if not exists idx_musteriler_integration_type_key
  on public.musteriler(integration_type_key);

insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('crm_sector','elektronik_beyaz_esya','Elektronik & Beyaz Eşya','Elektronik & Beyaz Eşya',10,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','ev_yasam_yapi_market','Ev & Yaşam / Yapı Market','Ev & Yaşam / Yapı Market',20,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','fmcg_dagitim','FMCG Dağıtım Kanalları','FMCG Dağıtım Kanalları',30,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','gida_perakendesi','Gıda Perakendesi','Gıda Perakendesi',40,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','hazir_giyim','Hazır Giyim','Hazır Giyim',50,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','lojistik_kargo','Lojistik & Kargo','Lojistik & Kargo',60,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','yeme_icme','Yeme-İçme','Yeme-İçme',70,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','banka','BANKA','BANKA',80,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','vertical','VERTICAL','VERTICAL',90,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sector','is_ortagi','İŞ ORTAĞI','İŞ ORTAĞI',100,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_integration_type','a2a','A2A','A2A',10,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_integration_type','d2d','D2D','D2D',20,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_integration_type','d2d_a2a','D2D+A2A','D2D+A2A',30,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sales_probability','dusuk','Düşük','Düşük',10,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sales_probability','orta','Orta','Orta',20,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_sales_probability','yuksek','Yüksek','Yüksek',30,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('crm_customer_type','standard','Standart Müşteri','standard',10,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('crm_customer_type','business_partner','İş Ortağı','business_partner',20,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('crm_pipeline_policy','phase_required','Faz Zorunlu','phase_required',10,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('crm_pipeline_policy','phase_optional','Yalnız Aktivite / Fazsız','phase_optional',20,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('quote_probability','10','%10','10',10,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('quote_probability','30','%30','30',20,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('quote_probability','60','%60','60',30,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('quote_probability','90','%90','90',40,true,'{"source":"migration","kind":"policy"}'::jsonb)
  ,('activity_waiting_party','musteri','Müşteri','Müşteri',10,true,'{"source":"migration","kind":"policy"}'::jsonb)
  ,('activity_waiting_party','musteri_it','Müşteri IT','Müşteri IT',20,true,'{"source":"migration","kind":"policy"}'::jsonb)
  ,('activity_waiting_party','finance_owner','Müşteri (Finance Owner)','Müşteri (Finance Owner)',30,true,'{"source":"migration","kind":"policy"}'::jsonb)
  ,('activity_waiting_party','pax_rs_support','PAX RS(Support)','PAX RS(Support)',40,true,'{"source":"migration","kind":"policy"}'::jsonb)
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('forecast_sales_channel','banka','Banka','Banka',10,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('forecast_sales_channel','direkt_satis','Direkt Satış','Direkt Satis',20,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('forecast_sales_channel','kanal','Kanal','Kanal',30,true,'{"source":"migration","kind":"master_data"}'::jsonb),
  ('forecast_probability','30','%30','30',10,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('forecast_probability','60','%60','60',20,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('forecast_probability','90','%90','90',30,true,'{"source":"migration","kind":"policy"}'::jsonb),
  ('system_oidc_enabled','aktif','Aktif','false',10,true,'{"source":"migration","kind":"identity","failure_mode":"closed","activation":"requires_it_approval"}'::jsonb),
  ('system_oidc_group_role_sync_enabled','aktif','Aktif','false',10,true,'{"source":"migration","kind":"identity","failure_mode":"closed","activation":"requires_mapping_validation"}'::jsonb),
  ('system_jira_enabled','aktif','Aktif','true',10,true,'{"source":"migration","kind":"integration","failure_mode":"closed"}'::jsonb),
  ('system_jira_weekly_pptx_enabled','aktif','Aktif','true',10,true,'{"source":"migration","kind":"integration","failure_mode":"closed"}'::jsonb),
  ('system_jira_debug_enabled','aktif','Aktif','false',10,true,'{"source":"migration","kind":"platform","failure_mode":"closed"}'::jsonb),
  ('system_pptx_download_enabled','aktif','Aktif','true',10,true,'{"source":"migration","kind":"platform","failure_mode":"closed"}'::jsonb),
  ('system_page_size','25','25','25',10,true,'{"source":"migration","kind":"platform","failure_mode":"safe_default"}'::jsonb)
on conflict (group_key, param_key) do nothing;

-- Eski paralel grup adlarını yeni tek doğruluk kaynağına taşı.
insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
select case group_key
         when 'integration_type' then 'crm_integration_type'
         when 'sales_probability' then 'crm_sales_probability'
       end,
       param_key, label, value, sort_order, is_active,
       coalesce(meta, '{}'::jsonb) || '{"source":"legacy_group_migration"}'::jsonb
from public.system_parameters
where group_key in ('integration_type','sales_probability')
on conflict (group_key, param_key) do nothing;

update public.system_parameters
set is_active = false,
    version = version + 1,
    updated_at = now()
where group_key in ('integration_type','sales_probability')
  and is_active = true;

-- Mevcut özel değerleri kaybetmeden kataloğa al. Bundan sonra yeni değerler
-- yalnız Parametre Yönetimi üzerinden açılabilir.
insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
select 'crm_sector', 'legacy_' || substr(md5(trim(sektor)), 1, 16), trim(sektor), trim(sektor), 900, true,
       '{"source":"legacy_backfill","kind":"master_data"}'::jsonb
from public.musteriler
where nullif(trim(sektor), '') is not null
group by trim(sektor)
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
select 'crm_integration_type', 'legacy_' || substr(md5(trim(coalesce(integration_type_key, entegrasyon_tipi::text))), 1, 16),
       trim(coalesce(integration_type_key, entegrasyon_tipi::text)), trim(coalesce(integration_type_key, entegrasyon_tipi::text)), 900, true,
       '{"source":"legacy_backfill","kind":"master_data"}'::jsonb
from public.musteriler
where nullif(trim(coalesce(integration_type_key, entegrasyon_tipi::text)), '') is not null
group by trim(coalesce(integration_type_key, entegrasyon_tipi::text))
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
select 'crm_sales_probability', 'legacy_' || substr(md5(trim(satis_olasiligi::text)), 1, 16),
       trim(satis_olasiligi::text), trim(satis_olasiligi::text), 900, true,
       '{"source":"legacy_backfill","kind":"master_data"}'::jsonb
from public.musteriler
where nullif(trim(satis_olasiligi::text), '') is not null
group by trim(satis_olasiligi::text)
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters(group_key, param_key, label, value, sort_order, is_active, meta)
select 'quote_probability', 'legacy_' || probability::text, '%' || probability::text, probability::text, 900, true,
       '{"source":"legacy_backfill","kind":"policy"}'::jsonb
from public.quotes
where probability is not null
group by probability
on conflict (group_key, param_key) do nothing;
