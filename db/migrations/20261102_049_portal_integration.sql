-- PAX Portal → CRM olay alındıları. eventId ile idempotent: aynı olay iki kez aktivite yazmaz.
-- Aktivitenin kendisi pipeline_eventleri'ne yazılır (aksiyon='AKTIVITE:Portal', affects_phase=false).
-- Tekrar çalıştırılabilir; silme/düşürme yok.

create table if not exists public.portal_event_receipts (
  event_id uuid primary key,
  crm_firm_id uuid not null references public.musteriler(id),
  pipeline_event_id uuid references public.pipeline_eventleri(id),
  event_type text not null,
  occurred_at timestamptz not null,
  backfill boolean not null default false,
  received_at timestamptz not null default now()
);

create index if not exists portal_event_receipts_firm_idx
  on public.portal_event_receipts (crm_firm_id, occurred_at desc);

comment on table public.portal_event_receipts
  is 'PAX Portal olay alındıları (idempotency). Kişisel veri tutulmaz; ayrıntı pipeline_eventleri.payload içindedir.';
