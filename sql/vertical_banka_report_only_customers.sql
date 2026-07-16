-- BANKA / VERTICAL rapora özel müşteri yükleme + fazsız teknik aktivite desteği
-- Kaynak: RETAİL DESTEK RAPOR VERTİCAL BANKA.xlsx
-- Mantık:
-- 1) Bu müşteriler künye/faz/opportunity müşterisi değildir; müşteri adı büyük harfle tutulur.
-- 2) Künye tablosuna kayıt açılmaz.
-- 3) Normal CRM ekranlarından uygulama katmanında gizlenir; Yönetim Sunumu PPTX içinde
--    sadece İlerlemeler ve Yeni Temaslar verisini besler.
-- 4) Teknik aktivite fazı değiştirmez: activity_scope='technical', affects_phase=false.

begin;

with seed(musteri, sektor, sorumlu) as (
  values
    ('AKÖDE', 'BANKA', 'Cem Koç'),
    ('AVOLTA', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('BELBİM', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('BLADECO', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('BURULAS', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('COFFEWAR', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('DEFACTO', 'BANKA', 'Cem Koç'),
    ('ELARTEK', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('ELEKTROSOFT', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('ETİSAN', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('EVSE TEKNİK', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('FSM', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('HAVA İST', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('İPEKYOL', 'BANKA', 'Cem Koç'),
    ('KENT KART', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('MARKA MEŞRUBAT', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('MEDİCALPARK', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('MİLLİ SARAYLAR', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('OVOLT', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('PARAM', 'BANKA', 'Cem Koç'),
    ('POLİTEKNİK', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('QUAVİS', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('ROBİTECHNO', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('ROMSİS', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('SERİM', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('TCDD', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('TECHLİFE', 'VERTİCAL', 'Seda Kesikoğlu'),
    ('YAPI KREDİ', 'BANKA', 'Cem Koç'),
    ('FİBABANKA', 'BANKA', 'Cem Koç')
), updated as (
  update public.musteriler m
  set
    musteri = seed.musteri,
    sektor = seed.sektor,
    sorumlu = seed.sorumlu,
    entegrasyon_tipi = null,
    satis_olasiligi = null
  from seed
  where lower(trim(m.musteri)) = lower(trim(seed.musteri))
  returning m.id
)
insert into public.musteriler (musteri, sektor, sorumlu, entegrasyon_tipi, satis_olasiligi)
select seed.musteri, seed.sektor, seed.sorumlu, null, null
from seed
where not exists (
  select 1
  from public.musteriler m
  where lower(trim(m.musteri)) = lower(trim(seed.musteri))
);

-- Bu gruba bilerek künye açılmıyor. Eski/yanlış künye varsa temizle.
delete from public.musteri_kunye k
using public.musteriler m
where k.musteri_id = m.id
  and upper(trim(m.sektor)) in ('BANKA', 'VERTİCAL');

-- Teknik aktivitenin faz değiştirmemesini garantiye al.
alter table public.pipeline_eventleri
  add column if not exists activity_scope text not null default 'account';

alter table public.pipeline_eventleri
  add column if not exists affects_phase boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pipeline_eventleri_activity_scope_check') then
    alter table public.pipeline_eventleri
      add constraint pipeline_eventleri_activity_scope_check
      check (activity_scope in ('account', 'technical'));
  end if;
end $$;

create index if not exists idx_pipeline_eventleri_activity_scope
  on public.pipeline_eventleri(activity_scope);

create index if not exists idx_pipeline_eventleri_affects_phase
  on public.pipeline_eventleri(affects_phase);

-- Fazsız teknik geçmiş aktivite importu için staging tablo.
create table if not exists public.import_teknik_aktiviteler (
  id bigserial primary key,
  musteri_adi text not null,
  aktivite_tipi text not null check (aktivite_tipi in ('Teknik Ziyaret', 'Teknik Online', 'Yerinde Ziyaret', 'Online Görüşme', 'Telefon', 'E-Posta')),
  notlar text,
  created_by text,
  created_at timestamptz
);

-- Standart müşteride faz yoksa import dışı kalır; BANKA/VERTICAL için fazsız aktivite kabul edilir.
-- Önce kontrol etmek için bu sorguyu çalıştırın. Burada dönen standart müşterilerde faz eksiktir.
-- select i.*
-- from public.import_teknik_aktiviteler i
-- left join public.musteriler m on lower(trim(m.musteri)) = lower(trim(i.musteri_adi))
-- left join public.musteri_pipeline mp on mp.musteri_id = m.musteri_id
-- where m.musteri_id is null
--    or (mp.aktif_faz_no is null and coalesce(upper(trim(m.sektor)), '') not in ('BANKA', 'VERTİCAL'));

insert into public.pipeline_eventleri (
  musteri_id, faz_no, iteration_no, event_type, durum, aksiyon, owner,
  partner_owner, baslangic_tarihi, hedef_tarihi, notlar, created_by,
  created_at, activity_scope, affects_phase
)
select
  m.musteri_id,
  case when upper(trim(coalesce(m.sektor, ''))) in ('BANKA', 'VERTİCAL') then null else mp.aktif_faz_no end as faz_no,
  coalesce(last_event.iteration_no, 1) as iteration_no,
  'note_added' as event_type,
  coalesce(mp.durum, 'Devam Ediyor') as durum,
  'AKTIVITE:' || i.aktivite_tipi as aksiyon,
  coalesce(mp.owner, m.sorumlu) as owner,
  coalesce(mp.partner_owner, m.sorumlu) as partner_owner,
  null as baslangic_tarihi,
  null as hedef_tarihi,
  nullif(trim(coalesce(i.notlar, '')), '') as notlar,
  coalesce(nullif(trim(i.created_by), ''), 'Teknik Ekip Import') as created_by,
  coalesce(i.created_at, now()) as created_at,
  'technical' as activity_scope,
  false as affects_phase
from public.import_teknik_aktiviteler i
join public.musteriler m
  on lower(trim(m.musteri)) = lower(trim(i.musteri_adi))
left join public.musteri_pipeline mp
  on mp.musteri_id = m.musteri_id
left join lateral (
  select pe.iteration_no
  from public.pipeline_eventleri pe
  where pe.musteri_id = m.musteri_id
    and (pe.faz_no is not distinct from mp.aktif_faz_no or mp.aktif_faz_no is null)
  order by pe.created_at desc
  limit 1
) last_event on true
where mp.aktif_faz_no is not null
   or upper(trim(coalesce(m.sektor, ''))) in ('BANKA', 'VERTİCAL');

commit;
