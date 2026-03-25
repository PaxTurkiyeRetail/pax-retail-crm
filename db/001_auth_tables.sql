create extension if not exists pgcrypto;

alter table public.allowed_users
  add column if not exists password_hash text;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users(id) on delete cascade,
  session_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_token
  on public.user_sessions(session_token);

create index if not exists idx_user_sessions_user_id
  on public.user_sessions(user_id);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_token
  on public.password_reset_tokens(token);

create index if not exists idx_password_reset_tokens_user_id
  on public.password_reset_tokens(user_id);
