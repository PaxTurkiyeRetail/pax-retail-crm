-- Bu migration calistirilmazsa UI'daki Franchise Sayisi alani DB'de hicbir yere kaydolmaz.
-- Yeni künye ekranı için önerilen veritabanı güncellemesi
alter table public.musteri_kunye
  add column if not exists franchise_sayisi integer,
  add column if not exists sabit_kasa_adedi integer,
  add column if not exists reyonda_kullanilan_cihaz_sayisi integer,
  add column if not exists kasapos_firmasi text;

create or replace view public.vw_musteri_kunye_durum as
select
  m.id as musteri_id,
  m.musteri,
  case
    when k.id is null then 'Yok'
    when (
      k.magaza_sayisi is null
      or k.erp is null
      or k.kasapos_firmasi is null
      or k.pos_modeli is null
      or k.bankalar is null
      or k.pos_mulkiyet is null
    ) then 'Eksik'
    else 'Var'
  end as kunye_durum
from public.musteriler m
left join public.musteri_kunye k
  on m.id = k.musteri_id;
