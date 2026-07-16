-- Kullanıcı Aktivite Sunumu için geçmiş kayıtları koruyan creator kimliği.
-- Rapor bu migration çalıştırılmadan da mevcut created_by / owner geçmişini okuyabilir.
-- Bu migration yeni kayıtların kimliğini sabitler ve güvenli eşleşebilen eski kayıtları UUID/e-posta ile zenginleştirir.
create extension if not exists pgcrypto;

alter table public.pipeline_eventleri
  add column if not exists created_by_user_id uuid null,
  add column if not exists created_by_email text null,
  add column if not exists updated_by_user_id uuid null,
  add column if not exists updated_by_email text null,
  add column if not exists updated_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_eventleri_created_by_user_id_fkey'
  ) then
    alter table public.pipeline_eventleri
      add constraint pipeline_eventleri_created_by_user_id_fkey
      foreign key (created_by_user_id) references public.allowed_users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_eventleri_updated_by_user_id_fkey'
  ) then
    alter table public.pipeline_eventleri
      add constraint pipeline_eventleri_updated_by_user_id_fkey
      foreign key (updated_by_user_id) references public.allowed_users(id) on delete set null;
  end if;
end $$;

create index if not exists idx_pipeline_eventleri_creator_date
  on public.pipeline_eventleri (created_by_user_id, created_at desc);

create index if not exists idx_pipeline_eventleri_creator_email_date
  on public.pipeline_eventleri (lower(created_by_email), created_at desc);

create index if not exists idx_pipeline_eventleri_legacy_creator_date
  on public.pipeline_eventleri (lower(trim(created_by)), created_at desc)
  where coalesce(aksiyon, '') like 'AKTIVITE:%';

-- Eski created_by alanında e-posta tutulmuş kayıtları doğrudan eşleştir.
update public.pipeline_eventleri pe
set
  created_by_user_id = u.id,
  created_by_email = u.email
from public.allowed_users u
where pe.created_by_user_id is null
  and nullif(trim(pe.created_by), '') is not null
  and lower(trim(pe.created_by)) = lower(trim(u.email));

-- Eski created_by alanında ad soyad bulunan kayıtları yalnızca tek kullanıcıyla eşleşiyorsa doldur.
with unique_names as (
  select
    lower(trim(full_name)) as normalized_name,
    (array_agg(id order by id))[1] as user_id,
    (array_agg(email order by email))[1] as email
  from public.allowed_users
  where nullif(trim(full_name), '') is not null
  group by lower(trim(full_name))
  having count(*) = 1
)
update public.pipeline_eventleri pe
set
  created_by_user_id = un.user_id,
  created_by_email = un.email
from unique_names un
where pe.created_by_user_id is null
  and lower(trim(coalesce(pe.created_by, ''))) = un.normalized_name;

comment on column public.pipeline_eventleri.created_by_user_id is 'Aktiviteyi ilk oluşturan kullanıcı. Düzenlemelerde değişmez.';
comment on column public.pipeline_eventleri.created_by_email is 'Aktiviteyi ilk oluşturan kullanıcının e-postası. Düzenlemelerde değişmez.';
comment on column public.pipeline_eventleri.updated_by_user_id is 'Kaydı en son düzenleyen kullanıcı.';
comment on column public.pipeline_eventleri.updated_by_email is 'Kaydı en son düzenleyen kullanıcının e-postası.';
