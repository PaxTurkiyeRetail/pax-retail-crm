-- POM teknik aktivite tipi patch
-- POM; Teknik Ziyaret / Teknik Online ile aynı davranır:
-- activity_scope = 'technical', affects_phase = false, faz/pipeline değiştirmez.

begin;

alter table public.pipeline_eventleri
  add column if not exists activity_scope text not null default 'account';

alter table public.pipeline_eventleri
  add column if not exists affects_phase boolean not null default true;

update public.pipeline_eventleri
set
  activity_scope = case
    when aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM') then 'technical'
    else coalesce(activity_scope, 'account')
  end,
  affects_phase = case
    when aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM') then false
    else coalesce(affects_phase, true)
  end
where activity_scope is null
   or affects_phase is null
   or aksiyon in ('AKTIVITE:Teknik Ziyaret', 'AKTIVITE:Teknik Online', 'AKTIVITE:POM');

commit;
