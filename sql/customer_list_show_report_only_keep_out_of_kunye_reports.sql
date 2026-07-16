-- Bu patch kod tarafındadır.
-- Seda Kesikoğlu / Cem Koç ve BANKA / VERTİCAL müşterileri müşteri listesinde görünür.
-- Künye tablolarında kayıtları olmamalıdır; varsa temizlenir.
delete from public.musteri_kunye k
using public.musteriler m
where k.musteri_id = m.id
  and (lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç')
       or upper(trim(coalesce(m.sektor, ''))) in ('BANKA', 'VERTİCAL', 'VERTICAL'));

-- v2 künye tablosu varsa ayrıca temizlenir.
do $$
begin
  if to_regclass('public.musteri_kunye_v2') is not null then
    delete from public.musteri_kunye_v2 k
    using public.musteriler m
    where k.musteri_id = m.id
      and (lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç')
           or upper(trim(coalesce(m.sektor, ''))) in ('BANKA', 'VERTİCAL', 'VERTICAL'));
  end if;
end $$;
