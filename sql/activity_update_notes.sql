alter table public.pipeline_eventleri add column if not exists created_by text null;

-- Artık plan mantığı kullanılmıyorsa aşağıdaki kolonlar silinebilir:
alter table public.pipeline_eventleri
  drop column if exists plan_hedef_tarihi,
  drop column if exists plan_hedef_aksiyon,
  drop column if exists plan_bekleyen_taraf,
  drop column if exists plan_status,
  drop column if exists plan_done_at;

-- allowed_users.role için kullanılacak roller:
-- super_admin | admin | itsm | account_manager | user
