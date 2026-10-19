-- 20261019_047_report_builder.sql — Report Builder tabloları (idempotent).

-- CRM_APPEND_MIGRATION: 20261019_045_report_builder.sql
-- Rapor Geliştirme Aracı (Report Builder) kalıcılık şeması. Tamamen idempotent; mevcut tablolara dokunmaz.
-- Silme yok: tanımlar is_archived ile, favoriler is_active ile kapatılır.
-- Uygulamada sahip id'si allowed_users.id (uuid) metin olarak tutulur (crm_* owner_user_id düzeniyle aynı).

create table if not exists public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  owner_user_id text not null,
  owner_name text,
  -- private: yalnız sahibi · roles: shared_roles içindeki roller · everyone: rapor yetkisi olan herkes
  visibility text not null default 'private',
  shared_roles text[] not null default '{}',
  -- Hazır rapor (geçiş planındaki "tek tanım" şablonları); herkes görür, satır kapsamı yine uygulanır.
  is_template boolean not null default false,
  template_key text,
  definition jsonb not null,
  version integer not null default 1,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint report_definitions_visibility_check check (visibility in ('private', 'roles', 'everyone'))
);

create index if not exists report_definitions_owner_idx on public.report_definitions (owner_user_id) where is_archived = false;
create index if not exists report_definitions_visibility_idx on public.report_definitions (visibility) where is_archived = false;
create unique index if not exists report_definitions_template_key_uidx on public.report_definitions (template_key) where template_key is not null;

create table if not exists public.report_definition_versions (
  definition_id uuid not null references public.report_definitions(id) on delete restrict,
  version integer not null,
  definition jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (definition_id, version)
);

create table if not exists public.report_favorites (
  user_id text not null,
  definition_id uuid not null references public.report_definitions(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, definition_id)
);

-- Sayfalar (designer): 12 kolon grid layout JSON'u (lib/report-builder/page-types.ts).
create table if not exists public.report_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_user_id text not null,
  owner_name text,
  visibility text not null default 'private',
  shared_roles text[] not null default '{}',
  is_template boolean not null default false,
  template_key text,
  page jsonb not null,
  version integer not null default 1,
  letterhead_id uuid,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint report_pages_visibility_check check (visibility in ('private', 'roles', 'everyone'))
);
create index if not exists report_pages_owner_idx on public.report_pages (owner_user_id) where is_archived = false;
create unique index if not exists report_pages_template_key_uniq on public.report_pages (template_key) where template_key is not null;

create table if not exists public.report_page_versions (
  page_id uuid not null references public.report_pages(id) on delete restrict,
  version integer not null,
  page jsonb not null,
  title text not null,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (page_id, version)
);

-- Antetler: görsel (PNG/JPG/tek sayfa PDF) bytea; yönetim report.letterhead.manage.
create table if not exists public.report_letterheads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text not null,
  image_data bytea not null,
  byte_size integer not null,
  orientation text not null default 'portrait',
  margins_mm jsonb not null default '{"top":15,"right":15,"bottom":15,"left":15}'::jsonb,
  safe_area_mm jsonb not null default '{"top":0,"bottom":0}'::jsonb,
  show_title boolean not null default true,
  show_date boolean not null default true,
  show_page_numbers boolean not null default true,
  footer_text text not null default '',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  constraint report_letterheads_mime_check check (mime_type in ('image/png', 'image/jpeg', 'application/pdf')),
  constraint report_letterheads_size_check check (byte_size > 0 and byte_size <= 5242880),
  constraint report_letterheads_orientation_check check (orientation in ('portrait', 'landscape'))
);
create unique index if not exists report_letterheads_default_uniq on public.report_letterheads ((true)) where is_default = true and is_active = true;

-- Zamanlanmış çıktılar (ileride; şema rezervi).
create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.report_definitions(id) on delete restrict,
  owner_user_id text not null,
  cron text not null,
  format text not null default 'csv',
  recipients text[] not null default '{}',
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_schedules_format_check check (format in ('csv', 'xlsx', 'pdf'))
);

-- Rapor aracı yetkileri (super_admin otomatik; admin'e açıkça verilir).
insert into public.rbac_permissions(permission_key, module_key, label) values
  ('report.builder.design','report','Rapor tasarımcısı — sayfa düzenleme'),
  ('report.letterhead.manage','report','Rapor antetlerini yönetme')
on conflict (permission_key) do update set module_key = excluded.module_key, label = excluded.label;

insert into public.rbac_role_permissions(role_key, permission_key)
select r.role_key, p.permission_key
from (values ('admin'), ('super_admin')) as r(role_key)
cross join (values ('report.builder.design'), ('report.letterhead.manage')) as p(permission_key)
where exists (select 1 from public.rbac_roles x where x.role_key = r.role_key)
on conflict do nothing;
