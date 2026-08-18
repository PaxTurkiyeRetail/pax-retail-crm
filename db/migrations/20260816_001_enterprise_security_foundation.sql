create extension if not exists pgcrypto;

create table if not exists public.system_parameters (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  param_key text not null,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, param_key)
);

create index if not exists idx_system_parameters_group_active_sort
  on public.system_parameters (group_key, is_active, sort_order, label);

-- Kişi adına bağlı iş akışı istisnaları kurumsal modele taşınmadığı için
-- artık okunmaz; eski kayıtlar da yönetim ekranına geri dönmesin.
delete from public.system_parameters
where group_key = 'crm_phase_optional_responsibles';

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
  ('request.create','request','Talep oluşturma'),
  ('request.read.own','request','Kendi taleplerini görüntüleme'),
  ('request.read.all','request','Tüm talepleri görüntüleme'),
  ('request.comment.own','request','Kendi taleplerine yorum'),
  ('request.comment.all','request','Tüm taleplere yorum'),
  ('request.manage','request','Talep yönetimi')
on conflict (permission_key) do update set module_key = excluded.module_key, label = excluded.label;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'super_admin', permission_key from public.rbac_permissions
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'admin', permission_key from public.rbac_permissions
where permission_key not in ('admin.rbac.manage','admin.identity.manage')
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'account_manager', permission_key from public.rbac_permissions
where permission_key = any(array[
  'customer.read','customer.read.any','customer.create','customer.update.own',
  'quote.read','quote.read.any','quote.create','quote.update.own','quote.status.own',
  'activity.read','activity.read.any','activity.create','activity.update.own',
  'forecast.read','forecast.write.own',
  'request.create','request.read.own','request.comment.own'
]::text[])
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'itsm', permission_key from public.rbac_permissions
where permission_key = any(array[
  'admin.parameters.manage','customer.read','customer.read.any',
  'activity.read','activity.read.any','activity.create','activity.update.any',
  'activity.technical.create','request.create','request.read.all','request.comment.all','request.manage'
  ,'quote.read','quote.read.any','forecast.read','forecast.read.any'
]::text[])
on conflict do nothing;

insert into public.rbac_role_permissions(role_key, permission_key)
select 'user', permission_key from public.rbac_permissions
where permission_key = any(array['request.create','request.read.own','request.comment.own']::text[])
on conflict do nothing;

create table if not exists public.auth_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (key_hash, action, window_start)
);

create index if not exists auth_rate_limits_expires_at_idx
  on public.auth_rate_limits (expires_at);

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

create index if not exists crm_audit_events_actor_created_idx
  on public.crm_audit_events (actor_id, created_at desc);
create index if not exists crm_audit_events_resource_created_idx
  on public.crm_audit_events (resource_type, resource_id, created_at desc);
create index if not exists crm_audit_events_action_created_idx
  on public.crm_audit_events (action, created_at desc);

create or replace function public.prevent_crm_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'crm_audit_events is append-only';
end;
$$;

drop trigger if exists crm_audit_events_immutable on public.crm_audit_events;
create trigger crm_audit_events_immutable
before update or delete on public.crm_audit_events
for each row execute function public.prevent_crm_audit_mutation();

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

create index if not exists auth_identities_user_id_idx on public.auth_identities (user_id);

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

alter table if exists public.user_sessions
  add column if not exists session_token_hash text;

update public.user_sessions
set session_token_hash = encode(digest(session_token, 'sha256'), 'hex')
where session_token_hash is null and session_token is not null;

alter table if exists public.user_sessions
  alter column session_token drop not null;

alter table if exists public.user_sessions
  drop constraint if exists user_sessions_session_token_key;

create unique index if not exists user_sessions_session_token_hash_uidx
  on public.user_sessions (session_token_hash)
  where session_token_hash is not null;
create index if not exists user_sessions_expires_at_idx on public.user_sessions (expires_at);

