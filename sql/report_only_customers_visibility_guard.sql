begin;

delete from public.musteri_kunye_v2 k
using public.musteriler m
where k.musteri_id = m.id
  and (lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç')
       or lower(trim(coalesce(m.sektor, ''))) in ('banka', 'vertical', 'verti̇cal'));

delete from public.musteri_kunye k
using public.musteriler m
where k.musteri_id = m.id
  and (lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç')
       or lower(trim(coalesce(m.sektor, ''))) in ('banka', 'vertical', 'verti̇cal'));

commit;
