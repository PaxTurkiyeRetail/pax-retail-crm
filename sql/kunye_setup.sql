create table public.musteri_kunye (
  id uuid primary key default gen_random_uuid(),

  musteri_id uuid not null,
  firma_adi text,

  magaza_sayisi integer,
  franchise_sayisi integer,
  toplam_pos_adedi integer,
  sabit_kasa_adedi integer,
  reyonda_kullanilan_cihaz_sayisi integer,
  kasapos_firmasi text,

  pos_modeli text,
  pos_notu text,

  el_terminali_modeli text,
  el_terminali_adedi integer,

  reyon_cihazi_modeli text,
  reyon_cihazi_adedi integer,

  sabit_kasa_yazilimi text,
  reyonda_odeme_yazilimi text,

  erp text,
  bankalar text,

  pos_mulkiyet text,
  pos_mulkiyet_bankalari text,
  saha_hizmeti_firmasi text,

  genel_memnuniyet text,

  problem_1 text,
  problem_2 text,
  problem_3 text,

  degisim_nedeni text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint fk_kunye_musteri
  foreign key (musteri_id)
  references musteriler(id)
  on delete cascade
);

create unique index if not exists idx_musteri_kunye_musteri_unique
on public.musteri_kunye(musteri_id);

create index if not exists idx_musteri_kunye_musteri
on public.musteri_kunye(musteri_id);

create or replace function update_kunye_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_update_kunye_updated_at on public.musteri_kunye;
create trigger trg_update_kunye_updated_at
before update on public.musteri_kunye
for each row
execute procedure update_kunye_updated_at();

create or replace view public.vw_musteri_kunye_durum as
select
m.id as musteri_id,
m.musteri,
case
  when k.id is null then 'Yok'
  when (
    k.kasapos_firmasi is null
    or k.pos_modeli is null
    or k.pos_mulkiyet is null
    or ((k.pos_mulkiyet = 'Banka' or k.pos_mulkiyet = 'Bankada') and (k.pos_mulkiyet_bankalari is null or length(trim(k.pos_mulkiyet_bankalari)) = 0))
  ) then 'Eksik'
  else 'Var'
end as kunye_durum
from musteriler m
left join musteri_kunye k
on m.id = k.musteri_id;
