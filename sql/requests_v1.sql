-- ═══════════════════════════════════════════════
-- REQUEST INTELLIGENCE SYSTEM — Faz 1
-- AI-ready altyapı, manuel giriş ile başlar
-- ═══════════════════════════════════════════════

-- ── Teams ──────────────────────────────────────
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  routing_rules jsonb default '{}',   -- Faz 4: AI yönlendirme kuralları
  created_at  timestamptz not null default now()
);

-- Başlangıç ekipleri
insert into teams (name, description) values
  ('Sales',          'Satış ekibi'),
  ('Retail Support', 'Perakende destek ekibi'),
  ('Yönetim',        'Yönetici ve admin'),
  ('Teknik',         'Teknik destek')
on conflict do nothing;

-- ── Request Categories ─────────────────────────
create table if not exists request_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  description     text,
  sla_hours       int4 not null default 24,
  default_team_id uuid references teams(id),
  color           text default '#2563eb',
  created_at      timestamptz not null default now()
);

insert into request_categories (name, description, sla_hours, color) values
  ('Teknik',      'Teknik destek ve yazılım talepleri',  4,  '#7c3aed'),
  ('Satış',       'Teklif, fiyat, müşteri talepleri',    8,  '#2563eb'),
  ('Operasyonel', 'Süreç, onay, koordinasyon',           24, '#059669'),
  ('Finans',      'Ödeme, fatura, muhasebe',             48, '#d97706'),
  ('Diğer',       'Kategorilendirilmemiş talepler',      24, '#64748b')
on conflict do nothing;

-- ── Requests (core table) ──────────────────────
create table if not exists requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Kim → Kime
  requester_id    uuid not null references auth.users(id),
  requester_name  text,                          -- denormalize: hız için
  assignee_id     uuid references auth.users(id),
  assignee_name   text,                          -- denormalize
  assignee_source text not null default 'manual' check (assignee_source in ('manual','ai_suggested','ai_auto')),
  team_id         uuid references teams(id),

  -- Ne istendiği
  title           text not null,
  body            text not null,
  category_id     uuid references request_categories(id),
  priority        text not null default 'medium' check (priority in ('low','medium','high','critical')),
  tags            text[] default '{}',

  -- Kaynak kanal (AI için — Faz 1: hep manual)
  channel         text not null default 'manual' check (channel in ('manual','whatsapp','email','system')),
  source_ref      text,                          -- Faz 2+: mesaj ID / thread ID
  source_metadata jsonb default '{}',            -- Faz 2+: kanal detayları

  -- Zaman & SLA
  due_at          timestamptz,
  first_response_at timestamptz,
  resolved_at     timestamptz,
  sla_hours       int4,                          -- kategori'den kopyalanır
  sla_status      text not null default 'on_time' check (sla_status in ('on_time','at_risk','breached','na')),

  -- Durum
  status          text not null default 'open' check (status in ('open','assigned','in_progress','waiting','resolved','closed')),
  resolution_note text,

  -- AI metadata (Faz 2+, şimdi boş kalır)
  ai_intent               text,
  ai_confidence           float4,
  ai_suggested_assignee   uuid,
  ai_suggested_category   text,
  ai_raw_response         jsonb
);

-- updated_at auto-trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists requests_updated_at on requests;
create trigger requests_updated_at
  before update on requests
  for each row execute function set_updated_at();

-- SLA status auto-compute trigger
create or replace function compute_sla_status()
returns trigger language plpgsql as $$
declare
  deadline timestamptz;
  hours_left float;
begin
  if new.sla_hours is null or new.status in ('resolved','closed') then
    new.sla_status := 'na';
    return new;
  end if;
  deadline := new.created_at + (new.sla_hours || ' hours')::interval;
  hours_left := extract(epoch from (deadline - now())) / 3600;
  if new.resolved_at is not null then
    new.sla_status := case when new.resolved_at <= deadline then 'on_time' else 'breached' end;
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

drop trigger if exists requests_sla on requests;
create trigger requests_sla
  before insert or update on requests
  for each row execute function compute_sla_status();

-- ── Request Events (audit log) ─────────────────
create table if not exists request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests(id) on delete cascade,
  actor_id    uuid references auth.users(id),    -- null = sistem / AI
  actor_name  text,
  event_type  text not null check (event_type in (
    'created','assigned','reassigned','status_changed',
    'comment','priority_changed','due_changed','ai_action'
  )),
  payload     jsonb not null default '{}',        -- { from, to } veya { comment } vb.
  created_at  timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────
create index if not exists idx_requests_status       on requests(status);
create index if not exists idx_requests_assignee     on requests(assignee_id);
create index if not exists idx_requests_requester    on requests(requester_id);
create index if not exists idx_requests_sla          on requests(sla_status);
create index if not exists idx_requests_created      on requests(created_at desc);
create index if not exists idx_request_events_req    on request_events(request_id, created_at desc);

-- ── RLS ────────────────────────────────────────
alter table requests enable row level security;
alter table request_events enable row level security;
alter table teams enable row level security;
alter table request_categories enable row level security;

-- Authenticated users can read all (panel app handles role filtering)
create policy "requests_read"  on requests         for select using (auth.role() = 'authenticated');
create policy "requests_write" on requests         for all    using (auth.role() = 'authenticated');
create policy "events_read"    on request_events   for select using (auth.role() = 'authenticated');
create policy "events_write"   on request_events   for all    using (auth.role() = 'authenticated');
create policy "teams_read"     on teams            for select using (auth.role() = 'authenticated');
create policy "cats_read"      on request_categories for select using (auth.role() = 'authenticated');
