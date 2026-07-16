-- Account kullanıcılarının birbirlerinin müşteri/aktivite/künye kayıtlarını güncelleyebilmesi için son işlem alanları.
-- Deploy öncesi PostgreSQL SQL Editor'de çalıştırın.

alter table public.musteriler
add column if not exists updated_by text,
add column if not exists updated_at timestamptz;

alter table public.musteri_kunye_v2
add column if not exists updated_by text,
add column if not exists updated_at timestamptz;

comment on column public.musteriler.updated_by is 'Müşteri temel bilgisini en son güncelleyen kullanıcı adı/e-posta.';
comment on column public.musteriler.updated_at is 'Müşteri temel bilgisinin son güncellenme zamanı.';
comment on column public.musteri_kunye_v2.updated_by is 'Künye bilgisini en son güncelleyen kullanıcı adı/e-posta.';
comment on column public.musteri_kunye_v2.updated_at is 'Künye bilgisinin son güncellenme zamanı.';
