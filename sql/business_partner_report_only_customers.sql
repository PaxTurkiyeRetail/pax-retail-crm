-- İŞ ORTAKLARI / rapor-harici müşteri kayıtları
-- Amaç: İş ortakları müşteri listesinde ve aktivite ekranında görünsün,
-- fakat künye/faz/pipeline müşterisi gibi zorunluluk üretmesin.
-- Bu kayıtlar için entegrasyon_tipi NULL tutulur; fazsız aktivite girilir.

begin;

with seed(musteri) as (
  values
    ('Toshiba'),
    ('Nebim'),
    ('Teknonet'),
    ('Tepepos'),
    ('Seripos'),
    ('Param'),
    ('Paramtech'),
    ('Robotpos'),
    ('Posback'),
    ('Barsoft'),
    ('Enpos'),
    ('Encore'),
    ('Logo'),
    ('Microsoft D365'),
    ('Başarı Yazılım'),
    ('Birikim Bilgisayar'),
    ('Tera Yazılım'),
    ('Verimsoft')
), updated as (
  update public.musteriler m
  set
    musteri = seed.musteri,
    sektor = 'İŞ ORTAĞI',
    sorumlu = 'İş Ortakları',
    entegrasyon_tipi = null,
    satis_olasiligi = null,
    updated_at = now()
  from seed
  where lower(trim(m.musteri)) = lower(trim(seed.musteri))
  returning m.id
)
insert into public.musteriler (
  musteri,
  sektor,
  sorumlu,
  entegrasyon_tipi,
  satis_olasiligi
)
select
  seed.musteri,
  'İŞ ORTAĞI',
  'İş Ortakları',
  null,
  null
from seed
where not exists (
  select 1
  from public.musteriler m
  where lower(trim(m.musteri)) = lower(trim(seed.musteri))
);

-- İş ortağı kayıtlarında faz/pipeline/künye tutulmayacak.
delete from public.musteri_pipeline mp
using public.musteriler m
where mp.musteri_id = m.id
  and upper(trim(m.sektor)) in ('İŞ ORTAĞI', 'IS ORTAGI');

delete from public.musteri_kunye k
using public.musteriler m
where k.musteri_id = m.id
  and upper(trim(m.sektor)) in ('İŞ ORTAĞI', 'IS ORTAGI');

delete from public.musteri_kunye_v2 k
using public.musteriler m
where k.musteri_id = m.id
  and upper(trim(m.sektor)) in ('İŞ ORTAĞI', 'IS ORTAGI');

commit;
