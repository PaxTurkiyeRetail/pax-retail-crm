-- 20261019_046_kullanici_departman.sql
-- KULLANICI DEPARTMANI (19.10.2026)
--
-- Departman AD'den gelmez; admin Kullanıcılar ekranından atar.
-- Değerler: 'Retail' | 'Bank' | 'Vertical' (musteriler.is_kolu ile aynı). Boş dizi = tüm departmanlar.
-- Dosya idempotenttir. Veri silmez.

alter table public.allowed_users add column if not exists departments text[] not null default '{}'::text[];

-- İlk atama (backfill): yalnız departmanı boş kullanıcılar. Sorumlu olduğu müşterilerin
-- (musteriler.sorumlu ↔ full_name / e-posta / e-posta kullanıcı adı) is_kolu çoğunluğu.
-- Eşleşmeyen boş kalır (= tüm departmanlar). Admin sonra Kullanıcılar ekranından düzeltir.
with eslesme as (
  select au.id as user_id, m.is_kolu, count(*) as adet
  from public.allowed_users au
  join public.musteriler m
    on lower(trim(m.sorumlu)) in (
      lower(trim(coalesce(au.full_name, ''))),
      lower(trim(au.email)),
      lower(split_part(trim(au.email), '@', 1))
    )
  where cardinality(au.departments) = 0
    and m.is_kolu in ('Retail', 'Bank', 'Vertical')
    and nullif(trim(m.sorumlu), '') is not null
  group by au.id, m.is_kolu
), cogunluk as (
  select distinct on (user_id) user_id, is_kolu
  from eslesme
  order by user_id, adet desc, is_kolu
)
update public.allowed_users au
set departments = array[c.is_kolu]
from cogunluk c
where au.id = c.user_id
  and cardinality(au.departments) = 0;