-- Geçiş sırasında eski uygulama instance'ları session_token okumaya devam eder.
-- Düz metin kolonunun temizliği, bütün instance'lar hash sürümüne geçtikten sonra
-- ayrı ve geri alınabilir bir contract migration ile yapılacaktır.

-- Bazı canlı kurulumlarda parola sıfırlama tablosu hiç oluşturulmamış olabilir.
-- Tabloyu burada oluşturmak, migration öncesinde çalışmayan parola sıfırlama
-- özelliğini güvenli şekilde devreye alır ve mevcut kurulumları değiştirmez.
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users(id) on delete cascade,
  token text,
  token_hash text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists public.password_reset_tokens
  add column if not exists token_hash text;

update public.password_reset_tokens
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token_hash is null and token is not null;

alter table if exists public.password_reset_tokens
  alter column token drop not null;

alter table if exists public.password_reset_tokens
  drop constraint if exists password_reset_tokens_token_key;

create unique index if not exists password_reset_tokens_token_hash_uidx
  on public.password_reset_tokens (token_hash)
  where token_hash is not null;
create unique index if not exists password_reset_tokens_token_uidx
  on public.password_reset_tokens (token)
  where token is not null;
create index if not exists password_reset_tokens_expires_at_idx on public.password_reset_tokens (expires_at);

-- Eski instance uyumluluğu için token bu genişletme migration'ında korunur.
-- Hash sürümünün tam yayılımından sonra ayrı contract migration ile temizlenir.

do $$
begin
  if to_regclass('public.allowed_users') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.allowed_users'::regclass
         and conname = 'allowed_users_role_enterprise_check'
     ) then
    alter table public.allowed_users
      add constraint allowed_users_role_enterprise_check
      check (role in ('super_admin', 'admin', 'account_manager', 'itsm', 'user')) not valid;
    alter table public.allowed_users validate constraint allowed_users_role_enterprise_check;
  end if;
end $$;

-- Eski ekip özelindeki kişi/sektör tabanlı künye engellerini güvenle kaldır.
-- Erişim kontrolü bundan sonra RBAC ve owner_user_id kapsamıyla uygulanır.
do $$
begin
  if to_regclass('public.musteri_kunye') is not null then
    execute 'drop trigger if exists trg_prevent_report_only_kunye on public.musteri_kunye';
  end if;

  if to_regclass('public.musteri_kunye_v2') is not null then
    execute 'drop trigger if exists trg_prevent_report_only_kunye_v2 on public.musteri_kunye_v2';
  end if;
end $$;

drop function if exists public.prevent_report_only_kunye();

-- Uygulama sahiplik kapsamını bu kolonlardan okur. Eski ortamlarda kolonlar
-- manuel SQL ile açılmış olabilir; migration her iki durumu da güvenle destekler.
alter table if exists public.musteriler
  add column if not exists owner_user_id uuid null;

alter table if exists public.quotes
  add column if not exists owner_user_id text null;

do $$
begin
  if to_regclass('public.musteriler') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'musteriler' and column_name = 'owner_user_id'
     ) then
    update public.musteriler m
    set owner_user_id = u.id
    from public.allowed_users u
    where m.owner_user_id is null
      and (
        lower(trim(coalesce(m.sorumlu, ''))) = lower(trim(coalesce(u.full_name, '')))
        or lower(trim(coalesce(m.sorumlu, ''))) = lower(trim(coalesce(u.email, '')))
      );
    create index if not exists musteriler_owner_user_id_idx on public.musteriler (owner_user_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.quotes') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'quotes' and column_name = 'owner_user_id'
     ) then
    update public.quotes q
    set owner_user_id = u.id::text
    from public.allowed_users u
    where q.owner_user_id is null
      and (
        lower(trim(coalesce(q.owner_name, ''))) = lower(trim(coalesce(u.full_name, '')))
        or lower(trim(coalesce(q.owner_email, ''))) = lower(trim(coalesce(u.email, '')))
      );
    create index if not exists quotes_owner_user_id_idx on public.quotes (owner_user_id);
  end if;
end $$;
