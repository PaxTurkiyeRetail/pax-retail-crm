alter table public.pipeline_eventleri
  add column if not exists activity_scope text not null default 'account';

alter table public.pipeline_eventleri
  add column if not exists affects_phase boolean not null default true;

update public.pipeline_eventleri
set activity_scope = case
    when aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM') then 'technical'
    else coalesce(nullif(activity_scope, ''), 'account')
  end,
  affects_phase = case
    when aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM') then false
    else coalesce(affects_phase, true)
  end
where activity_scope is null
   or affects_phase is null
   or aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pipeline_eventleri_activity_scope_check'
  ) then
    alter table public.pipeline_eventleri
      add constraint pipeline_eventleri_activity_scope_check
      check (activity_scope in ('account', 'technical'));
  end if;
end $$;

create index if not exists idx_pipeline_eventleri_activity_scope
  on public.pipeline_eventleri(activity_scope);

create index if not exists idx_pipeline_eventleri_affects_phase
  on public.pipeline_eventleri(affects_phase);
