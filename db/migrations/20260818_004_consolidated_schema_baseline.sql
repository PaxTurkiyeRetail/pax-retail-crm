-- =====================================================================
-- 20260818_004_consolidated_schema_baseline.sql
-- PAX CRM - Konsolide, idempotent şema temeli (baseline).
--
-- Bu dosya db/ ve sql/ altındaki tüm SQL dosyalarının (38 dosya) taranmasıyla
-- üretildi. Amaç: tüm CRM public şema nesnelerini (tablo, view, fonksiyon,
-- trigger, index, RLS policy, seed data) TEK idempotent dosyada toplamak.
--
-- GÜVENLİK KURALLARI (ZORUNLU):
--   - Sadece additive/idempotent DDL: IF NOT EXISTS, CREATE OR REPLACE,
--     guarded DO $$ bloklar.
--   - DROP TABLE / DROP COLUMN / TRUNCATE / DELETE FROM YOK.
--   - Bu dosya tekrar tekrar çalıştırılabilir (checksum ile bir kere
--     migrate.mjs tarafından işaretlenir).
--
-- KAYNAK ÇÖZÜMLEMESİ / ÇAKIŞMALAR (özet, detay rapor metninde):
--   1) db/baseline/crm_local_schema_baseline.sql (pg_dump) EN GÜNCEL/otorite
--      kaynak olarak alındı; diğer sql/*.sql dosyaları ile çakıştığında
--      baseline kazandı (örn. musteri_kunye_v2 tabanlı v_musteri_kunye_form/
--      v_musteri_kunye_status kazandı; musteri_kunye v1 tabanlı eski
--      vw_musteri_kunye_form/vw_musteri_kunye_durum HARİÇ TUTULDU).
--   2) sql/crm_minimal_targets_verify.sql, eski RBAC/hedef alt sistemine ait
--      14 tabloyu (crm_permissions, crm_roles, crm_role_permissions,
--      crm_user_roles, crm_user_permission_overrides, crm_targets,
--      crm_target_metrics, crm_target_revisions, crm_performance_snapshots,
--      crm_teams, crm_team_members, crm_tv_devices, crm_audit_logs,
--      faz_hareketleri) "olmamalı" diye doğruluyor; ama baseline dump bu
--      tabloları hâlâ içeriyor. Veri kaybı YASAK olduğu için bu tablolar
--      CREATE TABLE IF NOT EXISTS ile korundu (var olan ortamlar bozulmaz),
--      fakat CANLI RBAC/hedef modeli artık rbac_roles/rbac_permissions/
--      rbac_role_permissions (20260816_001) ve crm_target_definitions/
--      crm_target_values (crm_minimal_targets_v1.sql) tabanlıdır — bu
--      dosyada HER İKİSİ DE mevcut, hiçbiri silinmedi.
--   3) sql/quote_specs_array_patch.sql ve sql/quote_specs_jsonb_object_patch.sql
--      birer veri dönüştürme (UPDATE) betiği; şema değil, HARİÇ TUTULDU.
--   4) DEVRE DIŞI/tarihsel dosyalar (kişi/sektör adına göre silme/engelleme
--      içeren): sql/customer_list_show_report_only_keep_out_of_kunye_reports.sql,
--      sql/kunye_report_only_guard.sql, sql/report_only_customers_visibility_guard.sql,
--      sql/vertical_banka_report_only_customers.sql, sql/business_partner_report_only_customers.sql
--      -> HARİÇ TUTULDU (bu dosyaların kendisi de devre dışı/yorum bloğu).
--   5) db/002_seed_example.sql -> HARİÇ TUTULDU (örnek/dev seed, sahte hash).
--   6) Salt veri backfill/DML dosyaları (sql/backfill_partner_owner_from_pipeline.sql,
--      diagnostic SELECT dosyaları vb.) -> HARİÇ TUTULDU.
--   7) db/migrations/20260817_003_parameter_catalog_seed.sql içindeki Türkçe
--      karakterler bu dosyada doğru UTF-8 ile yeniden yazıldı.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1) EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 2) TYPES (idempotent guarded)
-- ---------------------------------------------------------------------
do $$
begin
  create type public.entegrasyon_tipi_enum as enum ('A2A','D2D','D2D+A2A');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.faz_durum_enum as enum ('Devam Ediyor','Tamamlandı','İhtiyaç Duyulmadı','Başlamadı');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.pipeline_event_type_enum as enum (
    'set_active','status_changed','dates_updated','owner_changed','skipped',
    'reopened','note_added','PLAN','PLAN_DONE','quote_sent'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 3) TABLES (FK bağımlılık sırasına göre)
-- ---------------------------------------------------------------------

create table if not exists public.allowed_users (
    id uuid default gen_random_uuid() not null primary key,
    email text not null,
    full_name text,
    role text default 'user'::text not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default now() not null,
    password_hash text,
    weekly_target_sales_physical integer default 0 not null,
    weekly_target_sales_online integer default 0 not null,
    weekly_target_sales_phone integer default 0 not null,
    weekly_target_sales_email integer default 0 not null,
    weekly_target_technical_physical integer default 0 not null,
    weekly_target_technical_online integer default 0 not null,
    weekly_target_total_activities integer default 0 not null,
    weekly_target_unique_customers integer default 0 not null,
    constraint allowed_users_email_key unique (email)
);

create table if not exists public.teams (
    id uuid default gen_random_uuid() not null primary key,
    name text not null,
    description text,
    routing_rules jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null,
    constraint ux_teams_name unique (name)
);

create table if not exists public.faz_tanimlari (
    id uuid default gen_random_uuid() not null primary key,
    faz_no integer not null,
    asama_adi text not null,
    amac text,
    detay text,
    cikis_kriteri text,
    created_at timestamp with time zone default now(),
    owner text,
    constraint faz_tanimlari_faz_no_key unique (faz_no)
);

create table if not exists public.is_ortagi_faz_tanimlari (
    id uuid default gen_random_uuid() not null primary key,
    faz_no integer not null,
    asama_adi text not null,
    owner text,
    is_active boolean default true not null,
    sort_order integer default 0 not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint is_ortagi_faz_tanimlari_faz_no_key unique (faz_no)
);

create table if not exists public.musteriler (
    id uuid default gen_random_uuid() not null primary key,
    musteri text not null,
    satis_olasiligi text,
    sorumlu text,
    created_at timestamp with time zone default now(),
    entegrasyon_tipi public.entegrasyon_tipi_enum,
    sektor text,
    updated_by text,
    updated_at timestamp with time zone,
    owner_user_id uuid
);

create table if not exists public.musteri_pipeline (
    musteri_id uuid not null primary key,
    aktif_faz_no integer,
    aktif_iteration_no integer default 1,
    durum public.faz_durum_enum,
    owner text,
    partner_owner text,
    baslangic_tarihi date,
    hedef_tarihi date,
    notlar text,
    updated_at timestamp with time zone default now(),
    constraint ck_pipeline_tarih_mantigi check (((baslangic_tarihi is null) or (hedef_tarihi is null) or (baslangic_tarihi <= hedef_tarihi)))
);

create table if not exists public.faz_hareketleri (
    id uuid default gen_random_uuid() not null primary key,
    musteri_id uuid not null,
    faz_id uuid not null,
    baslangic_tarihi date,
    hedef_tarihi date,
    durum public.faz_durum_enum,
    kanal text,
    notlar text,
    owner text,
    partner_owner text,
    created_at timestamp with time zone default now()
);

create table if not exists public.pipeline_eventleri (
    id uuid default gen_random_uuid() not null primary key,
    musteri_id uuid not null,
    faz_no integer,
    iteration_no integer default 1,
    event_type public.pipeline_event_type_enum not null,
    durum public.faz_durum_enum,
    owner text,
    partner_owner text,
    baslangic_tarihi date,
    hedef_tarihi date,
    notlar text,
    payload jsonb,
    created_at timestamp with time zone default now(),
    aksiyon text,
    created_by text,
    is_blocked boolean default false not null,
    blocked_note text,
    blocked_at timestamp with time zone,
    blocked_by text,
    activity_scope text default 'account'::text not null,
    affects_phase boolean default true not null,
    updated_by text,
    updated_at timestamp with time zone,
    owner_user_id text,
    constraint pipeline_eventleri_activity_scope_check check ((activity_scope = any (array['account'::text, 'technical'::text])))
);

create table if not exists public.musteri_kunye (
    id uuid default gen_random_uuid() not null primary key,
    musteri_id uuid not null,
    magaza_sayisi text,
    toplam_pos_adedi integer,
    pos_modeli text,
    pos_notu text,
    el_terminali_modeli text,
    el_terminali_adedi integer,
    reyon_cihaz_modeli text,
    reyon_cihazi_adedi integer,
    sabit_kasa_yazilimi text,
    reyon_odeme_yazilimi text,
    erp text,
    bankalar text[],
    pos_mulkiyet text,
    saha_hizmeti_firmasi text,
    account text,
    entegrasyon_yapisi text,
    risk text,
    genel_memnuniyet text,
    problem_1 text,
    problem_2 text,
    problem_3 text,
    degisim_nedeni text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    pos_mulkiyet_bankalari text[],
    franchise_sayisi text,
    sabit_kasa_adedi text,
    reyon_cihaz_sayisi integer,
    pos_markasi text,
    pos_alim_yili text,
    sabit_bilgisayar_markasi text,
    reyon_alim_yili text,
    el_terminali_yazilimi text,
    el_terminali_alim_yili text,
    constraint musteri_kunye_musteri_id_key unique (musteri_id)
);

create table if not exists public.musteri_kunye_v2 (
    id uuid default gen_random_uuid() not null primary key,
    musteri_id uuid not null,
    magaza_sayisi text,
    franchise_sayisi text,
    sabit_kasa_adedi text,
    kasapos_firmasi text,
    pos_modeli text,
    pos_markasi text,
    toplam_pos_adedi integer,
    pos_alim_yili text,
    sabit_bilgisayar_markasi text,
    pos_notu text,
    reyon_kullaniliyor text default 'Hayır'::text,
    reyon_odeme_yazilimi text,
    reyon_cihaz_modeli text,
    reyon_cihaz_sayisi integer,
    reyon_alim_yili text,
    el_terminali_kullaniliyor text default 'Hayır'::text,
    el_terminali_modeli text,
    el_terminali_yazilimi text,
    el_terminali_adedi integer,
    el_terminali_alim_yili text,
    erp text,
    bankalar text[],
    pos_mulkiyet text,
    pos_mulkiyet_bankalari text[],
    saha_hizmeti_firmasi text,
    genel_memnuniyet text,
    risk text,
    entegrasyon_yapisi text,
    account text,
    problem_1 text,
    problem_2 text,
    problem_3 text,
    degisim_nedeni text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    updated_by text,
    constraint musteri_kunye_v2_musteri_id_key unique (musteri_id),
    constraint musteri_kunye_v2_el_terminali_kullaniliyor_check check (((el_terminali_kullaniliyor = any (array['Evet'::text, 'Hayır'::text])) or (el_terminali_kullaniliyor is null))),
    constraint musteri_kunye_v2_reyon_kullaniliyor_check check (((reyon_kullaniliyor = any (array['Evet'::text, 'Hayır'::text])) or (reyon_kullaniliyor is null)))
);

create table if not exists public.musteri_account_change_requests (
    id uuid default gen_random_uuid() not null primary key,
    musteri_id uuid not null,
    musteri text not null,
    current_account text,
    requested_account text not null,
    requested_by text not null,
    status text default 'pending'::text not null,
    review_note text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    constraint musteri_account_change_requests_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- Fazsız gelecek dönük müşteri faz geçmişi tablosu (customer_phase_logs.sql).
create table if not exists public.customer_phase_logs (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null,
    main_phase text not null,
    sub_phase integer not null,
    status text not null check (status in ('started','completed','reopened')),
    owner text null,
    note text null,
    created_at timestamptz not null default now()
);

create table if not exists public.quote_products (
    id uuid default gen_random_uuid() not null primary key,
    code text not null,
    name text not null,
    category text not null,
    product_type text not null,
    unit_label text default 'adet'::text not null,
    currency text default 'USD'::text not null,
    is_recurring boolean default false not null,
    billing_period text default 'one_time'::text not null,
    description text,
    specs jsonb default '[]'::jsonb not null,
    sort_order integer default 100 not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint quote_products_code_key unique (code),
    constraint quote_products_billing_period_check check ((billing_period = any (array['one_time'::text, 'monthly'::text]))),
    constraint quote_products_product_type_check check ((product_type = any (array['device'::text, 'bundle'::text, 'recurring'::text, 'peripheral'::text])))
);

create table if not exists public.quote_pricing_rules (
    id uuid default gen_random_uuid() not null primary key,
    product_id uuid not null,
    min_qty integer not null,
    max_qty integer,
    unit_price numeric(12,2) not null,
    created_at timestamp with time zone default now() not null,
    constraint quote_pricing_rules_qty_chk check (((min_qty > 0) and ((max_qty is null) or (max_qty >= min_qty))))
);

create table if not exists public.quotes (
    id uuid default gen_random_uuid() not null primary key,
    customer_id uuid not null,
    opportunity_title text,
    proposal_date date not null,
    valid_until date not null,
    follow_up_date date not null,
    owner_name text not null,
    owner_email text,
    probability integer not null,
    status text default 'draft'::text not null,
    closed_reason text,
    total_device_count integer default 0 not null,
    total_amount numeric(14,2) default 0 not null,
    hardware_amount numeric(14,2) default 0 not null,
    monthly_amount numeric(14,2) default 0 not null,
    note text,
    quote_year integer not null,
    quote_serial integer not null,
    quote_no text not null,
    activity_event_id uuid,
    pdf_url text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    owner_user_id text,
    constraint quotes_quote_no_key unique (quote_no),
    constraint quotes_quote_year_quote_serial_key unique (quote_year, quote_serial),
    constraint quotes_closed_reason_check check ((closed_reason = any (array['won'::text, 'lost'::text, 'expired'::text, 'no_interest'::text]))),
    constraint quotes_probability_check check ((probability = any (array[10, 30, 60, 90]))),
    constraint quotes_status_check check ((status = any (array['draft'::text, 'sent'::text, 'closed'::text])))
);

create table if not exists public.quote_items (
    id uuid default gen_random_uuid() not null primary key,
    quote_id uuid not null,
    line_no integer not null,
    product_id uuid not null,
    product_code_snapshot text not null,
    product_name_snapshot text not null,
    product_type text not null,
    category text not null,
    is_recurring boolean default false not null,
    billing_period text default 'one_time'::text not null,
    quantity integer not null,
    unit_price numeric(12,2) not null,
    total_price numeric(14,2) not null,
    rule_min_qty integer,
    rule_max_qty integer,
    created_at timestamp with time zone default now() not null,
    constraint quote_items_quote_id_line_no_key unique (quote_id, line_no),
    constraint quote_items_quantity_check check ((quantity > 0))
);

create table if not exists public.crm_forecasts (
    id uuid default gen_random_uuid() not null primary key,
    customer_id uuid not null,
    product_id text,
    product_code_snapshot text,
    product_name_snapshot text not null,
    quantity integer not null,
    forecast_year integer not null,
    forecast_month integer not null,
    sales_channel text not null,
    probability integer not null,
    owner_name text not null,
    owner_email text,
    owner_user_id text,
    note text,
    is_active boolean default true not null,
    created_by_email text,
    created_by_name text,
    updated_by_email text,
    updated_by_name text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint crm_forecasts_forecast_month_check check (((forecast_month >= 1) and (forecast_month <= 12))),
    constraint crm_forecasts_forecast_year_check check (((forecast_year >= 2024) and (forecast_year <= 2100))),
    constraint crm_forecasts_probability_check check ((probability = any (array[30, 60, 90]))),
    constraint crm_forecasts_quantity_check check ((quantity > 0))
);

create table if not exists public.crm_forecast_blockers (
    id uuid default gen_random_uuid() not null primary key,
    customer_id uuid not null,
    forecast_id uuid,
    has_blocker boolean not null,
    blocker_category text,
    blocker_description text,
    resolution_owner_type text,
    resolution_owner_name text,
    resolution_due_date date,
    impact_type text default 'none'::text not null,
    shift_year integer,
    shift_month integer,
    shifted_quantity integer,
    workflow_status text default 'open'::text not null,
    manager_note text,
    reviewed_at timestamp with time zone,
    reviewed_by_email text,
    reviewed_by_name text,
    submitted_at timestamp with time zone,
    submitted_by_email text,
    submitted_by_name text,
    created_at timestamp with time zone default now() not null,
    created_by_email text,
    created_by_name text,
    updated_at timestamp with time zone default now() not null,
    updated_by_email text,
    updated_by_name text,
    resolved_at timestamp with time zone,
    resolved_by_email text,
    resolved_by_name text,
    constraint crm_forecast_blockers_category_allowed check (((blocker_category is null) or (blocker_category = any (array['customer_decision'::text, 'pricing'::text, 'technical'::text, 'integration'::text, 'contract_legal'::text, 'bank_partner'::text, 'stock_supply'::text, 'internal_approval'::text, 'operation'::text, 'other'::text])))),
    constraint crm_forecast_blockers_impact_type_check check ((impact_type = any (array['none'::text, 'month_shift'::text]))),
    constraint crm_forecast_blockers_owner_type_allowed check (((resolution_owner_type is null) or (resolution_owner_type = any (array['internal'::text, 'customer'::text, 'bank'::text, 'partner'::text, 'other'::text])))),
    constraint crm_forecast_blockers_shift_month_check check (((shift_month is null) or ((shift_month >= 1) and (shift_month <= 12)))),
    constraint crm_forecast_blockers_shift_year_check check (((shift_year is null) or ((shift_year >= 2024) and (shift_year <= 2100)))),
    constraint crm_forecast_blockers_shifted_quantity_check check (((shifted_quantity is null) or (shifted_quantity > 0))),
    constraint crm_forecast_blockers_workflow_status_check check ((workflow_status = any (array['no_blocker'::text, 'open'::text, 'in_progress'::text, 'resolved'::text])))
);

create table if not exists public.crm_forecast_blocker_history (
    id uuid default gen_random_uuid() not null primary key,
    blocker_id uuid,
    customer_id uuid,
    forecast_id uuid,
    action text not null,
    old_data jsonb,
    new_data jsonb,
    changed_by_email text,
    changed_by_name text,
    changed_at timestamp with time zone default now() not null
);

-- Yeni minimal hedef alt sistemi (sql/crm_minimal_targets_v1.sql) — CANLI kullanılan hedef modeli.
create table if not exists public.crm_target_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text null,
  unit text not null check (unit in ('money','count')),
  source_type text not null default 'quotes_won' check (source_type = 'quotes_won'),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_target_definitions_code_key unique (code),
  constraint crm_target_definitions_code_not_blank check (nullif(trim(code), '') is not null),
  constraint crm_target_definitions_name_not_blank check (nullif(trim(name), '') is not null)
);

create table if not exists public.crm_target_values (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.crm_target_definitions(id) on delete restrict,
  scope_type text not null check (scope_type in ('company','user')),
  scope_user_id uuid null references public.allowed_users(id) on delete restrict,
  period_type text not null check (period_type in ('year','month','week')),
  period_start date not null,
  period_end date not null,
  target_value numeric not null check (target_value >= 0),
  note text null,
  created_by uuid null references public.allowed_users(id) on delete set null,
  updated_by uuid null references public.allowed_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_target_values_period_range_check check (period_end >= period_start),
  constraint crm_target_values_scope_consistency_check check (
    (scope_type = 'company' and scope_user_id is null)
    or (scope_type = 'user' and scope_user_id is not null)
  ),
  constraint crm_target_values_unique_scope_period unique nulls not distinct (definition_id, scope_type, scope_user_id, period_type, period_start, period_end)
);

-- Eski (Codex) RBAC + hedef/performans alt sistemi. crm_minimal_targets_verify.sql bu tabloların
-- artık kullanılmadığını doğruluyor; ama üretim ortamında veri varsa KAYBOLMAMASI için burada
-- IF NOT EXISTS ile korunuyor (eksikse yeniden oluşturulur, mevcutsa dokunulmaz).
create table if not exists public.crm_permissions (
    id bigint not null primary key,
    code text not null,
    description text,
    created_at timestamp with time zone default now() not null,
    constraint crm_permissions_code_key unique (code)
);

create table if not exists public.crm_roles (
    id bigint not null primary key,
    code text not null,
    name text not null,
    description text,
    is_system boolean default true not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default now() not null,
    constraint crm_roles_code_key unique (code)
);

create table if not exists public.crm_role_permissions (
    role_id bigint not null,
    permission_id bigint not null,
    constraint crm_role_permissions_pkey primary key (role_id, permission_id)
);

create table if not exists public.crm_user_roles (
    user_id text not null,
    role_id bigint not null,
    assigned_by_user_id text,
    assigned_at timestamp with time zone default now() not null,
    constraint crm_user_roles_pkey primary key (user_id, role_id)
);

create table if not exists public.crm_user_permission_overrides (
    user_id text not null,
    permission_id bigint not null,
    effect text not null,
    reason text,
    assigned_by_user_id text,
    assigned_at timestamp with time zone default now() not null,
    constraint crm_user_permission_overrides_pkey primary key (user_id, permission_id),
    constraint crm_user_permission_overrides_effect_check check ((effect = any (array['allow'::text, 'deny'::text])))
);

create table if not exists public.crm_target_metrics (
    id bigint not null primary key,
    code text not null,
    name text not null,
    description text,
    unit text not null,
    currency text,
    data_source text,
    calculation_method text,
    is_active boolean default true not null,
    dashboard_enabled boolean default true not null,
    allowed_scopes text[] default array['company'::text, 'team'::text, 'user'::text] not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint crm_target_metrics_code_key unique (code)
);

create table if not exists public.crm_targets (
    id bigint not null primary key,
    metric_id bigint not null,
    scope_type text not null,
    scope_id text,
    period_type text not null,
    start_date date not null,
    end_date date not null,
    target_value numeric(18,2) not null,
    currency text,
    revision_no integer default 1 not null,
    is_active boolean default true not null,
    created_by_user_id text,
    updated_by_user_id text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint crm_targets_check check ((end_date >= start_date)),
    constraint crm_targets_check1 check ((((scope_type = 'company'::text) and (scope_id is null)) or ((scope_type <> 'company'::text) and (scope_id is not null)))),
    constraint crm_targets_period_type_check check ((period_type = any (array['year'::text, 'month'::text, 'week'::text, 'custom'::text]))),
    constraint crm_targets_scope_type_check check ((scope_type = any (array['company'::text, 'team'::text, 'user'::text]))),
    constraint crm_targets_target_value_check check ((target_value >= (0)::numeric))
);

create table if not exists public.crm_target_revisions (
    id bigint not null primary key,
    target_id bigint not null,
    revision_no integer not null,
    previous_value numeric(18,2),
    new_value numeric(18,2) not null,
    note text not null,
    changed_by_user_id text,
    changed_at timestamp with time zone default now() not null,
    constraint crm_target_revisions_target_id_revision_no_key unique (target_id, revision_no)
);

create table if not exists public.crm_performance_snapshots (
    id bigint not null primary key,
    metric_id bigint not null,
    scope_type text not null,
    scope_id text,
    period_start date not null,
    period_end date not null,
    actual_value numeric(18,2),
    source_status text not null,
    source_updated_at timestamp with time zone,
    calculated_at timestamp with time zone default now() not null,
    metadata jsonb default '{}'::jsonb not null,
    constraint crm_performance_snapshots_metric_id_scope_type_scope_id_per_key unique (metric_id, scope_type, scope_id, period_start, period_end),
    constraint crm_performance_snapshots_scope_type_check check ((scope_type = any (array['company'::text, 'team'::text, 'user'::text]))),
    constraint crm_performance_snapshots_source_status_check check ((source_status = any (array['ready'::text, 'source_not_connected'::text, 'target_missing'::text, 'setup_required'::text])))
);

create table if not exists public.crm_teams (
    id bigint not null primary key,
    code text not null,
    name text not null,
    manager_user_id text,
    is_active boolean default true not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint crm_teams_code_key unique (code)
);

create table if not exists public.crm_team_members (
    team_id bigint not null,
    user_id text not null,
    is_manager boolean default false not null,
    is_active boolean default true not null,
    valid_from timestamp with time zone default now() not null,
    valid_until timestamp with time zone,
    constraint crm_team_members_pkey primary key (team_id, user_id)
);

create table if not exists public.crm_tv_devices (
    id bigint not null primary key,
    name text not null,
    activation_code_hash text,
    device_token_hash text,
    allowed_dashboard text default 'sales-performance'::text not null,
    is_active boolean default true not null,
    activated_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by_user_id text,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.crm_audit_logs (
    id bigint not null primary key,
    actor_user_id text,
    action text not null,
    entity_type text not null,
    entity_id text,
    before_data jsonb,
    after_data jsonb,
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.request_categories (
    id uuid default gen_random_uuid() not null primary key,
    name text not null,
    description text,
    sla_hours integer default 24 not null,
    default_team_id uuid,
    color text default '#2563eb'::text not null,
    created_at timestamp with time zone default now() not null,
    constraint request_categories_name_key unique (name)
);

create table if not exists public.requests (
    id uuid default gen_random_uuid() not null primary key,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    requester_id uuid not null,
    requester_name text,
    assignee_id uuid,
    assignee_name text,
    assignee_source text default 'manual'::text not null,
    team_id uuid,
    title text not null,
    body text default ''::text not null,
    category_id uuid,
    priority text default 'medium'::text not null,
    tags text[] default '{}'::text[] not null,
    channel text default 'manual'::text not null,
    source_ref text,
    source_metadata jsonb default '{}'::jsonb not null,
    due_at timestamp with time zone,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    sla_hours integer,
    sla_status text default 'on_time'::text not null,
    status text default 'open'::text not null,
    resolution_note text,
    ai_intent text,
    ai_confidence real,
    ai_suggested_assignee uuid,
    ai_suggested_category text,
    ai_raw_response jsonb,
    constraint requests_assignee_source_check check ((assignee_source = any (array['manual'::text, 'ai_suggested'::text, 'ai_auto'::text]))),
    constraint requests_channel_check check ((channel = any (array['manual'::text, 'whatsapp'::text, 'email'::text, 'system'::text]))),
    constraint requests_priority_check check ((priority = any (array['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    constraint requests_sla_status_check check ((sla_status = any (array['on_time'::text, 'at_risk'::text, 'breached'::text, 'na'::text]))),
    constraint requests_status_check check ((status = any (array['open'::text, 'assigned'::text, 'in_progress'::text, 'waiting'::text, 'resolved'::text, 'closed'::text])))
);

create table if not exists public.request_events (
    id uuid default gen_random_uuid() not null primary key,
    request_id uuid not null,
    actor_id uuid,
    actor_name text,
    event_type text not null,
    payload jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null,
    constraint request_events_event_type_check check ((event_type = any (array['created'::text, 'assigned'::text, 'reassigned'::text, 'status_changed'::text, 'comment'::text, 'priority_changed'::text, 'due_changed'::text, 'ai_action'::text])))
);

create table if not exists public.system_parameters (
    id uuid default gen_random_uuid() not null primary key,
    group_key text not null,
    param_key text not null,
    label text not null,
    value text not null,
    sort_order integer default 0 not null,
    is_active boolean default true not null,
    meta jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint system_parameters_group_key_param_key_key unique (group_key, param_key)
);

create table if not exists public.user_sessions (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid not null,
    session_token text not null,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.password_reset_tokens (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid not null,
    token text,
    token_hash text,
    expires_at timestamp with time zone not null,
    used_at timestamp with time zone,
    created_at timestamp with time zone default now() not null
);

create sequence if not exists public.import_teknik_aktiviteler_id_seq
    as bigint start with 1 increment by 1 no minvalue no maxvalue cache 1;

create table if not exists public.import_teknik_aktiviteler (
    id bigint not null default nextval('public.import_teknik_aktiviteler_id_seq'::regclass) primary key,
    musteri_adi text not null,
    aktivite_tipi text not null,
    notlar text,
    created_by text,
    created_at timestamp with time zone,
    constraint import_teknik_aktiviteler_aktivite_tipi_check check ((aktivite_tipi = any (array['Teknik Ziyaret'::text, 'Teknik Online'::text, 'Yerinde Ziyaret'::text, 'Online Görüşme'::text, 'Telefon'::text, 'E-Posta'::text, 'POM'::text])))
);
alter sequence public.import_teknik_aktiviteler_id_seq owned by public.import_teknik_aktiviteler.id;

-- Kurumsal güvenlik temeli (20260816_001): RBAC, audit, rate-limit, kimlik eşleme.
create table if not exists public.rbac_roles (
  role_key text primary key,
  label text not null,
  description text,
  is_active boolean not null default true,
  is_system boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.rbac_permissions (
  permission_key text primary key,
  module_key text not null,
  label text not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.rbac_role_permissions (
  role_key text not null references public.rbac_roles(role_key) on delete cascade,
  permission_key text not null references public.rbac_permissions(permission_key) on delete cascade,
  granted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.auth_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (key_hash, action, window_start)
);

create table if not exists public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users(id) on delete cascade,
  provider text not null check (provider in ('local', 'active_directory')),
  tenant_id text,
  subject text not null,
  email_at_link_time text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (provider, tenant_id, subject)
);

create table if not exists public.auth_group_role_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  group_id text not null,
  role text not null check (role in ('super_admin', 'admin', 'account_manager', 'itsm', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, group_id)
);

-- ---------------------------------------------------------------------
-- 4) ALTER TABLE ... ADD COLUMN IF NOT EXISTS (baseline sonrası eklenen kolonlar)
-- ---------------------------------------------------------------------

-- musteriler: parametrik müşteri tipi/pipeline politikası/entegrasyon anahtarı (20260816_002).
alter table public.musteriler add column if not exists customer_type text not null default 'standard';
alter table public.musteriler add column if not exists pipeline_policy text not null default 'phase_required';
alter table public.musteriler add column if not exists integration_type_key text null;
comment on column public.musteriler.customer_type is 'standard | report_only vb. — parametrik müşteri tipi.';
comment on column public.musteriler.pipeline_policy is 'phase_required | phase_optional — künye/faz zorunluluğu politikası.';
comment on column public.musteriler.integration_type_key is 'system_parameters.integration_type grubuna referans anahtar.';

-- system_parameters: versiyon takibi ve son güncelleyen kullanıcı (20260816_002).
alter table public.system_parameters add column if not exists version integer not null default 1;
alter table public.system_parameters add column if not exists updated_by_user_id uuid null;

-- pipeline_eventleri: aktiviteyi oluşturan/güncelleyen kullanıcı kimliği (user_activity_creator_identity.sql).
alter table public.pipeline_eventleri add column if not exists created_by_user_id uuid null;
alter table public.pipeline_eventleri add column if not exists created_by_email text null;
alter table public.pipeline_eventleri add column if not exists updated_by_user_id uuid null;
alter table public.pipeline_eventleri add column if not exists updated_by_email text null;
alter table public.pipeline_eventleri add column if not exists owner_user_id text null;
alter table public.crm_forecasts add column if not exists owner_user_id text null;
comment on column public.pipeline_eventleri.created_by_user_id is 'Aktiviteyi ilk oluşturan kullanıcı. Düzenlemelerde değişmez.';
comment on column public.pipeline_eventleri.created_by_email is 'Aktiviteyi ilk oluşturan kullanıcının e-postası. Düzenlemelerde değişmez.';
comment on column public.pipeline_eventleri.updated_by_user_id is 'Kaydı en son düzenleyen kullanıcı.';
comment on column public.pipeline_eventleri.updated_by_email is 'Kaydı en son düzenleyen kullanıcının e-postası.';

-- user_sessions / password_reset_tokens: hash tabanlı token sütunları (20260816_001).
alter table public.user_sessions add column if not exists session_token_hash text;
alter table public.user_sessions add column if not exists auth_source text not null default 'legacy';
alter table public.password_reset_tokens add column if not exists token_hash text;
alter table public.user_sessions alter column session_token drop not null;
alter table public.password_reset_tokens alter column token drop not null;

-- AD grup çözümlemesi: Graph sorgusu OIDC pairwise sub değil, immutable Entra Object ID
-- (oid claim) kullanmalı. Object ID auth_identities'e ayrıca saklanır (additive, geriye uyumlu).
alter table public.auth_identities add column if not exists object_id text;

-- Yeni AD session'da eşleşen TÜM CRM rolleri (multi-group union) burada snapshot olarak
-- tutulur; runtime authorization allowed_users.role yerine buradan hesaplanır. Legacy
-- session'larda null kalır, o durumda compatibility fallback allowed_users.role kullanır.
alter table public.user_sessions add column if not exists effective_roles text[];

-- crm_forecast_blocker_history: müşteri bazlı takip (forecast_id nullable), forecast_blocker_impact_setup.sql.
alter table public.crm_forecast_blocker_history add column if not exists customer_id uuid null;
alter table public.crm_forecast_blocker_history add column if not exists forecast_id uuid null;
alter table public.crm_forecast_blocker_history alter column forecast_id drop not null;

-- musteri_kunye_v2: çapraz hesap düzenleme izleme (cross_account_edit_patch.sql).
alter table public.musteri_kunye_v2 add column if not exists updated_by text;
alter table public.musteri_kunye_v2 add column if not exists updated_at timestamptz;
alter table public.musteriler add column if not exists updated_by text;
alter table public.musteriler add column if not exists updated_at timestamptz;

-- ---------------------------------------------------------------------
-- 4b) ALTER TABLE ... ADD COLUMN IF NOT EXISTS (her CREATE TABLE IF NOT EXISTS
--     bloğundaki her kolon için güvence). CREATE TABLE IF NOT EXISTS tablo zaten
--     varsa hiçbir şey yapmaz; bu yüzden canlıda tablo var ama kolon eksikse
--     (örn. crm_forecasts/pipeline_eventleri.owner_user_id vakası) sessizce
--     atlanır. Aşağıdaki ALTER'lar id/PK kolonları hariç HER kolonu tip+default
--     ile (constraint'siz) idempotent olarak garanti eder. Yukarıda zaten
--     manuel eklenmiş kolonlar tekrar edilmedi.
-- ---------------------------------------------------------------------

-- allowed_users
alter table public.allowed_users add column if not exists email text;
alter table public.allowed_users add column if not exists full_name text;
alter table public.allowed_users add column if not exists role text default 'user'::text;
alter table public.allowed_users add column if not exists secondary_roles text[] not null default '{}'::text[];
alter table public.allowed_users add column if not exists is_active boolean default true;
alter table public.allowed_users add column if not exists created_at timestamp with time zone default now();
alter table public.allowed_users add column if not exists password_hash text;
alter table public.allowed_users add column if not exists weekly_target_sales_physical integer default 0;
alter table public.allowed_users add column if not exists weekly_target_sales_online integer default 0;
alter table public.allowed_users add column if not exists weekly_target_sales_phone integer default 0;
alter table public.allowed_users add column if not exists weekly_target_sales_email integer default 0;
alter table public.allowed_users add column if not exists weekly_target_technical_physical integer default 0;
alter table public.allowed_users add column if not exists weekly_target_technical_online integer default 0;
alter table public.allowed_users add column if not exists weekly_target_total_activities integer default 0;
alter table public.allowed_users add column if not exists weekly_target_unique_customers integer default 0;

-- teams
alter table public.teams add column if not exists name text;
alter table public.teams add column if not exists description text;
alter table public.teams add column if not exists routing_rules jsonb default '{}'::jsonb;
alter table public.teams add column if not exists created_at timestamp with time zone default now();

-- faz_tanimlari
alter table public.faz_tanimlari add column if not exists faz_no integer;
alter table public.faz_tanimlari add column if not exists asama_adi text;
alter table public.faz_tanimlari add column if not exists amac text;
alter table public.faz_tanimlari add column if not exists detay text;
alter table public.faz_tanimlari add column if not exists cikis_kriteri text;
alter table public.faz_tanimlari add column if not exists created_at timestamp with time zone default now();
alter table public.faz_tanimlari add column if not exists owner text;

-- is_ortagi_faz_tanimlari
alter table public.is_ortagi_faz_tanimlari add column if not exists faz_no integer;
alter table public.is_ortagi_faz_tanimlari add column if not exists asama_adi text;
alter table public.is_ortagi_faz_tanimlari add column if not exists owner text;
alter table public.is_ortagi_faz_tanimlari add column if not exists is_active boolean default true;
alter table public.is_ortagi_faz_tanimlari add column if not exists sort_order integer default 0;
alter table public.is_ortagi_faz_tanimlari add column if not exists created_at timestamp with time zone default now();
alter table public.is_ortagi_faz_tanimlari add column if not exists updated_at timestamp with time zone default now();

-- musteriler (customer_type/pipeline_policy/integration_type_key/updated_by/updated_at yukarıda zaten var)
alter table public.musteriler add column if not exists musteri text;
alter table public.musteriler add column if not exists satis_olasiligi text;
alter table public.musteriler add column if not exists sorumlu text;
alter table public.musteriler add column if not exists created_at timestamp with time zone default now();
alter table public.musteriler add column if not exists entegrasyon_tipi public.entegrasyon_tipi_enum;
alter table public.musteriler add column if not exists sektor text;
alter table public.musteriler add column if not exists owner_user_id uuid;

-- musteri_pipeline (musteri_id PK, atlandı)
alter table public.musteri_pipeline add column if not exists aktif_faz_no integer;
alter table public.musteri_pipeline add column if not exists aktif_iteration_no integer default 1;
alter table public.musteri_pipeline add column if not exists durum public.faz_durum_enum;
alter table public.musteri_pipeline add column if not exists owner text;
alter table public.musteri_pipeline add column if not exists partner_owner text;
alter table public.musteri_pipeline add column if not exists baslangic_tarihi date;
alter table public.musteri_pipeline add column if not exists hedef_tarihi date;
alter table public.musteri_pipeline add column if not exists notlar text;
alter table public.musteri_pipeline add column if not exists updated_at timestamp with time zone default now();

-- faz_hareketleri
alter table public.faz_hareketleri add column if not exists musteri_id uuid;
alter table public.faz_hareketleri add column if not exists faz_id uuid;
alter table public.faz_hareketleri add column if not exists baslangic_tarihi date;
alter table public.faz_hareketleri add column if not exists hedef_tarihi date;
alter table public.faz_hareketleri add column if not exists durum public.faz_durum_enum;
alter table public.faz_hareketleri add column if not exists kanal text;
alter table public.faz_hareketleri add column if not exists notlar text;
alter table public.faz_hareketleri add column if not exists owner text;
alter table public.faz_hareketleri add column if not exists partner_owner text;
alter table public.faz_hareketleri add column if not exists created_at timestamp with time zone default now();

-- pipeline_eventleri (created_by_user_id/created_by_email/updated_by_user_id/updated_by_email/owner_user_id yukarıda zaten var)
alter table public.pipeline_eventleri add column if not exists musteri_id uuid;
alter table public.pipeline_eventleri add column if not exists faz_no integer;
alter table public.pipeline_eventleri add column if not exists iteration_no integer default 1;
alter table public.pipeline_eventleri add column if not exists event_type public.pipeline_event_type_enum;
alter table public.pipeline_eventleri add column if not exists durum public.faz_durum_enum;
alter table public.pipeline_eventleri add column if not exists owner text;
alter table public.pipeline_eventleri add column if not exists partner_owner text;
alter table public.pipeline_eventleri add column if not exists baslangic_tarihi date;
alter table public.pipeline_eventleri add column if not exists hedef_tarihi date;
alter table public.pipeline_eventleri add column if not exists notlar text;
alter table public.pipeline_eventleri add column if not exists payload jsonb;
alter table public.pipeline_eventleri add column if not exists created_at timestamp with time zone default now();
alter table public.pipeline_eventleri add column if not exists aksiyon text;
alter table public.pipeline_eventleri add column if not exists created_by text;
alter table public.pipeline_eventleri add column if not exists is_blocked boolean default false;
alter table public.pipeline_eventleri add column if not exists blocked_note text;
alter table public.pipeline_eventleri add column if not exists blocked_at timestamp with time zone;
alter table public.pipeline_eventleri add column if not exists blocked_by text;
alter table public.pipeline_eventleri add column if not exists activity_scope text default 'account'::text;
alter table public.pipeline_eventleri add column if not exists affects_phase boolean default true;
alter table public.pipeline_eventleri add column if not exists updated_by text;
alter table public.pipeline_eventleri add column if not exists updated_at timestamp with time zone;

-- musteri_kunye
alter table public.musteri_kunye add column if not exists musteri_id uuid;
alter table public.musteri_kunye add column if not exists magaza_sayisi text;
alter table public.musteri_kunye add column if not exists toplam_pos_adedi integer;
alter table public.musteri_kunye add column if not exists pos_modeli text;
alter table public.musteri_kunye add column if not exists pos_notu text;
alter table public.musteri_kunye add column if not exists el_terminali_modeli text;
alter table public.musteri_kunye add column if not exists el_terminali_adedi integer;
alter table public.musteri_kunye add column if not exists reyon_cihaz_modeli text;
alter table public.musteri_kunye add column if not exists reyon_cihazi_adedi integer;
alter table public.musteri_kunye add column if not exists sabit_kasa_yazilimi text;
alter table public.musteri_kunye add column if not exists reyon_odeme_yazilimi text;
alter table public.musteri_kunye add column if not exists erp text;
alter table public.musteri_kunye add column if not exists bankalar text[];
alter table public.musteri_kunye add column if not exists pos_mulkiyet text;
alter table public.musteri_kunye add column if not exists saha_hizmeti_firmasi text;
alter table public.musteri_kunye add column if not exists account text;
alter table public.musteri_kunye add column if not exists entegrasyon_yapisi text;
alter table public.musteri_kunye add column if not exists risk text;
alter table public.musteri_kunye add column if not exists genel_memnuniyet text;
alter table public.musteri_kunye add column if not exists problem_1 text;
alter table public.musteri_kunye add column if not exists problem_2 text;
alter table public.musteri_kunye add column if not exists problem_3 text;
alter table public.musteri_kunye add column if not exists degisim_nedeni text;
alter table public.musteri_kunye add column if not exists created_at timestamp with time zone default now();
alter table public.musteri_kunye add column if not exists updated_at timestamp with time zone default now();
alter table public.musteri_kunye add column if not exists pos_mulkiyet_bankalari text[];
alter table public.musteri_kunye add column if not exists franchise_sayisi text;
alter table public.musteri_kunye add column if not exists sabit_kasa_adedi text;
alter table public.musteri_kunye add column if not exists reyon_cihaz_sayisi integer;
alter table public.musteri_kunye add column if not exists pos_markasi text;
alter table public.musteri_kunye add column if not exists pos_alim_yili text;
alter table public.musteri_kunye add column if not exists sabit_bilgisayar_markasi text;
alter table public.musteri_kunye add column if not exists reyon_alim_yili text;
alter table public.musteri_kunye add column if not exists el_terminali_yazilimi text;
alter table public.musteri_kunye add column if not exists el_terminali_alim_yili text;

-- musteri_kunye_v2 (updated_by/updated_at yukarıda zaten var)
alter table public.musteri_kunye_v2 add column if not exists musteri_id uuid;
alter table public.musteri_kunye_v2 add column if not exists magaza_sayisi text;
alter table public.musteri_kunye_v2 add column if not exists franchise_sayisi text;
alter table public.musteri_kunye_v2 add column if not exists sabit_kasa_adedi text;
alter table public.musteri_kunye_v2 add column if not exists kasapos_firmasi text;
alter table public.musteri_kunye_v2 add column if not exists pos_modeli text;
alter table public.musteri_kunye_v2 add column if not exists pos_markasi text;
alter table public.musteri_kunye_v2 add column if not exists toplam_pos_adedi integer;
alter table public.musteri_kunye_v2 add column if not exists pos_alim_yili text;
alter table public.musteri_kunye_v2 add column if not exists sabit_bilgisayar_markasi text;
alter table public.musteri_kunye_v2 add column if not exists pos_notu text;
alter table public.musteri_kunye_v2 add column if not exists reyon_kullaniliyor text default 'Hayır'::text;
alter table public.musteri_kunye_v2 add column if not exists reyon_odeme_yazilimi text;
alter table public.musteri_kunye_v2 add column if not exists reyon_cihaz_modeli text;
alter table public.musteri_kunye_v2 add column if not exists reyon_cihaz_sayisi integer;
alter table public.musteri_kunye_v2 add column if not exists reyon_alim_yili text;
alter table public.musteri_kunye_v2 add column if not exists el_terminali_kullaniliyor text default 'Hayır'::text;
alter table public.musteri_kunye_v2 add column if not exists el_terminali_modeli text;
alter table public.musteri_kunye_v2 add column if not exists el_terminali_yazilimi text;
alter table public.musteri_kunye_v2 add column if not exists el_terminali_adedi integer;
alter table public.musteri_kunye_v2 add column if not exists el_terminali_alim_yili text;
alter table public.musteri_kunye_v2 add column if not exists erp text;
alter table public.musteri_kunye_v2 add column if not exists bankalar text[];
alter table public.musteri_kunye_v2 add column if not exists pos_mulkiyet text;
alter table public.musteri_kunye_v2 add column if not exists pos_mulkiyet_bankalari text[];
alter table public.musteri_kunye_v2 add column if not exists saha_hizmeti_firmasi text;
alter table public.musteri_kunye_v2 add column if not exists genel_memnuniyet text;
alter table public.musteri_kunye_v2 add column if not exists risk text;
alter table public.musteri_kunye_v2 add column if not exists entegrasyon_yapisi text;
alter table public.musteri_kunye_v2 add column if not exists account text;
alter table public.musteri_kunye_v2 add column if not exists problem_1 text;
alter table public.musteri_kunye_v2 add column if not exists problem_2 text;
alter table public.musteri_kunye_v2 add column if not exists problem_3 text;
alter table public.musteri_kunye_v2 add column if not exists degisim_nedeni text;
alter table public.musteri_kunye_v2 add column if not exists created_at timestamp with time zone default now();

-- musteri_account_change_requests
alter table public.musteri_account_change_requests add column if not exists musteri_id uuid;
alter table public.musteri_account_change_requests add column if not exists musteri text;
alter table public.musteri_account_change_requests add column if not exists current_account text;
alter table public.musteri_account_change_requests add column if not exists requested_account text;
alter table public.musteri_account_change_requests add column if not exists requested_by text;
alter table public.musteri_account_change_requests add column if not exists status text default 'pending'::text;
alter table public.musteri_account_change_requests add column if not exists review_note text;
alter table public.musteri_account_change_requests add column if not exists reviewed_by text;
alter table public.musteri_account_change_requests add column if not exists reviewed_at timestamp with time zone;
alter table public.musteri_account_change_requests add column if not exists created_at timestamp with time zone default now();

-- customer_phase_logs
alter table public.customer_phase_logs add column if not exists customer_id uuid;
alter table public.customer_phase_logs add column if not exists main_phase text;
alter table public.customer_phase_logs add column if not exists sub_phase integer;
alter table public.customer_phase_logs add column if not exists status text;
alter table public.customer_phase_logs add column if not exists owner text;
alter table public.customer_phase_logs add column if not exists note text;
alter table public.customer_phase_logs add column if not exists created_at timestamptz default now();

-- quote_products
alter table public.quote_products add column if not exists code text;
alter table public.quote_products add column if not exists name text;
alter table public.quote_products add column if not exists category text;
alter table public.quote_products add column if not exists product_type text;
alter table public.quote_products add column if not exists unit_label text default 'adet'::text;
alter table public.quote_products add column if not exists currency text default 'USD'::text;
alter table public.quote_products add column if not exists is_recurring boolean default false;
alter table public.quote_products add column if not exists billing_period text default 'one_time'::text;
alter table public.quote_products add column if not exists description text;
alter table public.quote_products add column if not exists specs jsonb default '[]'::jsonb;
alter table public.quote_products add column if not exists sort_order integer default 100;
alter table public.quote_products add column if not exists is_active boolean default true;
alter table public.quote_products add column if not exists created_at timestamp with time zone default now();
alter table public.quote_products add column if not exists updated_at timestamp with time zone default now();

-- quote_pricing_rules
alter table public.quote_pricing_rules add column if not exists product_id uuid;
alter table public.quote_pricing_rules add column if not exists min_qty integer;
alter table public.quote_pricing_rules add column if not exists max_qty integer;
alter table public.quote_pricing_rules add column if not exists unit_price numeric(12,2);
alter table public.quote_pricing_rules add column if not exists created_at timestamp with time zone default now();

-- quotes
alter table public.quotes add column if not exists customer_id uuid;
alter table public.quotes add column if not exists opportunity_title text;
alter table public.quotes add column if not exists proposal_date date;
alter table public.quotes add column if not exists valid_until date;
alter table public.quotes add column if not exists follow_up_date date;
alter table public.quotes add column if not exists owner_name text;
alter table public.quotes add column if not exists owner_email text;
alter table public.quotes add column if not exists probability integer;
alter table public.quotes add column if not exists status text default 'draft'::text;
alter table public.quotes add column if not exists closed_reason text;
alter table public.quotes add column if not exists total_device_count integer default 0;
alter table public.quotes add column if not exists total_amount numeric(14,2) default 0;
alter table public.quotes add column if not exists hardware_amount numeric(14,2) default 0;
alter table public.quotes add column if not exists monthly_amount numeric(14,2) default 0;
alter table public.quotes add column if not exists note text;
alter table public.quotes add column if not exists quote_year integer;
alter table public.quotes add column if not exists quote_serial integer;
alter table public.quotes add column if not exists quote_no text;
alter table public.quotes add column if not exists activity_event_id uuid;
alter table public.quotes add column if not exists pdf_url text;
alter table public.quotes add column if not exists closed_at timestamp with time zone;
alter table public.quotes add column if not exists created_at timestamp with time zone default now();
alter table public.quotes add column if not exists updated_at timestamp with time zone default now();
alter table public.quotes add column if not exists owner_user_id text;

-- quote_items
alter table public.quote_items add column if not exists quote_id uuid;
alter table public.quote_items add column if not exists line_no integer;
alter table public.quote_items add column if not exists product_id uuid;
alter table public.quote_items add column if not exists product_code_snapshot text;
alter table public.quote_items add column if not exists product_name_snapshot text;
alter table public.quote_items add column if not exists product_type text;
alter table public.quote_items add column if not exists category text;
alter table public.quote_items add column if not exists is_recurring boolean default false;
alter table public.quote_items add column if not exists billing_period text default 'one_time'::text;
alter table public.quote_items add column if not exists quantity integer;
alter table public.quote_items add column if not exists unit_price numeric(12,2);
alter table public.quote_items add column if not exists total_price numeric(14,2);
alter table public.quote_items add column if not exists rule_min_qty integer;
alter table public.quote_items add column if not exists rule_max_qty integer;
alter table public.quote_items add column if not exists created_at timestamp with time zone default now();

-- crm_forecasts (owner_user_id yukarıda zaten var)
alter table public.crm_forecasts add column if not exists customer_id uuid;
alter table public.crm_forecasts add column if not exists product_id text;
alter table public.crm_forecasts add column if not exists product_code_snapshot text;
alter table public.crm_forecasts add column if not exists product_name_snapshot text;
alter table public.crm_forecasts add column if not exists quantity integer;
alter table public.crm_forecasts add column if not exists forecast_year integer;
alter table public.crm_forecasts add column if not exists forecast_month integer;
alter table public.crm_forecasts add column if not exists sales_channel text;
alter table public.crm_forecasts add column if not exists probability integer;
alter table public.crm_forecasts add column if not exists owner_name text;
alter table public.crm_forecasts add column if not exists owner_email text;
alter table public.crm_forecasts add column if not exists note text;
alter table public.crm_forecasts add column if not exists is_active boolean default true;
alter table public.crm_forecasts add column if not exists created_by_email text;
alter table public.crm_forecasts add column if not exists created_by_name text;
alter table public.crm_forecasts add column if not exists updated_by_email text;
alter table public.crm_forecasts add column if not exists updated_by_name text;
alter table public.crm_forecasts add column if not exists created_at timestamp with time zone default now();
alter table public.crm_forecasts add column if not exists updated_at timestamp with time zone default now();

-- crm_forecast_blockers
alter table public.crm_forecast_blockers add column if not exists customer_id uuid;
alter table public.crm_forecast_blockers add column if not exists forecast_id uuid;
alter table public.crm_forecast_blockers add column if not exists has_blocker boolean;
alter table public.crm_forecast_blockers add column if not exists blocker_category text;
alter table public.crm_forecast_blockers add column if not exists blocker_description text;
alter table public.crm_forecast_blockers add column if not exists resolution_owner_type text;
alter table public.crm_forecast_blockers add column if not exists resolution_owner_name text;
alter table public.crm_forecast_blockers add column if not exists resolution_due_date date;
alter table public.crm_forecast_blockers add column if not exists impact_type text default 'none'::text;
alter table public.crm_forecast_blockers add column if not exists shift_year integer;
alter table public.crm_forecast_blockers add column if not exists shift_month integer;
alter table public.crm_forecast_blockers add column if not exists shifted_quantity integer;
alter table public.crm_forecast_blockers add column if not exists workflow_status text default 'open'::text;
alter table public.crm_forecast_blockers add column if not exists manager_note text;
alter table public.crm_forecast_blockers add column if not exists reviewed_at timestamp with time zone;
alter table public.crm_forecast_blockers add column if not exists reviewed_by_email text;
alter table public.crm_forecast_blockers add column if not exists reviewed_by_name text;
alter table public.crm_forecast_blockers add column if not exists submitted_at timestamp with time zone;
alter table public.crm_forecast_blockers add column if not exists submitted_by_email text;
alter table public.crm_forecast_blockers add column if not exists submitted_by_name text;
alter table public.crm_forecast_blockers add column if not exists created_at timestamp with time zone default now();
alter table public.crm_forecast_blockers add column if not exists created_by_email text;
alter table public.crm_forecast_blockers add column if not exists created_by_name text;
alter table public.crm_forecast_blockers add column if not exists updated_at timestamp with time zone default now();
alter table public.crm_forecast_blockers add column if not exists updated_by_email text;
alter table public.crm_forecast_blockers add column if not exists updated_by_name text;
alter table public.crm_forecast_blockers add column if not exists resolved_at timestamp with time zone;
alter table public.crm_forecast_blockers add column if not exists resolved_by_email text;
alter table public.crm_forecast_blockers add column if not exists resolved_by_name text;

-- crm_forecast_blocker_history (customer_id/forecast_id yukarıda zaten var)
alter table public.crm_forecast_blocker_history add column if not exists blocker_id uuid;
alter table public.crm_forecast_blocker_history add column if not exists action text;
alter table public.crm_forecast_blocker_history add column if not exists old_data jsonb;
alter table public.crm_forecast_blocker_history add column if not exists new_data jsonb;
alter table public.crm_forecast_blocker_history add column if not exists changed_by_email text;
alter table public.crm_forecast_blocker_history add column if not exists changed_by_name text;
alter table public.crm_forecast_blocker_history add column if not exists changed_at timestamp with time zone default now();

-- crm_target_definitions
alter table public.crm_target_definitions add column if not exists code text;
alter table public.crm_target_definitions add column if not exists name text;
alter table public.crm_target_definitions add column if not exists description text;
alter table public.crm_target_definitions add column if not exists unit text;
alter table public.crm_target_definitions add column if not exists source_type text default 'quotes_won';
alter table public.crm_target_definitions add column if not exists is_active boolean default true;
alter table public.crm_target_definitions add column if not exists display_order integer default 0;
alter table public.crm_target_definitions add column if not exists created_at timestamptz default now();
alter table public.crm_target_definitions add column if not exists updated_at timestamptz default now();
alter table public.crm_target_definitions alter column source_type set default 'quotes_won';
update public.crm_target_definitions set source_type = 'quotes_won' where source_type is null;

-- crm_target_values
alter table public.crm_target_values add column if not exists definition_id uuid;
alter table public.crm_target_values add column if not exists scope_type text;
alter table public.crm_target_values add column if not exists scope_user_id uuid;
alter table public.crm_target_values add column if not exists period_type text;
alter table public.crm_target_values add column if not exists period_start date;
alter table public.crm_target_values add column if not exists period_end date;
alter table public.crm_target_values add column if not exists target_value numeric;
alter table public.crm_target_values add column if not exists note text;
alter table public.crm_target_values add column if not exists created_by uuid;
alter table public.crm_target_values add column if not exists updated_by uuid;
alter table public.crm_target_values add column if not exists created_at timestamptz default now();
alter table public.crm_target_values add column if not exists updated_at timestamptz default now();

-- crm_permissions
alter table public.crm_permissions add column if not exists code text;
alter table public.crm_permissions add column if not exists description text;
alter table public.crm_permissions add column if not exists created_at timestamp with time zone default now();

-- crm_roles
alter table public.crm_roles add column if not exists code text;
alter table public.crm_roles add column if not exists name text;
alter table public.crm_roles add column if not exists description text;
alter table public.crm_roles add column if not exists is_system boolean default true;
alter table public.crm_roles add column if not exists is_active boolean default true;
alter table public.crm_roles add column if not exists created_at timestamp with time zone default now();

-- crm_role_permissions (composite PK: role_id, permission_id)
alter table public.crm_role_permissions add column if not exists role_id bigint;
alter table public.crm_role_permissions add column if not exists permission_id bigint;

-- crm_user_roles (composite PK: user_id, role_id)
alter table public.crm_user_roles add column if not exists user_id text;
alter table public.crm_user_roles add column if not exists role_id bigint;
alter table public.crm_user_roles add column if not exists assigned_by_user_id text;
alter table public.crm_user_roles add column if not exists assigned_at timestamp with time zone default now();

-- crm_user_permission_overrides (composite PK: user_id, permission_id)
alter table public.crm_user_permission_overrides add column if not exists user_id text;
alter table public.crm_user_permission_overrides add column if not exists permission_id bigint;
alter table public.crm_user_permission_overrides add column if not exists effect text;
alter table public.crm_user_permission_overrides add column if not exists reason text;
alter table public.crm_user_permission_overrides add column if not exists assigned_by_user_id text;
alter table public.crm_user_permission_overrides add column if not exists assigned_at timestamp with time zone default now();

-- crm_target_metrics
alter table public.crm_target_metrics add column if not exists code text;
alter table public.crm_target_metrics add column if not exists name text;
alter table public.crm_target_metrics add column if not exists description text;
alter table public.crm_target_metrics add column if not exists unit text;
alter table public.crm_target_metrics add column if not exists currency text;
alter table public.crm_target_metrics add column if not exists data_source text;
alter table public.crm_target_metrics add column if not exists calculation_method text;
alter table public.crm_target_metrics add column if not exists is_active boolean default true;
alter table public.crm_target_metrics add column if not exists dashboard_enabled boolean default true;
alter table public.crm_target_metrics add column if not exists allowed_scopes text[] default array['company'::text, 'team'::text, 'user'::text];
alter table public.crm_target_metrics add column if not exists created_at timestamp with time zone default now();
alter table public.crm_target_metrics add column if not exists updated_at timestamp with time zone default now();

-- crm_targets
alter table public.crm_targets add column if not exists metric_id bigint;
alter table public.crm_targets add column if not exists scope_type text;
alter table public.crm_targets add column if not exists scope_id text;
alter table public.crm_targets add column if not exists period_type text;
alter table public.crm_targets add column if not exists start_date date;
alter table public.crm_targets add column if not exists end_date date;
alter table public.crm_targets add column if not exists target_value numeric(18,2);
alter table public.crm_targets add column if not exists currency text;
alter table public.crm_targets add column if not exists revision_no integer default 1;
alter table public.crm_targets add column if not exists is_active boolean default true;
alter table public.crm_targets add column if not exists created_by_user_id text;
alter table public.crm_targets add column if not exists updated_by_user_id text;
alter table public.crm_targets add column if not exists created_at timestamp with time zone default now();
alter table public.crm_targets add column if not exists updated_at timestamp with time zone default now();

-- crm_target_revisions
alter table public.crm_target_revisions add column if not exists target_id bigint;
alter table public.crm_target_revisions add column if not exists revision_no integer;
alter table public.crm_target_revisions add column if not exists previous_value numeric(18,2);
alter table public.crm_target_revisions add column if not exists new_value numeric(18,2);
alter table public.crm_target_revisions add column if not exists note text;
alter table public.crm_target_revisions add column if not exists changed_by_user_id text;
alter table public.crm_target_revisions add column if not exists changed_at timestamp with time zone default now();

-- crm_performance_snapshots
alter table public.crm_performance_snapshots add column if not exists metric_id bigint;
alter table public.crm_performance_snapshots add column if not exists scope_type text;
alter table public.crm_performance_snapshots add column if not exists scope_id text;
alter table public.crm_performance_snapshots add column if not exists period_start date;
alter table public.crm_performance_snapshots add column if not exists period_end date;
alter table public.crm_performance_snapshots add column if not exists actual_value numeric(18,2);
alter table public.crm_performance_snapshots add column if not exists source_status text;
alter table public.crm_performance_snapshots add column if not exists source_updated_at timestamp with time zone;
alter table public.crm_performance_snapshots add column if not exists calculated_at timestamp with time zone default now();
alter table public.crm_performance_snapshots add column if not exists metadata jsonb default '{}'::jsonb;

-- crm_teams
alter table public.crm_teams add column if not exists code text;
alter table public.crm_teams add column if not exists name text;
alter table public.crm_teams add column if not exists manager_user_id text;
alter table public.crm_teams add column if not exists is_active boolean default true;
alter table public.crm_teams add column if not exists created_at timestamp with time zone default now();
alter table public.crm_teams add column if not exists updated_at timestamp with time zone default now();

-- crm_team_members (composite PK: team_id, user_id)
alter table public.crm_team_members add column if not exists team_id bigint;
alter table public.crm_team_members add column if not exists user_id text;
alter table public.crm_team_members add column if not exists is_manager boolean default false;
alter table public.crm_team_members add column if not exists is_active boolean default true;
alter table public.crm_team_members add column if not exists valid_from timestamp with time zone default now();
alter table public.crm_team_members add column if not exists valid_until timestamp with time zone;

-- crm_tv_devices
alter table public.crm_tv_devices add column if not exists name text;
alter table public.crm_tv_devices add column if not exists activation_code_hash text;
alter table public.crm_tv_devices add column if not exists device_token_hash text;
alter table public.crm_tv_devices add column if not exists allowed_dashboard text default 'sales-performance'::text;
alter table public.crm_tv_devices add column if not exists is_active boolean default true;
alter table public.crm_tv_devices add column if not exists activated_at timestamp with time zone;
alter table public.crm_tv_devices add column if not exists last_seen_at timestamp with time zone;
alter table public.crm_tv_devices add column if not exists revoked_at timestamp with time zone;
alter table public.crm_tv_devices add column if not exists created_by_user_id text;
alter table public.crm_tv_devices add column if not exists created_at timestamp with time zone default now();

-- crm_audit_logs
alter table public.crm_audit_logs add column if not exists actor_user_id text;
alter table public.crm_audit_logs add column if not exists action text;
alter table public.crm_audit_logs add column if not exists entity_type text;
alter table public.crm_audit_logs add column if not exists entity_id text;
alter table public.crm_audit_logs add column if not exists before_data jsonb;
alter table public.crm_audit_logs add column if not exists after_data jsonb;
alter table public.crm_audit_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.crm_audit_logs add column if not exists created_at timestamp with time zone default now();

-- request_categories
alter table public.request_categories add column if not exists name text;
alter table public.request_categories add column if not exists description text;
alter table public.request_categories add column if not exists sla_hours integer default 24;
alter table public.request_categories add column if not exists default_team_id uuid;
alter table public.request_categories add column if not exists color text default '#2563eb'::text;
alter table public.request_categories add column if not exists created_at timestamp with time zone default now();

-- requests
alter table public.requests add column if not exists created_at timestamp with time zone default now();
alter table public.requests add column if not exists updated_at timestamp with time zone default now();
alter table public.requests add column if not exists requester_id uuid;
alter table public.requests add column if not exists requester_name text;
alter table public.requests add column if not exists assignee_id uuid;
alter table public.requests add column if not exists assignee_name text;
alter table public.requests add column if not exists assignee_source text default 'manual'::text;
alter table public.requests add column if not exists team_id uuid;
alter table public.requests add column if not exists title text;
alter table public.requests add column if not exists body text default ''::text;
alter table public.requests add column if not exists category_id uuid;
alter table public.requests add column if not exists priority text default 'medium'::text;
alter table public.requests add column if not exists tags text[] default '{}'::text[];
alter table public.requests add column if not exists channel text default 'manual'::text;
alter table public.requests add column if not exists source_ref text;
alter table public.requests add column if not exists source_metadata jsonb default '{}'::jsonb;
alter table public.requests add column if not exists due_at timestamp with time zone;
alter table public.requests add column if not exists first_response_at timestamp with time zone;
alter table public.requests add column if not exists resolved_at timestamp with time zone;
alter table public.requests add column if not exists sla_hours integer;
alter table public.requests add column if not exists sla_status text default 'on_time'::text;
alter table public.requests add column if not exists status text default 'open'::text;
alter table public.requests add column if not exists resolution_note text;
alter table public.requests add column if not exists ai_intent text;
alter table public.requests add column if not exists ai_confidence real;
alter table public.requests add column if not exists ai_suggested_assignee uuid;
alter table public.requests add column if not exists ai_suggested_category text;
alter table public.requests add column if not exists ai_raw_response jsonb;

-- request_events
alter table public.request_events add column if not exists request_id uuid;
alter table public.request_events add column if not exists actor_id uuid;
alter table public.request_events add column if not exists actor_name text;
alter table public.request_events add column if not exists event_type text;
alter table public.request_events add column if not exists payload jsonb default '{}'::jsonb;
alter table public.request_events add column if not exists created_at timestamp with time zone default now();

-- system_parameters (version/updated_by_user_id yukarıda zaten var)
alter table public.system_parameters add column if not exists group_key text;
alter table public.system_parameters add column if not exists param_key text;
alter table public.system_parameters add column if not exists label text;
alter table public.system_parameters add column if not exists value text;
alter table public.system_parameters add column if not exists sort_order integer default 0;
alter table public.system_parameters add column if not exists is_active boolean default true;
alter table public.system_parameters add column if not exists meta jsonb default '{}'::jsonb;
alter table public.system_parameters add column if not exists created_at timestamp with time zone default now();
alter table public.system_parameters add column if not exists updated_at timestamp with time zone default now();

-- user_sessions (session_token_hash yukarıda zaten var)
alter table public.user_sessions add column if not exists user_id uuid;
alter table public.user_sessions add column if not exists session_token text;
alter table public.user_sessions add column if not exists expires_at timestamp with time zone;
alter table public.user_sessions add column if not exists created_at timestamp with time zone default now();

-- password_reset_tokens (token_hash yukarıda zaten var)
alter table public.password_reset_tokens add column if not exists user_id uuid;
alter table public.password_reset_tokens add column if not exists token text;
alter table public.password_reset_tokens add column if not exists expires_at timestamp with time zone;
alter table public.password_reset_tokens add column if not exists used_at timestamp with time zone;
alter table public.password_reset_tokens add column if not exists created_at timestamp with time zone default now();

-- import_teknik_aktiviteler (id nextval PK, atlandı)
alter table public.import_teknik_aktiviteler add column if not exists musteri_adi text;
alter table public.import_teknik_aktiviteler add column if not exists aktivite_tipi text;
alter table public.import_teknik_aktiviteler add column if not exists notlar text;
alter table public.import_teknik_aktiviteler add column if not exists created_by text;
alter table public.import_teknik_aktiviteler add column if not exists created_at timestamp with time zone;

-- rbac_roles (role_key PK, atlandı)
alter table public.rbac_roles add column if not exists label text;
alter table public.rbac_roles add column if not exists description text;
alter table public.rbac_roles add column if not exists is_active boolean default true;
alter table public.rbac_roles add column if not exists is_system boolean default true;
alter table public.rbac_roles add column if not exists updated_at timestamptz default now();

-- rbac_permissions (permission_key PK, atlandı)
alter table public.rbac_permissions add column if not exists module_key text;
alter table public.rbac_permissions add column if not exists label text;
alter table public.rbac_permissions add column if not exists description text;
alter table public.rbac_permissions add column if not exists updated_at timestamptz default now();

-- rbac_role_permissions (composite PK: role_key, permission_key)
alter table public.rbac_role_permissions add column if not exists role_key text;
alter table public.rbac_role_permissions add column if not exists permission_key text;
alter table public.rbac_role_permissions add column if not exists granted boolean default true;
alter table public.rbac_role_permissions add column if not exists updated_at timestamptz default now();

-- auth_rate_limits (composite PK: key_hash, action, window_start)
alter table public.auth_rate_limits add column if not exists key_hash text;
alter table public.auth_rate_limits add column if not exists action text;
alter table public.auth_rate_limits add column if not exists window_start timestamptz;
alter table public.auth_rate_limits add column if not exists attempts integer default 1;
alter table public.auth_rate_limits add column if not exists expires_at timestamptz;
alter table public.auth_rate_limits add column if not exists updated_at timestamptz default now();

-- crm_audit_events
alter table public.crm_audit_events add column if not exists actor_id text;
alter table public.crm_audit_events add column if not exists actor_email text;
alter table public.crm_audit_events add column if not exists action text;
alter table public.crm_audit_events add column if not exists resource_type text;
alter table public.crm_audit_events add column if not exists resource_id text;
alter table public.crm_audit_events add column if not exists before_state jsonb;
alter table public.crm_audit_events add column if not exists after_state jsonb;
alter table public.crm_audit_events add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.crm_audit_events add column if not exists created_at timestamptz default now();

-- auth_identities
alter table public.auth_identities add column if not exists user_id uuid;
alter table public.auth_identities add column if not exists provider text;
alter table public.auth_identities add column if not exists tenant_id text;
alter table public.auth_identities add column if not exists subject text;
alter table public.auth_identities add column if not exists email_at_link_time text;
alter table public.auth_identities add column if not exists created_at timestamptz default now();
alter table public.auth_identities add column if not exists last_login_at timestamptz;

-- auth_group_role_mappings
alter table public.auth_group_role_mappings add column if not exists tenant_id text;
alter table public.auth_group_role_mappings add column if not exists group_id text;
alter table public.auth_group_role_mappings add column if not exists role text;
alter table public.auth_group_role_mappings add column if not exists is_active boolean default true;
alter table public.auth_group_role_mappings add column if not exists created_at timestamptz default now();
alter table public.auth_group_role_mappings add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------
-- 5) PRIMARY KEY / UNIQUE / FOREIGN KEY (guarded — yalnız yoksa eklenir)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_customer_id_fkey') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_customer_id_fkey foreign key (customer_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecast_blockers_forecast_id_fkey') then
    alter table public.crm_forecast_blockers add constraint crm_forecast_blockers_forecast_id_fkey foreign key (forecast_id) references public.crm_forecasts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_forecasts_customer_id_fkey') then
    alter table public.crm_forecasts add constraint crm_forecasts_customer_id_fkey foreign key (customer_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_performance_snapshots_metric_id_fkey') then
    alter table public.crm_performance_snapshots add constraint crm_performance_snapshots_metric_id_fkey foreign key (metric_id) references public.crm_target_metrics(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_role_permissions_permission_id_fkey') then
    alter table public.crm_role_permissions add constraint crm_role_permissions_permission_id_fkey foreign key (permission_id) references public.crm_permissions(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_role_permissions_role_id_fkey') then
    alter table public.crm_role_permissions add constraint crm_role_permissions_role_id_fkey foreign key (role_id) references public.crm_roles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_target_revisions_target_id_fkey') then
    alter table public.crm_target_revisions add constraint crm_target_revisions_target_id_fkey foreign key (target_id) references public.crm_targets(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_targets_metric_id_fkey') then
    alter table public.crm_targets add constraint crm_targets_metric_id_fkey foreign key (metric_id) references public.crm_target_metrics(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_team_members_team_id_fkey') then
    alter table public.crm_team_members add constraint crm_team_members_team_id_fkey foreign key (team_id) references public.crm_teams(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_user_permission_overrides_permission_id_fkey') then
    alter table public.crm_user_permission_overrides add constraint crm_user_permission_overrides_permission_id_fkey foreign key (permission_id) references public.crm_permissions(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_user_roles_role_id_fkey') then
    alter table public.crm_user_roles add constraint crm_user_roles_role_id_fkey foreign key (role_id) references public.crm_roles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faz_hareketleri_faz_id_fkey') then
    alter table public.faz_hareketleri add constraint faz_hareketleri_faz_id_fkey foreign key (faz_id) references public.faz_tanimlari(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'faz_hareketleri_musteri_id_fkey') then
    alter table public.faz_hareketleri add constraint faz_hareketleri_musteri_id_fkey foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_kunye_musteri') then
    alter table public.musteri_kunye add constraint fk_kunye_musteri foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'musteri_account_change_requests_musteri_id_fkey') then
    alter table public.musteri_account_change_requests add constraint musteri_account_change_requests_musteri_id_fkey foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'musteri_kunye_v2_musteri_id_fkey') then
    alter table public.musteri_kunye_v2 add constraint musteri_kunye_v2_musteri_id_fkey foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'musteri_pipeline_aktif_faz_no_fkey') then
    alter table public.musteri_pipeline add constraint musteri_pipeline_aktif_faz_no_fkey foreign key (aktif_faz_no) references public.faz_tanimlari(faz_no);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'musteri_pipeline_musteri_id_fkey') then
    alter table public.musteri_pipeline add constraint musteri_pipeline_musteri_id_fkey foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'musteriler_owner_user_id_fkey') then
    alter table public.musteriler add constraint musteriler_owner_user_id_fkey foreign key (owner_user_id) references public.allowed_users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'password_reset_tokens_user_id_fkey') then
    alter table public.password_reset_tokens add constraint password_reset_tokens_user_id_fkey foreign key (user_id) references public.allowed_users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pipeline_eventleri_faz_no_fkey') then
    alter table public.pipeline_eventleri add constraint pipeline_eventleri_faz_no_fkey foreign key (faz_no) references public.faz_tanimlari(faz_no);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pipeline_eventleri_musteri_id_fkey') then
    alter table public.pipeline_eventleri add constraint pipeline_eventleri_musteri_id_fkey foreign key (musteri_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pipeline_eventleri_created_by_user_id_fkey') then
    alter table public.pipeline_eventleri add constraint pipeline_eventleri_created_by_user_id_fkey foreign key (created_by_user_id) references public.allowed_users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pipeline_eventleri_updated_by_user_id_fkey') then
    alter table public.pipeline_eventleri add constraint pipeline_eventleri_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.allowed_users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_items_product_id_fkey') then
    alter table public.quote_items add constraint quote_items_product_id_fkey foreign key (product_id) references public.quote_products(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_items_quote_id_fkey') then
    alter table public.quote_items add constraint quote_items_quote_id_fkey foreign key (quote_id) references public.quotes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_pricing_rules_product_id_fkey') then
    alter table public.quote_pricing_rules add constraint quote_pricing_rules_product_id_fkey foreign key (product_id) references public.quote_products(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotes_customer_id_fkey') then
    alter table public.quotes add constraint quotes_customer_id_fkey foreign key (customer_id) references public.musteriler(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'request_categories_default_team_id_fkey') then
    alter table public.request_categories add constraint request_categories_default_team_id_fkey foreign key (default_team_id) references public.teams(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'request_events_request_id_fkey') then
    alter table public.request_events add constraint request_events_request_id_fkey foreign key (request_id) references public.requests(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requests_category_id_fkey') then
    alter table public.requests add constraint requests_category_id_fkey foreign key (category_id) references public.request_categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requests_team_id_fkey') then
    alter table public.requests add constraint requests_team_id_fkey foreign key (team_id) references public.teams(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_sessions_user_id_fkey') then
    alter table public.user_sessions add constraint user_sessions_user_id_fkey foreign key (user_id) references public.allowed_users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'allowed_users_role_enterprise_check') then
    alter table public.allowed_users add constraint allowed_users_role_enterprise_check
      check (role in ('super_admin', 'admin', 'account_manager', 'itsm', 'user')) not valid;
    alter table public.allowed_users validate constraint allowed_users_role_enterprise_check;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6) INDEXES (IF NOT EXISTS)
-- ---------------------------------------------------------------------
create index if not exists crm_audit_logs_actor_idx on public.crm_audit_logs (actor_user_id, created_at desc);
create index if not exists crm_audit_logs_entity_idx on public.crm_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists crm_forecasts_owner_user_idx on public.crm_forecasts (owner_user_id);
create index if not exists crm_permission_overrides_user_idx on public.crm_user_permission_overrides (user_id);
create unique index if not exists crm_targets_natural_key on public.crm_targets (metric_id, scope_type, coalesce(scope_id, ''::text), period_type, start_date, end_date) where (is_active = true);
create index if not exists crm_targets_period_scope_idx on public.crm_targets (start_date, end_date, scope_type, scope_id);
create index if not exists crm_team_members_user_active_idx on public.crm_team_members (user_id, is_active);
create unique index if not exists crm_tv_devices_token_hash_idx on public.crm_tv_devices (device_token_hash) where (device_token_hash is not null);
create index if not exists crm_user_roles_user_idx on public.crm_user_roles (user_id);
create index if not exists idx_crm_forecast_blocker_history_customer on public.crm_forecast_blocker_history (customer_id, changed_at desc);
create index if not exists idx_crm_forecast_blocker_history_forecast on public.crm_forecast_blocker_history (forecast_id, changed_at desc);
create index if not exists idx_crm_forecast_blockers_due on public.crm_forecast_blockers (resolution_due_date) where (workflow_status = any (array['open'::text, 'in_progress'::text]));
create index if not exists idx_crm_forecast_blockers_forecast on public.crm_forecast_blockers (forecast_id) where (forecast_id is not null);
create index if not exists idx_crm_forecast_blockers_status on public.crm_forecast_blockers (workflow_status, updated_at desc);
create index if not exists idx_crm_forecasts_customer_period on public.crm_forecasts (customer_id, forecast_year, forecast_month) where (is_active = true);
create index if not exists idx_crm_forecasts_owner_period on public.crm_forecasts (owner_name, forecast_year, forecast_month) where (is_active = true);
create index if not exists idx_faz_hareketleri_faz on public.faz_hareketleri (faz_id);
create index if not exists idx_faz_hareketleri_musteri on public.faz_hareketleri (musteri_id);
create index if not exists idx_is_ortagi_faz_tanimlari_active_sort on public.is_ortagi_faz_tanimlari (is_active, sort_order, faz_no);
create index if not exists idx_musteri_account_change_requests_musteri on public.musteri_account_change_requests (musteri_id, created_at desc);
create unique index if not exists idx_musteri_account_change_requests_pending on public.musteri_account_change_requests (musteri_id) where (status = 'pending'::text);
create index if not exists idx_musteri_account_change_requests_status on public.musteri_account_change_requests (status, created_at desc);
create index if not exists idx_musteri_kunye_musteri on public.musteri_kunye (musteri_id);
create index if not exists idx_musteri_kunye_v2_musteri_id on public.musteri_kunye_v2 (musteri_id);
create index if not exists idx_musteri_pipeline_faz on public.musteri_pipeline (aktif_faz_no, updated_at desc);
create index if not exists idx_musteri_pipeline_owner on public.musteri_pipeline (owner);
create index if not exists idx_musteri_pipeline_musteri on public.musteri_pipeline (musteri_id);
create index if not exists idx_musteriler_musteri_lower on public.musteriler (lower(musteri));
create index if not exists idx_musteriler_owner_user_id on public.musteriler (owner_user_id);
create index if not exists idx_musteriler_sektor_enteg on public.musteriler (sektor, entegrasyon_tipi);
create index if not exists idx_musteriler_sektor on public.musteriler (sektor);
create index if not exists idx_musteriler_entegrasyon on public.musteriler (entegrasyon_tipi);
create index if not exists idx_musteriler_sorumlu on public.musteriler (sorumlu);
create index if not exists idx_musteriler_sorumlu_sektor on public.musteriler (sorumlu, sektor);
create index if not exists idx_musteriler_customer_type on public.musteriler (customer_type);
create index if not exists idx_musteriler_pipeline_policy on public.musteriler (pipeline_policy);
create index if not exists idx_musteriler_integration_type_key on public.musteriler (integration_type_key);
create index if not exists idx_pipeline_eventleri_activity_scope on public.pipeline_eventleri (activity_scope);
create index if not exists idx_pipeline_eventleri_affects_phase on public.pipeline_eventleri (affects_phase);
create index if not exists idx_pipeline_eventleri_blocked_created on public.pipeline_eventleri (is_blocked, created_at desc);
create index if not exists idx_pipeline_eventleri_created_at on public.pipeline_eventleri (created_at desc);
create index if not exists idx_pipeline_eventleri_created_by_created on public.pipeline_eventleri (created_by, created_at desc);
create index if not exists idx_pipeline_eventleri_durum_hedef on public.pipeline_eventleri (durum, hedef_tarihi);
create index if not exists idx_pipeline_eventleri_faz on public.pipeline_eventleri (faz_no);
create index if not exists idx_pipeline_eventleri_faz_durum_created on public.pipeline_eventleri (faz_no, durum, created_at desc);
create index if not exists idx_pipeline_eventleri_hedef_created on public.pipeline_eventleri (hedef_tarihi, created_at desc);
create index if not exists idx_pipeline_eventleri_is_blocked on public.pipeline_eventleri (is_blocked);
create index if not exists idx_pipeline_eventleri_musteri_created on public.pipeline_eventleri (musteri_id, created_at desc);
create index if not exists idx_pipeline_eventleri_musteri_faz_created on public.pipeline_eventleri (musteri_id, faz_no, created_at desc);
create index if not exists idx_pipeline_eventleri_partner_owner on public.pipeline_eventleri (partner_owner);
create index if not exists idx_pipeline_eventleri_creator_date on public.pipeline_eventleri (created_by_user_id, created_at desc);
create index if not exists idx_pipeline_eventleri_creator_email_date on public.pipeline_eventleri (lower(created_by_email), created_at desc);
create index if not exists idx_pipeline_eventleri_legacy_creator_date on public.pipeline_eventleri (lower(trim(created_by)), created_at desc) where (coalesce(aksiyon, '') like 'AKTIVITE:%');
create index if not exists idx_quote_items_product on public.quote_items (product_id);
create index if not exists idx_quote_items_quote on public.quote_items (quote_id, line_no);
create index if not exists idx_quote_pricing_rules_product on public.quote_pricing_rules (product_id, min_qty);
create index if not exists idx_quotes_customer on public.quotes (customer_id, created_at desc);
create index if not exists idx_quotes_owner on public.quotes (owner_name, created_at desc);
create index if not exists idx_quotes_quote_no on public.quotes (quote_no);
create index if not exists idx_quotes_status_followup on public.quotes (status, follow_up_date);
create index if not exists idx_request_events_request_id_created_at on public.request_events (request_id, created_at desc);
create index if not exists idx_requests_assignee_id on public.requests (assignee_id);
create index if not exists idx_requests_category_id on public.requests (category_id);
create index if not exists idx_requests_created_at_desc on public.requests (created_at desc);
create index if not exists idx_requests_due_at on public.requests (due_at);
create index if not exists idx_requests_priority on public.requests (priority);
create index if not exists idx_requests_requester_id on public.requests (requester_id);
create index if not exists idx_requests_resolved_at on public.requests (resolved_at);
create index if not exists idx_requests_sla_status on public.requests (sla_status);
create index if not exists idx_requests_status on public.requests (status);
create index if not exists idx_requests_team_id on public.requests (team_id);
create index if not exists idx_system_parameters_group_active_sort on public.system_parameters (group_key, is_active, sort_order, label);
create index if not exists idx_user_sessions_token on public.user_sessions (session_token);
create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists password_reset_tokens_expiry_idx on public.password_reset_tokens (expires_at) where (used_at is null);
create index if not exists password_reset_tokens_user_active_idx on public.password_reset_tokens (user_id, expires_at desc) where (used_at is null);
create index if not exists pipeline_eventleri_owner_user_idx on public.pipeline_eventleri (owner_user_id);
create index if not exists quotes_owner_user_idx on public.quotes (owner_user_id);
create unique index if not exists ux_crm_forecast_blockers_customer on public.crm_forecast_blockers (customer_id);

-- performance_indexes.sql / user_activity_creator_identity.sql fazlası (auth/oturum + genel amaçlı)
create index if not exists idx_allowed_users_email_lower on public.allowed_users (lower(email));
create index if not exists idx_user_sessions_token_expires on public.user_sessions (session_token, expires_at desc);
create index if not exists idx_user_sessions_user_expires on public.user_sessions (user_id, expires_at desc);
create unique index if not exists user_sessions_session_token_hash_uidx on public.user_sessions (session_token_hash) where (session_token_hash is not null);
create index if not exists user_sessions_expires_at_idx on public.user_sessions (expires_at);
create unique index if not exists password_reset_tokens_token_hash_uidx on public.password_reset_tokens (token_hash) where (token_hash is not null);
create unique index if not exists password_reset_tokens_token_uidx on public.password_reset_tokens (token) where (token is not null);
create index if not exists password_reset_tokens_expires_at_idx on public.password_reset_tokens (expires_at);

-- Yeni minimal hedef alt sistemi indexleri.
create index if not exists crm_target_values_definition_id_idx on public.crm_target_values (definition_id);
create index if not exists crm_target_values_scope_user_id_idx on public.crm_target_values (scope_user_id);
create index if not exists crm_target_values_period_range_idx on public.crm_target_values (period_type, period_start, period_end);
create index if not exists crm_target_values_scope_period_idx on public.crm_target_values (scope_type, scope_user_id, period_type, period_start);

-- Kurumsal güvenlik temeli indexleri.
create index if not exists auth_rate_limits_expires_at_idx on public.auth_rate_limits (expires_at);
create index if not exists crm_audit_events_actor_created_idx on public.crm_audit_events (actor_id, created_at desc);
create index if not exists crm_audit_events_resource_created_idx on public.crm_audit_events (resource_type, resource_id, created_at desc);
create index if not exists crm_audit_events_action_created_idx on public.crm_audit_events (action, created_at desc);
create index if not exists auth_identities_user_id_idx on public.auth_identities (user_id);

-- ---------------------------------------------------------------------
-- 7) VIEWS (CREATE OR REPLACE — hep son/otorite şekliyle)
-- ---------------------------------------------------------------------
drop view if exists public.v_crm_forecast_blocker_impact cascade;
create view public.v_crm_forecast_blocker_impact as
 select m.id as customer_id,
    m.musteri,
    m.sektor,
    m.sorumlu,
    m.entegrasyon_tipi,
    sf.id as forecast_id,
    sf.product_id,
    sf.product_code_snapshot,
    sf.product_name_snapshot,
    sf.quantity,
    sf.forecast_year,
    sf.forecast_month,
        case
            when (sf.id is null) then 'Aktif Forecast yok'::text
            else ((lpad((sf.forecast_month)::text, 2, '0'::text) || '/'::text) || (sf.forecast_year)::text)
        end as forecast_period_label,
    sf.owner_name,
    sf.owner_email,
    coalesce(fs.active_forecast_count, 0) as active_forecast_count,
    coalesce(fs.total_forecast_quantity, 0) as total_forecast_quantity,
    coalesce(fs.forecast_options, '[]'::jsonb) as forecast_options,
    b.id as blocker_id,
    b.has_blocker,
    b.blocker_category,
    b.blocker_description,
    b.resolution_owner_type,
    b.resolution_owner_name,
    b.resolution_due_date,
    b.impact_type,
    b.shift_year,
    b.shift_month,
    b.shifted_quantity,
        case
            when ((b.shift_year is null) or (b.shift_month is null)) then null::text
            else ((lpad((b.shift_month)::text, 2, '0'::text) || '/'::text) || (b.shift_year)::text)
        end as shift_period_label,
    b.workflow_status,
    b.manager_note,
    b.reviewed_at,
    b.reviewed_by_email,
    b.reviewed_by_name,
    b.submitted_at,
    b.submitted_by_email,
    b.submitted_by_name,
    b.updated_at,
    b.updated_by_email,
    b.updated_by_name,
    b.resolved_at,
        case
            when (b.id is null) then 'pending'::text
            when (not b.has_blocker) then 'no_blocker'::text
            when (b.workflow_status = 'resolved'::text) then 'resolved'::text
            when (b.resolution_due_date < current_date) then 'overdue'::text
            when (b.workflow_status = 'in_progress'::text) then 'in_progress'::text
            else 'open'::text
        end as effective_status
   from (((public.musteriler m
     left join public.crm_forecast_blockers b on ((b.customer_id = m.id)))
     left join lateral ( select (count(*))::integer as active_forecast_count,
            (coalesce(sum(f.quantity), (0)::bigint))::integer as total_forecast_quantity,
            jsonb_agg(jsonb_build_object('forecast_id', (f.id)::text, 'product_code', f.product_code_snapshot, 'product_name', f.product_name_snapshot, 'quantity', f.quantity, 'year', f.forecast_year, 'month', f.forecast_month)) as forecast_options
           from public.crm_forecasts f
          where ((f.customer_id = m.id) and (f.is_active = true))) fs on (true))
     left join lateral ( select f.id,
            f.customer_id,
            f.product_id,
            f.product_code_snapshot,
            f.product_name_snapshot,
            f.quantity,
            f.forecast_year,
            f.forecast_month,
            f.sales_channel,
            f.probability,
            f.owner_name,
            f.owner_email,
            f.owner_user_id,
            f.note,
            f.is_active,
            f.created_by_email,
            f.created_by_name,
            f.updated_by_email,
            f.updated_by_name,
            f.created_at,
            f.updated_at
           from public.crm_forecasts f
          where ((f.customer_id = m.id) and ((f.is_active = true) or (f.id = b.forecast_id)))
          order by
                case
                    when (f.id = b.forecast_id) then 0
                    else 1
                end, f.forecast_year, f.forecast_month
         limit 1) sf on (true));

drop view if exists public.v_crm_forecast_report cascade;
create view public.v_crm_forecast_report as
 select f.id,
    f.customer_id,
    f.product_id,
    f.product_code_snapshot,
    f.product_name_snapshot,
    f.quantity,
    f.forecast_year,
    f.forecast_month,
    f.sales_channel,
    f.probability,
    f.owner_name,
    f.owner_email,
    f.owner_user_id,
    f.note,
    f.is_active,
    f.created_by_email,
    f.created_by_name,
    f.updated_by_email,
    f.updated_by_name,
    f.created_at,
    f.updated_at,
    m.musteri,
    m.sektor,
    m.sorumlu,
    m.entegrasyon_tipi,
    round((((f.quantity)::numeric * (f.probability)::numeric) / (100)::numeric), 2) as weighted_quantity
   from (public.crm_forecasts f
     join public.musteriler m on ((m.id = f.customer_id)));

drop view if exists public.v_musteri_kunye_form cascade;
create view public.v_musteri_kunye_form as
 select m.id as musteri_id,
    m.musteri as firma_adi,
    m.sektor,
    k.account as musteri_account,
    k.id as kunye_id,
    k.magaza_sayisi,
    k.franchise_sayisi,
    k.sabit_kasa_adedi,
    k.kasapos_firmasi,
    k.pos_modeli,
    k.pos_markasi,
    k.toplam_pos_adedi,
    k.pos_alim_yili,
    k.sabit_bilgisayar_markasi,
    k.pos_notu,
    k.reyon_kullaniliyor,
    k.reyon_odeme_yazilimi,
    k.reyon_cihaz_modeli,
    k.reyon_cihaz_sayisi,
    k.reyon_alim_yili,
    k.el_terminali_kullaniliyor,
    k.el_terminali_modeli,
    k.el_terminali_yazilimi,
    k.el_terminali_adedi,
    k.el_terminali_alim_yili,
    k.erp,
    k.bankalar,
    k.pos_mulkiyet,
    k.pos_mulkiyet_bankalari,
    k.saha_hizmeti_firmasi,
    k.genel_memnuniyet,
    k.risk,
    k.entegrasyon_yapisi,
    k.problem_1,
    k.problem_2,
    k.problem_3,
    k.degisim_nedeni,
    k.created_at,
    k.updated_at
   from (public.musteriler m
     left join public.musteri_kunye_v2 k on ((k.musteri_id = m.id)));

drop view if exists public.v_musteri_kunye_status cascade;
create view public.v_musteri_kunye_status as
 with base as (
         select k.musteri_id,
            k.firma_adi,
            k.sektor,
            k.musteri_account,
            k.kunye_id,
            k.magaza_sayisi,
            k.franchise_sayisi,
            k.sabit_kasa_adedi,
            k.kasapos_firmasi,
            k.pos_modeli,
            k.pos_markasi,
            k.toplam_pos_adedi,
            k.pos_alim_yili,
            k.sabit_bilgisayar_markasi,
            k.pos_notu,
            k.reyon_kullaniliyor,
            k.reyon_odeme_yazilimi,
            k.reyon_cihaz_modeli,
            k.reyon_cihaz_sayisi,
            k.reyon_alim_yili,
            k.el_terminali_kullaniliyor,
            k.el_terminali_modeli,
            k.el_terminali_yazilimi,
            k.el_terminali_adedi,
            k.el_terminali_alim_yili,
            k.erp,
            k.bankalar,
            k.pos_mulkiyet,
            k.pos_mulkiyet_bankalari,
            k.saha_hizmeti_firmasi,
            k.genel_memnuniyet,
            k.risk,
            k.entegrasyon_yapisi,
            k.problem_1,
            k.problem_2,
            k.problem_3,
            k.degisim_nedeni,
            k.created_at,
            k.updated_at,
            ((((
                case when (k.magaza_sayisi is not null) then 1 else 0 end +
                case when (k.kasapos_firmasi is not null) then 1 else 0 end) +
                case when (k.pos_modeli is not null) then 1 else 0 end) +
                case when (k.pos_markasi is not null) then 1 else 0 end) +
                case when (k.toplam_pos_adedi is not null) then 1 else 0 end) as required_filled,
            (((((((((((((((((((((((((((((((
                case when (k.magaza_sayisi is not null) then 1 else 0 end +
                case when (k.franchise_sayisi is not null) then 1 else 0 end) +
                case when (k.sabit_kasa_adedi is not null) then 1 else 0 end) +
                case when (k.kasapos_firmasi is not null) then 1 else 0 end) +
                case when (k.pos_modeli is not null) then 1 else 0 end) +
                case when (k.pos_markasi is not null) then 1 else 0 end) +
                case when (k.toplam_pos_adedi is not null) then 1 else 0 end) +
                case when (k.pos_alim_yili is not null) then 1 else 0 end) +
                case when (k.sabit_bilgisayar_markasi is not null) then 1 else 0 end) +
                case when (k.pos_notu is not null) then 1 else 0 end) +
                case when (k.reyon_kullaniliyor is not null) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_odeme_yazilimi is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_cihaz_modeli is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_cihaz_sayisi is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_alim_yili is not null)) then 1 else 0 end) +
                case when (k.el_terminali_kullaniliyor is not null) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_modeli is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_yazilimi is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_adedi is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_alim_yili is not null)) then 1 else 0 end) +
                case when (k.erp is not null) then 1 else 0 end) +
                case when (k.bankalar is not null) then 1 else 0 end) +
                case when (k.pos_mulkiyet is not null) then 1 else 0 end) +
                case when ((k.pos_mulkiyet = 'Bankada'::text) and (k.pos_mulkiyet_bankalari is not null)) then 1 else 0 end) +
                case when (k.saha_hizmeti_firmasi is not null) then 1 else 0 end) +
                case when (k.genel_memnuniyet is not null) then 1 else 0 end) +
                case when (k.risk is not null) then 1 else 0 end) +
                case when (k.entegrasyon_yapisi is not null) then 1 else 0 end) +
                case when (k.problem_1 is not null) then 1 else 0 end) +
                case when (k.problem_2 is not null) then 1 else 0 end) +
                case when (k.problem_3 is not null) then 1 else 0 end) +
                case when (k.degisim_nedeni is not null) then 1 else 0 end) as filled_fields,
            (((((10 + 1) +
                case when (k.reyon_kullaniliyor = 'Evet'::text) then 4 else 0 end) + 1) +
                case when (k.el_terminali_kullaniliyor = 'Evet'::text) then 4 else 0 end) + 10) as total_fields
           from public.v_musteri_kunye_form k
        ), scored as (
         select b.musteri_id,
            b.firma_adi,
            b.sektor,
            b.musteri_account,
            b.kunye_id,
            b.magaza_sayisi,
            b.franchise_sayisi,
            b.sabit_kasa_adedi,
            b.kasapos_firmasi,
            b.pos_modeli,
            b.pos_markasi,
            b.toplam_pos_adedi,
            b.pos_alim_yili,
            b.sabit_bilgisayar_markasi,
            b.pos_notu,
            b.reyon_kullaniliyor,
            b.reyon_odeme_yazilimi,
            b.reyon_cihaz_modeli,
            b.reyon_cihaz_sayisi,
            b.reyon_alim_yili,
            b.el_terminali_kullaniliyor,
            b.el_terminali_modeli,
            b.el_terminali_yazilimi,
            b.el_terminali_adedi,
            b.el_terminali_alim_yili,
            b.erp,
            b.bankalar,
            b.pos_mulkiyet,
            b.pos_mulkiyet_bankalari,
            b.saha_hizmeti_firmasi,
            b.genel_memnuniyet,
            b.risk,
            b.entegrasyon_yapisi,
            b.problem_1,
            b.problem_2,
            b.problem_3,
            b.degisim_nedeni,
            b.created_at,
            b.updated_at,
            b.required_filled,
            b.filled_fields,
            b.total_fields,
            round((((b.filled_fields)::numeric / (greatest(b.total_fields, 1))::numeric) * (100)::numeric), 2) as completion_pct
           from base b
        )
 select musteri_id,
    firma_adi,
    sektor,
    musteri_account,
    kunye_id,
    magaza_sayisi,
    franchise_sayisi,
    sabit_kasa_adedi,
    kasapos_firmasi,
    pos_modeli,
    pos_markasi,
    toplam_pos_adedi,
    pos_alim_yili,
    sabit_bilgisayar_markasi,
    pos_notu,
    reyon_kullaniliyor,
    reyon_odeme_yazilimi,
    reyon_cihaz_modeli,
    reyon_cihaz_sayisi,
    reyon_alim_yili,
    el_terminali_kullaniliyor,
    el_terminali_modeli,
    el_terminali_yazilimi,
    el_terminali_adedi,
    el_terminali_alim_yili,
    erp,
    bankalar,
    pos_mulkiyet,
    pos_mulkiyet_bankalari,
    saha_hizmeti_firmasi,
    genel_memnuniyet,
    risk,
    entegrasyon_yapisi,
    problem_1,
    problem_2,
    problem_3,
    degisim_nedeni,
    created_at,
    updated_at,
    required_filled,
    filled_fields,
    total_fields,
    completion_pct,
        case
            when (required_filled <= 1) then 'yok'::text
            when (required_filled < 5) then 'eksik'::text
            when (completion_pct < (20)::numeric) then 'yok'::text
            when (completion_pct <= (60)::numeric) then 'eksik'::text
            else 'dolu'::text
        end as kunye_status
   from scored s;

drop view if exists public.vw_crm_musteriler cascade;
create view public.vw_crm_musteriler as
 select m.id as musteri_id,
    m.musteri,
    m.sektor,
    m.entegrasyon_tipi,
    m.satis_olasiligi as risk,
    m.sorumlu,
    mp.aktif_faz_no,
    ft.asama_adi as aktif_faz_adi,
    mp.durum as pipeline_durum,
    mp.updated_at as pipeline_guncelleme,
    pe.event_type as son_event_type,
    pe.notlar as son_not,
    pe.partner_owner as bekleyen_taraf,
    pe.created_at as son_event_zamani
   from (((public.musteriler m
     left join public.musteri_pipeline mp on ((mp.musteri_id = m.id)))
     left join public.faz_tanimlari ft on ((ft.faz_no = mp.aktif_faz_no)))
     left join lateral ( select pe_1.id,
            pe_1.musteri_id,
            pe_1.faz_no,
            pe_1.iteration_no,
            pe_1.event_type,
            pe_1.durum,
            pe_1.owner,
            pe_1.partner_owner,
            pe_1.baslangic_tarihi,
            pe_1.hedef_tarihi,
            pe_1.notlar,
            pe_1.payload,
            pe_1.created_at,
            pe_1.aksiyon
           from public.pipeline_eventleri pe_1
          where (pe_1.musteri_id = m.id)
          order by pe_1.created_at desc
         limit 1) pe on (true));

drop view if exists public.vw_crm_report_accounts cascade;
create view public.vw_crm_report_accounts as
 with latest_event as (
         select distinct on (pe.musteri_id) pe.musteri_id,
            pe.id as last_event_id,
            pe.faz_no as event_faz_no,
            pe.iteration_no,
            pe.event_type,
            pe.durum as event_durum,
            pe.aksiyon as son_aksiyon,
            pe.owner as event_owner,
            pe.partner_owner as event_partner_owner,
            pe.baslangic_tarihi as event_baslangic_tarihi,
            pe.hedef_tarihi as event_hedef_tarihi,
            pe.notlar as son_not,
            pe.created_at as son_aktivite_tarihi
           from public.pipeline_eventleri pe
          where (pe.musteri_id is not null)
          order by pe.musteri_id, pe.created_at desc, pe.id desc
        )
 select m.id as musteri_id,
    m.musteri,
    m.sektor,
    m.entegrasyon_tipi,
    m.sorumlu,
    coalesce(mp.aktif_faz_no, le.event_faz_no) as aktif_faz_no,
    ft.asama_adi as aktif_faz_adi,
    coalesce(mp.durum, le.event_durum, 'Devam Ediyor'::public.faz_durum_enum) as durum,
    coalesce(mp.owner, le.event_owner, ft.owner) as owner,
    coalesce(mp.partner_owner, le.event_partner_owner) as bekleyen_taraf,
    coalesce(mp.hedef_tarihi, le.event_hedef_tarihi) as hedef_tarihi,
    le.last_event_id,
    le.iteration_no,
    le.event_type as son_event_type,
    le.son_aksiyon,
    le.event_baslangic_tarihi as son_baslangic_tarihi,
    le.son_not,
    le.son_aktivite_tarihi
   from (((public.musteriler m
     left join public.musteri_pipeline mp on ((mp.musteri_id = m.id)))
     left join latest_event le on ((le.musteri_id = m.id)))
     left join public.faz_tanimlari ft on ((ft.faz_no = coalesce(mp.aktif_faz_no, le.event_faz_no))));

drop view if exists public.vw_crm_timeline cascade;
create view public.vw_crm_timeline as
 select pe.id as event_id,
    pe.musteri_id,
    pe.faz_no,
    ft.asama_adi as faz_adi,
    pe.iteration_no,
    pe.event_type,
    pe.durum,
    pe.aksiyon,
    pe.owner,
    pe.partner_owner,
    pe.baslangic_tarihi,
    pe.hedef_tarihi,
    pe.notlar,
    pe.created_at
   from (public.pipeline_eventleri pe
     left join public.faz_tanimlari ft on ((ft.faz_no = pe.faz_no)));

-- ---------------------------------------------------------------------
-- 8) FUNCTIONS (CREATE OR REPLACE)
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
    language plpgsql
    as $$
begin new.updated_at=now(); return new; end;
$$;

create or replace function public.update_kunye_updated_at() returns trigger
    language plpgsql
    as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_requests_updated_at() returns trigger
    language plpgsql
    as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.compute_requests_sla_status() returns trigger
    language plpgsql
    as $$
declare
  deadline timestamptz;
  hours_left numeric;
begin
  if new.sla_hours is null or new.status in ('resolved', 'closed') then
    if new.resolved_at is not null and new.sla_hours is not null then
      deadline := new.created_at + make_interval(hours => new.sla_hours);
      if new.resolved_at <= deadline then
        new.sla_status := 'on_time';
      else
        new.sla_status := 'breached';
      end if;
    else
      new.sla_status := 'na';
    end if;

    return new;
  end if;

  deadline := new.created_at + make_interval(hours => new.sla_hours);
  hours_left := extract(epoch from (deadline - now())) / 3600.0;

  if new.resolved_at is not null then
    new.sla_status := case
      when new.resolved_at <= deadline then 'on_time'
      else 'breached'
    end;
  elsif now() > deadline then
    new.sla_status := 'breached';
  elsif hours_left < (new.sla_hours * 0.25) then
    new.sla_status := 'at_risk';
  else
    new.sla_status := 'on_time';
  end if;

  return new;
end;
$$;

create or replace function public.log_crm_forecast_blocker_history() returns trigger
    language plpgsql
    as $$
begin
 if tg_op='DELETE' then
  insert into public.crm_forecast_blocker_history(blocker_id,customer_id,forecast_id,action,old_data,changed_by_email,changed_by_name)
  values(old.id,old.customer_id,old.forecast_id,'delete',to_jsonb(old),old.updated_by_email,old.updated_by_name); return old;
 end if;
 insert into public.crm_forecast_blocker_history(blocker_id,customer_id,forecast_id,action,old_data,new_data,changed_by_email,changed_by_name)
 values(new.id,new.customer_id,new.forecast_id,lower(tg_op),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),new.updated_by_email,new.updated_by_name); return new;
end
$$;

create or replace function public.rebuild_musteri_pipeline(p_musteri_id text) returns void
    language plpgsql
    as $$
declare
  v_row record;
begin
  select
    pe.musteri_id,
    pe.faz_no as aktif_faz_no,
    case
      when pe.durum is null then 'Devam Ediyor'::public.faz_durum_enum
      else pe.durum
    end as durum,
    coalesce(pe.owner, ft.owner) as owner,
    pe.partner_owner,
    pe.hedef_tarihi
  into v_row
  from public.pipeline_eventleri pe
  left join public.faz_tanimlari ft
    on ft.faz_no = pe.faz_no
  where pe.musteri_id::text = p_musteri_id
  order by
    pe.created_at desc,
    pe.id desc
  limit 1;

  if not found then
    delete from public.musteri_pipeline
    where musteri_id::text = p_musteri_id;
    return;
  end if;

  insert into public.musteri_pipeline (
    musteri_id,
    aktif_faz_no,
    durum,
    owner,
    partner_owner,
    hedef_tarihi,
    updated_at
  )
  values (
    v_row.musteri_id,
    v_row.aktif_faz_no,
    v_row.durum,
    v_row.owner,
    v_row.partner_owner,
    v_row.hedef_tarihi,
    now()
  )
  on conflict (musteri_id) do update
  set
    aktif_faz_no = excluded.aktif_faz_no,
    durum = excluded.durum,
    owner = excluded.owner,
    partner_owner = excluded.partner_owner,
    hedef_tarihi = excluded.hedef_tarihi,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.trg_sync_musteri_pipeline() returns trigger
    language plpgsql
    as $$
declare
  v_faz_owner text;
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_musteri_pipeline(old.musteri_id::text);
    return old;
  end if;

  if tg_op = 'INSERT' then
    select ft.owner
      into v_faz_owner
    from public.faz_tanimlari ft
    where ft.faz_no = new.faz_no;

    insert into public.musteri_pipeline (
      musteri_id,
      aktif_faz_no,
      durum,
      owner,
      partner_owner,
      hedef_tarihi,
      updated_at
    )
    values (
      new.musteri_id,
      new.faz_no,
      case
        when new.durum is null then 'Devam Ediyor'::public.faz_durum_enum
        else new.durum
      end,
      coalesce(new.owner, v_faz_owner),
      new.partner_owner,
      new.hedef_tarihi,
      now()
    )
    on conflict (musteri_id) do update
    set
      aktif_faz_no = excluded.aktif_faz_no,
      durum = excluded.durum,
      owner = excluded.owner,
      partner_owner = excluded.partner_owner,
      hedef_tarihi = excluded.hedef_tarihi,
      updated_at = excluded.updated_at;

    return new;
  end if;

  if old.musteri_id::text is distinct from new.musteri_id::text then
    perform public.rebuild_musteri_pipeline(old.musteri_id::text);
  end if;

  perform public.rebuild_musteri_pipeline(new.musteri_id::text);
  return new;
end;
$$;

create or replace function public.rls_auto_enable() returns event_trigger
    language plpgsql security definer
    set search_path to 'pg_catalog'
    as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$$;

create or replace function public.prevent_crm_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'crm_audit_events is append-only';
end;
$$;

-- ---------------------------------------------------------------------
-- 9) TRIGGERS (DROP IF EXISTS + CREATE — idempotent)
-- ---------------------------------------------------------------------
drop trigger if exists crm_forecast_blockers_history on public.crm_forecast_blockers;
create trigger crm_forecast_blockers_history
after insert or delete or update on public.crm_forecast_blockers
for each row execute function public.log_crm_forecast_blocker_history();

drop trigger if exists crm_forecast_blockers_touch_updated_at on public.crm_forecast_blockers;
create trigger crm_forecast_blockers_touch_updated_at
before update on public.crm_forecast_blockers
for each row execute function public.touch_updated_at();

drop trigger if exists crm_forecasts_touch_updated_at on public.crm_forecasts;
create trigger crm_forecasts_touch_updated_at
before update on public.crm_forecasts
for each row execute function public.touch_updated_at();

drop trigger if exists quote_products_touch_updated_at on public.quote_products;
create trigger quote_products_touch_updated_at
before update on public.quote_products
for each row execute function public.touch_updated_at();

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
before update on public.quotes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_pipeline_eventleri_sync_musteri_pipeline on public.pipeline_eventleri;
create trigger trg_pipeline_eventleri_sync_musteri_pipeline
after insert or delete or update on public.pipeline_eventleri
for each row execute function public.trg_sync_musteri_pipeline();

drop trigger if exists trg_requests_sla_status on public.requests;
create trigger trg_requests_sla_status
before insert or update on public.requests
for each row execute function public.compute_requests_sla_status();

drop trigger if exists trg_requests_updated_at on public.requests;
create trigger trg_requests_updated_at
before update on public.requests
for each row execute function public.set_requests_updated_at();

drop trigger if exists trg_update_kunye_updated_at on public.musteri_kunye;
create trigger trg_update_kunye_updated_at
before update on public.musteri_kunye
for each row execute function public.update_kunye_updated_at();

drop trigger if exists trg_update_musteri_kunye_v2_updated_at on public.musteri_kunye_v2;
create trigger trg_update_musteri_kunye_v2_updated_at
before update on public.musteri_kunye_v2
for each row execute function public.update_kunye_updated_at();

drop trigger if exists crm_audit_events_immutable on public.crm_audit_events;
create trigger crm_audit_events_immutable
before update or delete on public.crm_audit_events
for each row execute function public.prevent_crm_audit_mutation();

-- ---------------------------------------------------------------------
-- 10) ROW LEVEL SECURITY: enable + policies (DROP IF EXISTS + CREATE)
-- ---------------------------------------------------------------------
alter table public.allowed_users enable row level security;
alter table public.crm_audit_logs enable row level security;
alter table public.crm_forecast_blocker_history enable row level security;
alter table public.crm_forecast_blockers enable row level security;
alter table public.crm_forecasts enable row level security;
alter table public.crm_performance_snapshots enable row level security;
alter table public.crm_permissions enable row level security;
alter table public.crm_role_permissions enable row level security;
alter table public.crm_roles enable row level security;
alter table public.crm_target_metrics enable row level security;
alter table public.crm_target_revisions enable row level security;
alter table public.crm_targets enable row level security;
alter table public.crm_team_members enable row level security;
alter table public.crm_teams enable row level security;
alter table public.crm_tv_devices enable row level security;
alter table public.crm_user_permission_overrides enable row level security;
alter table public.crm_user_roles enable row level security;
alter table public.faz_hareketleri enable row level security;
alter table public.faz_tanimlari enable row level security;
alter table public.import_teknik_aktiviteler enable row level security;
alter table public.is_ortagi_faz_tanimlari enable row level security;
alter table public.musteri_account_change_requests enable row level security;
alter table public.musteri_kunye enable row level security;
alter table public.musteri_kunye_v2 enable row level security;
alter table public.musteri_pipeline enable row level security;
alter table public.musteriler enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.pipeline_eventleri enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_pricing_rules enable row level security;
alter table public.quote_products enable row level security;
alter table public.quotes enable row level security;
alter table public.request_categories enable row level security;
alter table public.request_events enable row level security;
alter table public.requests enable row level security;
alter table public.system_parameters enable row level security;
alter table public.teams enable row level security;
alter table public.user_sessions enable row level security;
alter table public.crm_target_definitions enable row level security;
alter table public.crm_target_values enable row level security;
alter table public.customer_phase_logs enable row level security;
alter table public.rbac_roles enable row level security;
alter table public.rbac_permissions enable row level security;
alter table public.rbac_role_permissions enable row level security;
alter table public.auth_rate_limits enable row level security;
alter table public.crm_audit_events enable row level security;
alter table public.auth_identities enable row level security;
alter table public.auth_group_role_mappings enable row level security;

drop policy if exists allowed_users_select_self on public.allowed_users;
create policy allowed_users_select_self on public.allowed_users for select to authenticated using ((email = (auth.jwt() ->> 'email'::text)));

drop policy if exists "anon read faz" on public.faz_tanimlari;
create policy "anon read faz" on public.faz_tanimlari for select to anon using (true);

drop policy if exists "anon read musteri" on public.musteriler;
create policy "anon read musteri" on public.musteriler for select to anon using (true);

drop policy if exists "anon read pipeline" on public.musteri_pipeline;
create policy "anon read pipeline" on public.musteri_pipeline for select to anon using (true);

drop policy if exists anon_insert_event on public.pipeline_eventleri;
create policy anon_insert_event on public.pipeline_eventleri for insert to anon with check (true);

drop policy if exists anon_read_faz on public.faz_tanimlari;
create policy anon_read_faz on public.faz_tanimlari for select to anon using (true);

drop policy if exists anon_read_musteriler on public.musteriler;
create policy anon_read_musteriler on public.musteriler for select to anon using (true);

drop policy if exists anon_read_pipeline on public.musteri_pipeline;
create policy anon_read_pipeline on public.musteri_pipeline for select to anon using (true);

drop policy if exists anon_update_pipeline on public.musteri_pipeline;
create policy anon_update_pipeline on public.musteri_pipeline for update to anon using (true) with check (true);

drop policy if exists pipeline_eventleri_insert_authenticated on public.pipeline_eventleri;
create policy pipeline_eventleri_insert_authenticated on public.pipeline_eventleri for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- 11) SEED DATA (yalnız INSERT ... ON CONFLICT DO NOTHING / DO UPDATE)
-- ---------------------------------------------------------------------

-- RBAC roller / izinler / atamalar (20260816_001).
insert into public.rbac_roles(role_key, label, description) values
  ('super_admin','Super Admin','Acil durum ve platform yönetimi'),
  ('admin','Admin','CRM ve kullanıcı yönetimi'),
  ('account_manager','Account Manager','Kendi müşteri portföyünü yönetir'),
  ('itsm','ITSM','Talep, operasyon ve parametre yönetimi'),
  ('user','Kullanıcı','Kendi taleplerini yönetir')
on conflict (role_key) do update set label = excluded.label, description = excluded.description;

insert into public.rbac_permissions(permission_key, module_key, label) values
  ('admin.users.manage','admin','Kullanıcı yönetimi'),
  ('admin.parameters.manage','admin','Parametre yönetimi'),
  ('admin.backup.execute','admin','Veritabanı yedeği'),
  ('admin.rbac.manage','admin','Rol ve yetki yönetimi'),
  ('admin.identity.manage','admin','Kurumsal kimlik sağlayıcı yönetimi'),
  ('customer.read','crm','Müşteri görüntüleme'),
  ('customer.read.any','crm','Tüm müşterileri görüntüleme'),
  ('customer.create','crm','Müşteri oluşturma'),
  ('customer.update.own','crm','Kendi müşterisini güncelleme'),
  ('customer.update.any','crm','Tüm müşterileri güncelleme'),
  ('customer.assign','crm','Müşteri sorumlusu atama'),
  ('customer.classification.manage','crm','Müşteri tipi/politika sınıflandırma'),
  ('activity.read','activity','Aktivite görüntüleme'),
  ('activity.read.any','activity','Tüm aktiviteleri görüntüleme'),
  ('activity.create','activity','Aktivite oluşturma'),
  ('activity.update.own','activity','Kendi aktivitesini güncelleme'),
  ('activity.update.any','activity','Tüm aktiviteleri güncelleme'),
  ('activity.technical.create','activity','Teknik aktivite oluşturma'),
  ('quote.read','quote','Teklif görüntüleme'),
  ('quote.read.any','quote','Tüm teklifleri görüntüleme'),
  ('quote.create','quote','Teklif oluşturma'),
  ('quote.update.own','quote','Kendi teklifini güncelleme'),
  ('quote.update.any','quote','Tüm teklifleri güncelleme'),
  ('quote.status.own','quote','Kendi teklif durumunu değiştirme'),
  ('quote.status.any','quote','Tüm teklif durumlarını değiştirme'),
  ('quote.catalog.manage','quote','Teklif ürün ve fiyat kataloğunu yönetme'),
  ('forecast.read','forecast','Forecast görüntüleme'),
  ('forecast.read.any','forecast','Tüm forecast kayıtlarını görüntüleme'),
  ('forecast.write.own','forecast','Kendi forecast kaydını yönetme'),
  ('forecast.write.any','forecast','Tüm forecast kayıtlarını yönetme'),
  ('report.read','report','Rapor görüntüleme'),
  ('report.read.own','report','Kendi raporunu görüntüleme'),
  ('report.read.team','report','Ekip raporunu görüntüleme'),
  ('report.read.all','report','Tüm raporları görüntüleme'),
  ('request.create','request','Talep oluşturma'),
  ('request.read.own','request','Kendi taleplerini görüntüleme'),
  ('request.read.all','request','Tüm talepleri görüntüleme'),
  ('request.comment.own','request','Kendi taleplerine yorum'),
  ('request.comment.all','request','Tüm taleplere yorum'),
  ('request.manage','request','Talep yönetimi'),
  ('screen.crm.dashboard.view','screen','Ekran: Komuta Merkezi'),
  ('screen.crm.customers.view','screen','Ekran: Müşteriler'),
  ('screen.crm.activities.view','screen','Ekran: Aktiviteler'),
  ('screen.crm.quotes.view','screen','Ekran: Teklifler'),
  ('screen.crm.forecast.view','screen','Ekran: Forecast'),
  ('screen.crm.blocker_impact.view','screen','Ekran: Engel & Etki'),
  ('screen.crm.sales_radar.view','screen','Ekran: Satış Radarı'),
  ('screen.reports.view','screen','Ekran: Rapor Merkezi'),
  ('screen.requests.view','screen','Ekran: Talepler'),
  ('screen.admin.users.view','screen','Ekran: Kullanıcı Yönetimi'),
  ('screen.admin.parameters.view','screen','Ekran: Parametre Yönetimi'),
  ('screen.admin.identity.view','screen','Ekran: Kurumsal Kimlik Yönetimi'),
  ('screen.admin.rbac.view','screen','Ekran: Rol ve Yetki Yönetimi'),
  ('screen.admin.backup.view','screen','Ekran: Veritabanı Yedeği'),
  ('screen.crm.nova_core.view','screen','Ekran: Nova Core'),
  ('screen.crm.sales_process.view','screen','Ekran: Satış Süreci'),
  ('screen.crm.customer_status_guide.view','screen','Ekran: Müşteri Durum Rehberi'),
  ('screen.crm.approvals.view','screen','Ekran: Onaylar'),
  ('screen.reports.user_activity.view','screen','Ekran: Kullanıcı Aktivite Sunumu')
on conflict (permission_key) do update set module_key = excluded.module_key, label = excluded.label;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'super_admin', permission_key from public.rbac_permissions
on conflict do nothing;

-- admin rolü bilinçli olarak wildcard degil, sabit bootstrap listesi kullanir:
-- yeni eklenen bir permission (ör. gelecekteki screen.*.view) admin'e OTOMATIK
-- verilmez; yalnizca Super Admin admin/rbac ekranindan acikca atarsa admin kazanir.
-- super_admin ise kod seviyesinde immutable ALL_PERMISSIONS (lib/authz.ts) oldugu
-- icin DB satirina bagimli degil; asagidaki wildcard seed onun icin zararsizdir.
-- Asagidaki admin/account_manager/itsm/user seed'leri SADECE ilk bootstrap'ta
-- (rol icin hic satir yokken) calisir: "not exists" guard'i sayesinde, Super
-- Admin bir rolun permission'larini bir kez configure ettikten (ekleyip/revoke
-- ettikten) sonra bu SQL o role bir daha asla dokunmaz — eksik/silinmis
-- permission'i geri eklemez, ON CONFLICT DO NOTHING tek basina bunu garanti
-- etmez cunku rol icin farkli bir permission satiri eksikse yine INSERT edilir.
insert into public.rbac_role_permissions(role_key, permission_key)
select 'admin', permission_key from public.rbac_permissions
where not exists (select 1 from public.rbac_role_permissions where role_key = 'admin')
and permission_key = any(array[
  'admin.users.manage','admin.parameters.manage','admin.backup.execute',
  'customer.read','customer.read.any','customer.create','customer.update.own','customer.update.any',
  'customer.assign','customer.classification.manage',
  'activity.read','activity.read.any','activity.create','activity.update.own','activity.update.any','activity.technical.create',
  'quote.read','quote.read.any','quote.create','quote.update.own','quote.update.any','quote.status.own','quote.status.any','quote.catalog.manage',
  'forecast.read','forecast.read.any','forecast.write.own','forecast.write.any',
  'report.read','report.read.own','report.read.team','report.read.all',
  'request.create','request.read.own','request.read.all','request.comment.own','request.comment.all','request.manage',
  'screen.crm.dashboard.view','screen.crm.customers.view','screen.crm.activities.view',
  'screen.crm.quotes.view','screen.crm.forecast.view','screen.crm.blocker_impact.view',
  'screen.crm.sales_radar.view','screen.reports.view','screen.requests.view',
  'screen.admin.users.view','screen.admin.parameters.view','screen.admin.backup.view',
  'screen.crm.nova_core.view','screen.crm.sales_process.view','screen.crm.customer_status_guide.view',
  'screen.crm.approvals.view','screen.reports.user_activity.view'
]::text[])
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'account_manager', permission_key from public.rbac_permissions
where not exists (select 1 from public.rbac_role_permissions where role_key = 'account_manager')
and permission_key = any(array[
  'customer.read','customer.read.any','customer.create','customer.update.own',
  'quote.read','quote.read.any','quote.create','quote.update.own','quote.status.own',
  'activity.read','activity.read.any','activity.create','activity.update.own',
  'forecast.read','forecast.write.own',
  'request.create','request.read.own','request.comment.own',
  'report.read.all',
  'screen.crm.dashboard.view','screen.crm.customers.view','screen.crm.activities.view',
  'screen.crm.quotes.view','screen.crm.forecast.view','screen.crm.blocker_impact.view',
  'screen.crm.sales_radar.view','screen.reports.view','screen.requests.view',
  'screen.crm.nova_core.view','screen.crm.sales_process.view','screen.crm.customer_status_guide.view'
]::text[])
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'itsm', permission_key from public.rbac_permissions
where not exists (select 1 from public.rbac_role_permissions where role_key = 'itsm')
and permission_key = any(array[
  'admin.parameters.manage','customer.read','customer.read.any',
  'activity.read','activity.read.any','activity.create','activity.update.any',
  'activity.technical.create','request.create','request.read.all','request.comment.all','request.manage'
  ,'quote.read','quote.read.any','forecast.read','forecast.read.any','report.read.all'
  ,'screen.crm.dashboard.view','screen.crm.customers.view','screen.crm.activities.view',
  'screen.crm.quotes.view','screen.crm.forecast.view','screen.reports.view',
  'screen.requests.view','screen.admin.parameters.view',
  'screen.crm.nova_core.view','screen.crm.sales_process.view','screen.crm.customer_status_guide.view'
]::text[])
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'user', permission_key from public.rbac_permissions
where not exists (select 1 from public.rbac_role_permissions where role_key = 'user')
and permission_key = any(array[
  'request.create','request.read.own','request.comment.own',
  'screen.requests.view'
]::text[])
on conflict do nothing;

-- Yeni minimal hedef alt sistemi seed (crm_minimal_targets_v1.sql).
insert into public.crm_target_definitions (code, name, description, unit, display_order)
values
  ('sales_revenue', 'Satış Cirosu', 'Kazanılan tekliflerden gelen toplam ciro', 'money', 10),
  ('device_count', 'Cihaz Adedi', 'Kazanılan tekliflerdeki toplam cihaz adedi', 'count', 20)
on conflict (code) do nothing;

-- requests_v1.sql başlangıç ekipleri / kategorileri.
insert into public.teams (name, description) values
  ('Sales',          'Satış ekibi'),
  ('Retail Support', 'Perakende destek ekibi'),
  ('Yönetim',        'Yönetici ve admin'),
  ('Teknik',         'Teknik destek')
on conflict do nothing;

insert into public.request_categories (name, description, sla_hours, color) values
  ('Teknik',      'Teknik destek ve yazılım talepleri',  4,  '#7c3aed'),
  ('Satış',       'Teklif, fiyat, müşteri talepleri',    8,  '#2563eb'),
  ('Operasyonel', 'Süreç, onay, koordinasyon',           24, '#059669'),
  ('Finans',      'Ödeme, fatura, muhasebe',             48, '#d97706'),
  ('Diğer',       'Kategorilendirilmemiş talepler',      24, '#64748b')
on conflict do nothing;

-- Forecast parametreleri (forecast_module_setup.sql).
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('forecast_sales_channel', 'banka', 'Banka', 'Banka', 10, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_sales_channel', 'direkt_satis', 'Direkt Satış', 'Direkt Satis', 20, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_sales_channel', 'kanal', 'Kanal', 'Kanal', 30, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '30', '%30', '30', 10, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '60', '%60', '60', 20, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb),
  ('forecast_probability', '90', '%90', '90', 30, '{"source":"seed","module":"CRM","category":"Forecast"}'::jsonb)
on conflict (group_key, param_key) do update set
  label = excluded.label,
  value = excluded.value,
  sort_order = excluded.sort_order,
  meta = coalesce(public.system_parameters.meta, '{}'::jsonb) || excluded.meta;

-- Genel/eski parametre kataloğu (system_parameters_setup.sql + 20260817_003, düzeltilmiş Türkçe).
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('activity_status', 'baslamadi', 'Başlamadı', 'Başlamadı', 10, '{"source":"seed"}'::jsonb),
  ('activity_status', 'bekleniyor', 'Bekleniyor', 'Bekleniyor', 20, '{"source":"seed"}'::jsonb),
  ('activity_status', 'devam_ediyor', 'Devam Ediyor', 'Devam Ediyor', 30, '{"source":"seed"}'::jsonb),
  ('activity_status', 'tamamlandi', 'Tamamlandı', 'Tamamlandı', 40, '{"source":"seed"}'::jsonb),
  ('activity_status', 'ihtiyac_duyulmadi', 'İhtiyaç Duyulmadı', 'İhtiyaç Duyulmadı', 50, '{"source":"seed"}'::jsonb),
  ('integration_type', 'a2a', 'A2A', 'A2A', 10, '{"source":"seed"}'::jsonb),
  ('integration_type', 'd2d', 'D2D', 'D2D', 20, '{"source":"seed"}'::jsonb),
  ('integration_type', 'd2d_a2a', 'D2D+A2A', 'D2D+A2A', 30, '{"source":"seed"}'::jsonb),
  ('sales_probability', 'dusuk', 'Düşük', 'Düşük', 10, '{"source":"seed"}'::jsonb),
  ('sales_probability', 'orta', 'Orta', 'Orta', 20, '{"source":"seed"}'::jsonb),
  ('sales_probability', 'yuksek', 'Yüksek', 'Yüksek', 30, '{"source":"seed"}'::jsonb),
  ('kunye_magaza_sayisi', '1_25', '1-25', '1-25', 10, '{"source":"seed"}'::jsonb),
  ('kunye_magaza_sayisi', '26_200', '26-200', '26-200', 20, '{"source":"seed"}'::jsonb),
  ('kunye_magaza_sayisi', '201_500', '201-500', '201-500', 30, '{"source":"seed"}'::jsonb),
  ('kunye_magaza_sayisi', '500', '500+', '500+', 40, '{"source":"seed"}'::jsonb),
  ('kunye_franchise_sayisi', 'yok', 'Yok', 'Yok', 10, '{"source":"seed"}'::jsonb),
  ('kunye_franchise_sayisi', '1_25', '1-25', '1-25', 20, '{"source":"seed"}'::jsonb),
  ('kunye_franchise_sayisi', '26_200', '26-200', '26-200', 30, '{"source":"seed"}'::jsonb),
  ('kunye_franchise_sayisi', '201_500', '201-500', '201-500', 40, '{"source":"seed"}'::jsonb),
  ('kunye_franchise_sayisi', '500', '500+', '500+', 50, '{"source":"seed"}'::jsonb),
  ('kunye_sabit_kasa_adedi', 'kullanilmiyor', 'Kullanılmıyor', 'Kullanılmıyor', 10, '{"source":"seed"}'::jsonb),
  ('kunye_sabit_kasa_adedi', '1_25', '1-25', '1-25', 20, '{"source":"seed"}'::jsonb),
  ('kunye_sabit_kasa_adedi', '26_200', '26-200', '26-200', 30, '{"source":"seed"}'::jsonb),
  ('kunye_sabit_kasa_adedi', '201_500', '201-500', '201-500', 40, '{"source":"seed"}'::jsonb),
  ('kunye_sabit_kasa_adedi', '500', '500+', '500+', 50, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'nebim', 'Nebim', 'Nebim', 10, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'toshiba', 'Toshiba', 'Toshiba', 20, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'echopos', 'Echopos', 'Echopos', 30, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'ncr', 'NCR', 'NCR', 40, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'encore', 'Encore', 'Encore', 50, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'enpos', 'Enpos', 'Enpos', 60, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'logo', 'Logo', 'Logo', 70, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'posback', 'Posback', 'Posback', 80, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'smartpos', 'Smartpos', 'Smartpos', 90, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'barsoft', 'Barsoft', 'Barsoft', 100, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'protel', 'Protel', 'Protel', 110, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'avion', 'Avion', 'Avion', 120, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'inhouse', 'Inhouse', 'Inhouse', 130, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'denpos', 'Denpos', 'Denpos', 140, '{"source":"seed"}'::jsonb),
  ('kunye_kasapos_firmasi', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_pos_modeli', 'okc', 'ÖKC', 'ÖKC', 10, '{"source":"seed"}'::jsonb),
  ('kunye_pos_modeli', 'eft', 'EFT', 'EFT', 20, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'ingenico', 'Ingenico', 'Ingenico', 10, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'verifone', 'Verifone', 'Verifone', 20, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'pax', 'PAX', 'PAX', 30, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'pavo', 'Pavo', 'Pavo', 40, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'hugin', 'Hugin', 'Hugin', 50, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'sunmi', 'Sunmi', 'Sunmi', 60, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'profilo', 'Profilo', 'Profilo', 70, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'beko', 'Beko', 'Beko', 80, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'vera', 'Vera', 'Vera', 90, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'inpos', 'Inpos', 'Inpos', 100, '{"source":"seed"}'::jsonb),
  ('kunye_pos_markasi', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_alim_yili', '1_yildan_az', '1 yıldan az', '1 yıldan az', 10, '{"source":"seed"}'::jsonb),
  ('kunye_alim_yili', '1_3_yil', '1-3 yıl', '1-3 yıl', 20, '{"source":"seed"}'::jsonb),
  ('kunye_alim_yili', '3_5_yil', '3-5 yıl', '3-5 yıl', 30, '{"source":"seed"}'::jsonb),
  ('kunye_alim_yili', '5_yil', '5+ yıl', '5+ yıl', 40, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'hp', 'HP', 'HP', 10, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'posback', 'Posback', 'Posback', 20, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'echopos', 'Echopos', 'Echopos', 30, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'toshiba', 'Toshiba', 'Toshiba', 40, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'enpos', 'Enpos', 'Enpos', 50, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'ncr', 'NCR', 'NCR', 60, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'encore', 'Encore', 'Encore', 70, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'dn', 'D&N', 'D&N', 80, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'oem', 'OEM', 'OEM', 90, '{"source":"seed"}'::jsonb),
  ('kunye_bilgisayar_markasi', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_evet_hayir', 'hayir', 'Hayır', 'Hayır', 10, '{"source":"seed"}'::jsonb),
  ('kunye_evet_hayir', 'evet', 'Evet', 'Evet', 20, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'logo', 'Logo', 'Logo', 10, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'nebim', 'Nebim', 'Nebim', 20, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'genius', 'Genius', 'Genius', 30, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'ncr', 'NCR', 'NCR', 40, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'tera', 'Tera', 'Tera', 50, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'enpos', 'Enpos', 'Enpos', 60, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'in_house', 'In House', 'In House', 70, '{"source":"seed"}'::jsonb),
  ('kunye_odeme_yazilimi', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'zebra', 'Zebra', 'Zebra', 10, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'honeywell', 'Honeywell', 'Honeywell', 20, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'datalogic', 'Datalogic', 'Datalogic', 30, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'newland', 'Newland', 'Newland', 40, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'sunmi', 'Sunmi', 'Sunmi', 50, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'pax', 'PAX', 'PAX', 60, '{"source":"seed"}'::jsonb),
  ('kunye_reyon_cihaz_modeli', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'honeywell', 'Honeywell', 'Honeywell', 10, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'idata', 'iData', 'iData', 20, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'disc', 'Disc', 'Disc', 30, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'zebra', 'Zebra', 'Zebra', 40, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'newland', 'Newland', 'Newland', 50, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'point_mobile', 'Point Mobile', 'Point Mobile', 60, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'urovo', 'Urovo', 'Urovo', 70, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'telefon', 'Telefon', 'Telefon', 80, '{"source":"seed"}'::jsonb),
  ('kunye_el_terminali_modeli', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'logo', 'Logo', 'Logo', 10, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'nebim', 'Nebim', 'Nebim', 20, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'genius', 'Genius', 'Genius', 30, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'ncr', 'NCR', 'NCR', 40, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'tera', 'Tera', 'Tera', 50, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'enpos', 'Enpos', 'Enpos', 60, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'mikro', 'Mikro', 'Mikro', 70, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'posback', 'Posback', 'Posback', 80, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'sap', 'SAP', 'SAP', 90, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'axapta', 'AXAPTA', 'AXAPTA', 100, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'oracle', 'Oracle', 'Oracle', 110, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'uyumsoft', 'Uyumsoft', 'Uyumsoft', 120, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'giz', 'Giz', 'Giz', 130, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'in_house', 'In House', 'In House', 140, '{"source":"seed"}'::jsonb),
  ('kunye_erp', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'akbank', 'Akbank', 'Akbank', 10, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'garanti_bbva', 'Garanti BBVA', 'Garanti BBVA', 20, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'is_bankasi', 'İş Bankası', 'İş Bankası', 30, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'yapi_kredi', 'Yapı Kredi', 'Yapı Kredi', 40, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'halkbank', 'Halkbank', 'Halkbank', 50, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'vakifbank', 'VakıfBank', 'VakıfBank', 60, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'ziraat_bankasi', 'Ziraat Bankası', 'Ziraat Bankası', 70, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'qnb', 'QNB', 'QNB', 80, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'teb', 'TEB', 'TEB', 90, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'denizbank', 'DenizBank', 'DenizBank', 100, '{"source":"seed"}'::jsonb),
  ('kunye_banka', 'aktifbank', 'AktifBank', 'AktifBank', 110, '{"source":"seed"}'::jsonb),
  ('kunye_pos_mulkiyet', 'kendisi', 'Kendisi', 'Kendisi', 10, '{"source":"seed"}'::jsonb),
  ('kunye_pos_mulkiyet', 'banka', 'Banka', 'Banka', 20, '{"source":"seed"}'::jsonb),
  ('kunye_pos_mulkiyet', 'bankada', 'Bankada', 'Bankada', 30, '{"source":"seed"}'::jsonb),
  ('kunye_saha_hizmeti_firmasi', 'bilinmiyor', 'Bilinmiyor', 'Bilinmiyor', 10, '{"source":"seed"}'::jsonb),
  ('kunye_saha_hizmeti_firmasi', 'teknoser', 'Teknoser', 'Teknoser', 20, '{"source":"seed"}'::jsonb),
  ('kunye_saha_hizmeti_firmasi', 'ibm', 'IBM', 'IBM', 30, '{"source":"seed"}'::jsonb),
  ('kunye_saha_hizmeti_firmasi', 'payser', 'Payser', 'Payser', 40, '{"source":"seed"}'::jsonb),
  ('kunye_saha_hizmeti_firmasi', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed"}'::jsonb),
  ('kunye_memnuniyet', 'memnun', 'Memnun', 'Memnun', 10, '{"source":"seed"}'::jsonb),
  ('kunye_memnuniyet', 'orta', 'Orta', 'Orta', 20, '{"source":"seed"}'::jsonb),
  ('kunye_memnuniyet', 'memnun_degil', 'Memnun Değil', 'Memnun Değil', 30, '{"source":"seed"}'::jsonb),
  ('crm_sector', 'perakende', 'Perakende', 'Perakende', 10, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'restoran', 'Restoran', 'Restoran', 20, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'market', 'Market', 'Market', 30, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'eczane', 'Eczane', 'Eczane', 40, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'giyim', 'Giyim', 'Giyim', 50, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'elektronik', 'Elektronik', 'Elektronik', 60, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'banka', 'Banka', 'Banka', 70, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'vertical', 'Vertical', 'Vertical', 80, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'hizmet', 'Hizmet', 'Hizmet', 90, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_sector', 'diger', 'Diğer', 'Diğer', 999, '{"source":"seed","module":"CRM","category":"Sektör"}'::jsonb),
  ('crm_integration_type', 'a2a', 'A2A', 'A2A', 10, '{"source":"seed","module":"CRM","category":"Entegrasyon"}'::jsonb),
  ('crm_integration_type', 'd2d', 'D2D', 'D2D', 20, '{"source":"seed","module":"CRM","category":"Entegrasyon"}'::jsonb),
  ('crm_integration_type', 'd2d_a2a', 'D2D+A2A', 'D2D+A2A', 30, '{"source":"seed","module":"CRM","category":"Entegrasyon"}'::jsonb),
  ('crm_sales_probability', 'dusuk', 'Düşük', 'Düşük', 10, '{"source":"seed","module":"CRM","category":"Satış Olasılığı"}'::jsonb),
  ('crm_sales_probability', 'orta', 'Orta', 'Orta', 20, '{"source":"seed","module":"CRM","category":"Satış Olasılığı"}'::jsonb),
  ('crm_sales_probability', 'yuksek', 'Yüksek', 'Yüksek', 30, '{"source":"seed","module":"CRM","category":"Satış Olasılığı"}'::jsonb),
  ('crm_customer_type', 'standard', 'Standart', 'standard', 10, '{"source":"seed","module":"CRM","category":"Müşteri Tipi"}'::jsonb),
  ('crm_customer_type', 'report_only', 'Sadece Rapor', 'report_only', 20, '{"source":"seed","module":"CRM","category":"Müşteri Tipi"}'::jsonb),
  ('crm_pipeline_policy', 'phase_required', 'Faz Zorunlu', 'phase_required', 10, '{"source":"seed","module":"CRM","category":"Pipeline Politikası"}'::jsonb),
  ('crm_pipeline_policy', 'phase_optional', 'Faz Opsiyonel', 'phase_optional', 20, '{"source":"seed","module":"CRM","category":"Pipeline Politikası"}'::jsonb),
  ('quote_probability', '10', '%10', '10', 10, '{"source":"seed","module":"Teklif"}'::jsonb),
  ('quote_probability', '30', '%30', '30', 20, '{"source":"seed","module":"Teklif"}'::jsonb),
  ('quote_probability', '60', '%60', '60', 30, '{"source":"seed","module":"Teklif"}'::jsonb),
  ('quote_probability', '90', '%90', '90', 40, '{"source":"seed","module":"Teklif"}'::jsonb),
  ('activity_waiting_party', 'musteri', 'Müşteri', 'Müşteri', 10, '{"source":"seed","module":"Aktivite"}'::jsonb),
  ('activity_waiting_party', 'pax', 'PAX', 'PAX', 20, '{"source":"seed","module":"Aktivite"}'::jsonb),
  ('activity_waiting_party', 'partner', 'Partner', 'Partner', 30, '{"source":"seed","module":"Aktivite"}'::jsonb),
  ('activity_waiting_party', 'banka', 'Banka', 'Banka', 40, '{"source":"seed","module":"Aktivite"}'::jsonb),
  ('system_jira_enabled', 'aktif', 'Aktif', 'true', 10, '{"source":"seed","module":"Sistem Davranışları","category":"Jira"}'::jsonb),
  ('system_jira_weekly_pptx_enabled', 'aktif', 'Aktif', 'true', 10, '{"source":"seed","module":"Sistem Davranışları","category":"Jira"}'::jsonb),
  ('system_jira_debug_enabled', 'aktif', 'Aktif', 'true', 10, '{"source":"seed","module":"Sistem Davranışları","category":"Jira"}'::jsonb),
  ('system_pptx_download_enabled', 'aktif', 'Aktif', 'true', 10, '{"source":"seed","module":"Sistem Davranışları","category":"Rapor / PPTX"}'::jsonb),
  -- system_oidc_enabled / system_oidc_group_role_sync_enabled BURADA SEED EDİLMEZ:
  -- tek kanonik satır aşağıdaki "Entra ID App Role tabanli SSO" seed bloğunda
  -- (param_key = group_key ile). İki ayrı param_key ile aynı group_key'e satır
  -- eklemek getSystemParameterValue()'nun (group_key bazlı, tek satır seçen)
  -- hangi değeri okuyacağını sort_order/label sırasına bırakır — duplicate seed yasak.
  ('system_page_size', '25', '25', '25', 10, '{"source":"seed","module":"Sistem Davranışları","category":"Performans"}'::jsonb)
on conflict (group_key, param_key) do nothing;

-- Teklif ürün kataloğu (quote_module_setup.sql).
insert into public.quote_products (code, name, category, product_type, unit_label, currency, is_recurring, billing_period, description, specs, sort_order, is_active)
values
('A80','PAX A80','EFT POS','device','adet','USD',false,'one_time','Android Desktop EFT POS','["Android 10","LAN","1GB + 8GB","4 inch TFT ekran"]',10,true),
('A6650','PAX A6650','EFT POS','device','adet','USD',false,'one_time','IP67 Android EFT POS','["Android 12","4GB + 64GB","6.5 inch ekran","IP67"]',20,true),
('A920PRO','PAX A920Pro','EFT POS','device','adet','USD',false,'one_time','Mobil Android EFT POS','["Android 8.1","4G + Wi-Fi","5.5 inch ekran"]',30,true),
('A77','PAX A77','EFT POS','device','adet','USD',false,'one_time','Android EFT POS','["Android 10","5 inch ekran"]',40,true),
('A910S','PAX A910S','EFT POS','device','adet','USD',false,'one_time','Android EFT POS','["Android 10","5 inch ekran"]',50,true),
('S210','PAX S210','EFT POS','peripheral','adet','USD',false,'one_time','Pinpad','["RunthOS","Temassiz","USB-C"]',60,true),
('ELYS-L1400','ELYS Station L1400','ELYS','device','adet','USD',false,'one_time','ELYS Station','["Android 11","14 inch IPS","4GB + 64GB"]',110,true),
('ELYS-A3700','ELYS Tablet A3700','ELYS','device','adet','USD',false,'one_time','ELYS Tablet','["Android 11","7 inch ekran","2GB + 16GB"]',120,true),
('ELYS-SET-5','ELYS 5li Set','ELYS','bundle','adet','USD',false,'one_time','Station + Tablet + Eye + Printer + Hub','["L1400 + A3700 + T3300 + T3180 + T3400"]',130,true),
('ELYS-SET-2','ELYS 2li Set','ELYS','bundle','adet','USD',false,'one_time','Station + Tablet','["L1400 + A3700"]',140,true),
('ELYS-EYE-T3320','ELYS Eye T3320 - No Display','ELYS','peripheral','adet','USD',false,'one_time','No Display Eye','["Bluetooth + USB","0.3MP"]',150,true),
('ELYS-EYE-TOUCH-T3300','ELYS Eye Touch T3300','ELYS','peripheral','adet','USD',false,'one_time','Dokunmatik Eye','["1.54 inch ekran","2MP"]',160,true),
('ELYS-HUB-T3400','ELYS Hub T3400','ELYS','peripheral','adet','USD',false,'one_time','Hub','["2x USB-C","4x USB-A"]',170,true),
('ELYS-PRINTER-T3180','ELYS Printer T3180','ELYS','peripheral','adet','USD',false,'one_time','Printer','["203 dpi","260 mm/s"]',180,true),
('ELYS-TOWER-L1450','ELYS Tower L1450','ELYS','device','adet','USD',false,'one_time','ELYS Tower','["Android 13","14 inch ekran"]',190,true),
('ELYS-LITCHI-L1600','ELYS Litchi L1600','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1600','["Android 12","15.6 inch IPS"]',200,true),
('ELYS-LITCHI-L1601','ELYS Litchi L1601','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1601','["Cift ekran"]',210,true),
('ELYS-LITCHI-L1602','ELYS Litchi L1602','ELYS','device','adet','USD',false,'one_time','ELYS Litchi L1602','["Cift 15.6 inch ekran"]',220,true),
('SK700','SK700 Kiosk','ELYS','device','adet','USD',false,'one_time','Self-service kiosk','["21.5 inch ekran","IM30"]',230,true),
('KASAPOS-TMS','Kasapos + TMS','Service','recurring','adet','USD',true,'monthly','Aylik entegrasyon ve TMS','["Terminal basina aylik"]',300,true),
('PAX-PLATFORM','PAX Platform','Service','recurring','adet','USD',true,'monthly','Aylik platform lisansi','["Terminal basina aylik"]',310,true)
on conflict (code) do update set name = excluded.name, category = excluded.category, product_type = excluded.product_type, description = excluded.description, specs = excluded.specs, sort_order = excluded.sort_order, is_active = excluded.is_active;

insert into public.quote_pricing_rules (product_id, min_qty, max_qty, unit_price)
select p.id, v.min_qty, v.max_qty, v.unit_price
from (values
('A80',1,25,234),('A80',26,200,211),('A80',201,500,199),('A80',501,null,187),
('A6650',1,25,704),('A6650',26,200,634),('A6650',201,500,598),('A6650',501,null,563),
('A920PRO',1,25,312),('A920PRO',26,200,281),('A920PRO',201,500,266),('A920PRO',501,null,250),
('A77',1,25,264),('A77',26,200,238),('A77',201,500,224),('A77',501,null,211),
('A910S',1,25,209),('A910S',26,200,188),('A910S',201,500,178),('A910S',501,null,167),
('S210',1,null,77),
('ELYS-L1400',1,50,615),('ELYS-L1400',51,100,605),('ELYS-L1400',101,null,595),
('ELYS-A3700',1,50,550),('ELYS-A3700',51,100,540),('ELYS-A3700',101,null,530),
('ELYS-SET-5',1,50,1450),('ELYS-SET-5',51,100,1430),('ELYS-SET-5',101,null,1410),
('ELYS-SET-2',1,50,1150),('ELYS-SET-2',51,100,1130),('ELYS-SET-2',101,null,1110),
('ELYS-EYE-T3320',1,null,55),('ELYS-EYE-TOUCH-T3300',1,null,150),('ELYS-HUB-T3400',1,null,80),('ELYS-PRINTER-T3180',1,null,185),
('ELYS-TOWER-L1450',1,50,900),('ELYS-TOWER-L1450',51,100,890),('ELYS-TOWER-L1450',101,null,880),
('ELYS-LITCHI-L1600',1,50,590),('ELYS-LITCHI-L1600',51,100,580),('ELYS-LITCHI-L1600',101,null,570),
('ELYS-LITCHI-L1601',1,50,695),('ELYS-LITCHI-L1601',51,100,685),('ELYS-LITCHI-L1601',101,null,675),
('ELYS-LITCHI-L1602',1,50,815),('ELYS-LITCHI-L1602',51,100,805),('ELYS-LITCHI-L1602',101,null,795),
('SK700',1,10,2550),('SK700',11,100,2440),('SK700',101,null,2210),
('KASAPOS-TMS',1,200,12),('KASAPOS-TMS',201,500,11),('KASAPOS-TMS',501,null,10),
('PAX-PLATFORM',1,null,4)
) as v(code, min_qty, max_qty, unit_price)
join public.quote_products p on p.code = v.code
where not exists (
  select 1 from public.quote_pricing_rules r
  where r.product_id = p.id and r.min_qty = v.min_qty and coalesce(r.max_qty, -1) = coalesce(v.max_qty, -1)
);

-- =====================================================================
-- Entra ID App Role tabanli SSO icin sistem parametre seed'i (eski 005).
-- Idempotent: tekrar calistirilabilir, mevcut kayitlari degistirmez.
-- =====================================================================

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('system_oidc_enabled', 'system_oidc_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_app_role_sync_enabled', 'system_oidc_app_role_sync_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_group_role_sync_enabled', 'system_oidc_group_role_sync_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004'))
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('system_oidc_app_role_mapping', 'crm_super_admin', 'crm.super_admin', 'super_admin', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_app_role_mapping', 'crm_admin', 'crm.admin', 'admin', 20, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_app_role_mapping', 'crm_itsm', 'crm.itsm', 'itsm', 30, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_app_role_mapping', 'crm_account_manager', 'crm.account_manager', 'account_manager', 40, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004')),
  ('system_oidc_app_role_mapping', 'crm_user', 'crm.user', 'user', 50, true, jsonb_build_object('source', 'seed', 'migration', '20260818_004'))
on conflict (group_key, param_key) do nothing;

-- system_oidc_app_role_sync_enabled / system_oidc_app_role_mapping TEK authorization
-- otoritesidir (lib/auth/oidc.ts resolveEnterpriseUser id_token.roles claim'ini bu
-- eşlemeden geçirir). IT tarafında kullanıcılara AD grubu değil doğrudan Entra App
-- Role atandığı için sync varsayılan olarak açık tutulur.
update public.system_parameters
set value = 'true', meta = (meta - 'deprecated' - 'note') || jsonb_build_object('source', 'seed', 'migration', '20260818_004')
where group_key = 'system_oidc_app_role_sync_enabled'
  and param_key = 'system_oidc_app_role_sync_enabled';

-- =====================================================================
-- SONU
-- =====================================================================
