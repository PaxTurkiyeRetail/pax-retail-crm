-- İş Ortakları Faz Tanımları
-- Bu dosya tekrar çalıştırılabilir. Mevcut tablo/veri bozulmaz, duplicate kayıt üretmez.

create extension if not exists pgcrypto;

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
  on public.is_ortagi_faz_tanimlari (is_active, sort_order, faz_no);

-- Başlangıç seed'i özellikle eklenmedi.
-- Fazlar Parametreler ekranından yönetilecek.
