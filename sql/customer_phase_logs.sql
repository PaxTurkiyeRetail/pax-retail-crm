-- Future-ready phase history table
create table if not exists customer_phase_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  main_phase text not null,
  sub_phase integer not null,
  status text not null check (status in ('started','completed','reopened')),
  owner text null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_phase_logs_customer_created_at
  on customer_phase_logs(customer_id, created_at desc);
