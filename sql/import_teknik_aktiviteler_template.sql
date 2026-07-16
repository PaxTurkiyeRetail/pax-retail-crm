create table if not exists public.import_teknik_aktiviteler (
  id bigserial primary key,
  musteri_adi text not null,
  aktivite_tipi text not null check (aktivite_tipi in ('Teknik Ziyaret', 'Teknik Online', 'POM')),
  notlar text,
  created_by text,
  created_at timestamptz
);

select i.*
from public.import_teknik_aktiviteler i
left join public.musteriler m
  on lower(trim(m.musteri)) = lower(trim(i.musteri_adi))
left join public.musteri_pipeline mp
  on mp.musteri_id = m.musteri_id
where m.musteri_id is null
   or mp.aktif_faz_no is null;

insert into public.pipeline_eventleri (
  musteri_id, faz_no, iteration_no, event_type, durum, aksiyon, owner,
  partner_owner, baslangic_tarihi, hedef_tarihi, notlar, created_by,
  created_at, activity_scope, affects_phase
)
select
  m.musteri_id,
  mp.aktif_faz_no,
  coalesce(last_event.iteration_no, 1),
  'note_added',
  coalesce(mp.durum, 'Devam Ediyor'),
  'AKTIVITE:' || i.aktivite_tipi,
  mp.owner,
  mp.partner_owner,
  null,
  null,
  nullif(trim(coalesce(i.notlar, '')), ''),
  coalesce(nullif(trim(i.created_by), ''), 'Teknik Ekip Import'),
  coalesce(i.created_at, now()),
  'technical',
  false
from public.import_teknik_aktiviteler i
join public.musteriler m
  on lower(trim(m.musteri)) = lower(trim(i.musteri_adi))
join public.musteri_pipeline mp
  on mp.musteri_id = m.musteri_id
left join lateral (
  select pe.iteration_no
  from public.pipeline_eventleri pe
  where pe.musteri_id = m.musteri_id
    and pe.faz_no = mp.aktif_faz_no
  order by pe.created_at desc
  limit 1
) last_event on true
where mp.aktif_faz_no is not null;
