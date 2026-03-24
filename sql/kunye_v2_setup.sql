create extension if not exists pgcrypto;

create or replace function public.update_kunye_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.musteri_kunye_v2 (
  id uuid not null default gen_random_uuid(),
  musteri_id uuid not null,

  magaza_sayisi text null,
  franchise_sayisi text null,

  sabit_kasa_adedi text null,
  kasapos_firmasi text null,
  pos_modeli text null,
  pos_markasi text null,
  toplam_pos_adedi integer null,
  pos_alim_yili text null,
  sabit_bilgisayar_markasi text null,
  pos_notu text null,

  reyon_kullaniliyor text null default 'Hayır',
  reyon_odeme_yazilimi text null,
  reyon_cihaz_modeli text null,
  reyon_cihaz_sayisi integer null,
  reyon_alim_yili text null,

  el_terminali_kullaniliyor text null default 'Hayır',
  el_terminali_modeli text null,
  el_terminali_yazilimi text null,
  el_terminali_adedi integer null,
  el_terminali_alim_yili text null,

  erp text null,
  bankalar text[] null,
  pos_mulkiyet text null,
  pos_mulkiyet_bankalari text[] null,
  saha_hizmeti_firmasi text null,

  genel_memnuniyet text null,
  risk text null,
  entegrasyon_yapisi text null,
  account text null,
  problem_1 text null,
  problem_2 text null,
  problem_3 text null,
  degisim_nedeni text null,

  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),

  constraint musteri_kunye_v2_pkey primary key (id),
  constraint musteri_kunye_v2_musteri_id_key unique (musteri_id),
  constraint musteri_kunye_v2_musteri_id_fkey foreign key (musteri_id) references public.musteriler (id) on delete cascade,
  constraint musteri_kunye_v2_reyon_kullaniliyor_check check (reyon_kullaniliyor in ('Evet', 'Hayır') or reyon_kullaniliyor is null),
  constraint musteri_kunye_v2_el_terminali_kullaniliyor_check check (el_terminali_kullaniliyor in ('Evet', 'Hayır') or el_terminali_kullaniliyor is null)
);

create index if not exists idx_musteri_kunye_v2_musteri_id
  on public.musteri_kunye_v2 (musteri_id);

drop trigger if exists trg_update_musteri_kunye_v2_updated_at on public.musteri_kunye_v2;
create trigger trg_update_musteri_kunye_v2_updated_at
before update on public.musteri_kunye_v2
for each row
execute function public.update_kunye_updated_at();

insert into public.musteri_kunye_v2 (
  musteri_id,
  magaza_sayisi,
  franchise_sayisi,
  sabit_kasa_adedi,
  kasapos_firmasi,
  pos_modeli,
  pos_markasi,
  toplam_pos_adedi,
  pos_alim_yili,
  sabit_bilgisayar_markasi,
  pos_notu,
  reyon_kullaniliyor,
  reyon_odeme_yazilimi,
  reyon_cihaz_modeli,
  reyon_cihaz_sayisi,
  reyon_alim_yili,
  el_terminali_kullaniliyor,
  el_terminali_modeli,
  el_terminali_yazilimi,
  el_terminali_adedi,
  el_terminali_alim_yili,
  erp,
  bankalar,
  pos_mulkiyet,
  pos_mulkiyet_bankalari,
  saha_hizmeti_firmasi,
  genel_memnuniyet,
  risk,
  entegrasyon_yapisi,
  account,
  problem_1,
  problem_2,
  problem_3,
  degisim_nedeni,
  created_at,
  updated_at
)
select
  mk.musteri_id,
  mk.magaza_sayisi,
  mk.franchise_sayisi,
  mk.sabit_kasa_adedi,
  coalesce(mk.kasapos_firmasi, mk.sabit_kasa_yazilimi) as kasapos_firmasi,
  mk.pos_modeli,
  mk.pos_markasi,
  mk.toplam_pos_adedi,
  mk.pos_alim_yili,
  mk.sabit_bilgisayar_markasi,
  mk.pos_notu,
  coalesce(
    mk.reyon_kullaniliyor,
    case
      when coalesce(mk.reyon_odeme_yazilimi, mk.reyonda_odeme_yazilimi, '') <> ''
        or coalesce(mk.reyon_cihaz_modeli, mk.reyon_cihazi_modeli, '') <> ''
        or coalesce(mk.reyon_cihaz_sayisi, mk.reyon_cihazi_adedi, mk.reyonda_kullanilan_cihaz_sayisi) is not null
        or coalesce(mk.reyon_alim_yili, '') <> ''
      then 'Evet'
      else 'Hayır'
    end
  ) as reyon_kullaniliyor,
  coalesce(mk.reyon_odeme_yazilimi, mk.reyonda_odeme_yazilimi) as reyon_odeme_yazilimi,
  coalesce(mk.reyon_cihaz_modeli, mk.reyon_cihazi_modeli) as reyon_cihaz_modeli,
  coalesce(mk.reyon_cihaz_sayisi, mk.reyon_cihazi_adedi, mk.reyonda_kullanilan_cihaz_sayisi) as reyon_cihaz_sayisi,
  mk.reyon_alim_yili,
  coalesce(
    mk.el_terminali_kullaniliyor,
    case
      when coalesce(mk.el_terminali_modeli, '') <> ''
        or coalesce(mk.el_terminali_yazilimi, '') <> ''
        or mk.el_terminali_adedi is not null
        or coalesce(mk.el_terminali_alim_yili, '') <> ''
      then 'Evet'
      else 'Hayır'
    end
  ) as el_terminali_kullaniliyor,
  mk.el_terminali_modeli,
  mk.el_terminali_yazilimi,
  mk.el_terminali_adedi,
  mk.el_terminali_alim_yili,
  mk.erp,
  mk.bankalar,
  mk.pos_mulkiyet,
  mk.pos_mulkiyet_bankalari,
  mk.saha_hizmeti_firmasi,
  mk.genel_memnuniyet,
  mk.risk,
  mk.entegrasyon_yapisi,
  mk.account,
  mk.problem_1,
  mk.problem_2,
  mk.problem_3,
  mk.degisim_nedeni,
  mk.created_at,
  mk.updated_at
from public.musteri_kunye mk
on conflict (musteri_id) do update
set
  magaza_sayisi = excluded.magaza_sayisi,
  franchise_sayisi = excluded.franchise_sayisi,
  sabit_kasa_adedi = excluded.sabit_kasa_adedi,
  kasapos_firmasi = excluded.kasapos_firmasi,
  pos_modeli = excluded.pos_modeli,
  pos_markasi = excluded.pos_markasi,
  toplam_pos_adedi = excluded.toplam_pos_adedi,
  pos_alim_yili = excluded.pos_alim_yili,
  sabit_bilgisayar_markasi = excluded.sabit_bilgisayar_markasi,
  pos_notu = excluded.pos_notu,
  reyon_kullaniliyor = excluded.reyon_kullaniliyor,
  reyon_odeme_yazilimi = excluded.reyon_odeme_yazilimi,
  reyon_cihaz_modeli = excluded.reyon_cihaz_modeli,
  reyon_cihaz_sayisi = excluded.reyon_cihaz_sayisi,
  reyon_alim_yili = excluded.reyon_alim_yili,
  el_terminali_kullaniliyor = excluded.el_terminali_kullaniliyor,
  el_terminali_modeli = excluded.el_terminali_modeli,
  el_terminali_yazilimi = excluded.el_terminali_yazilimi,
  el_terminali_adedi = excluded.el_terminali_adedi,
  el_terminali_alim_yili = excluded.el_terminali_alim_yili,
  erp = excluded.erp,
  bankalar = excluded.bankalar,
  pos_mulkiyet = excluded.pos_mulkiyet,
  pos_mulkiyet_bankalari = excluded.pos_mulkiyet_bankalari,
  saha_hizmeti_firmasi = excluded.saha_hizmeti_firmasi,
  genel_memnuniyet = excluded.genel_memnuniyet,
  risk = excluded.risk,
  entegrasyon_yapisi = excluded.entegrasyon_yapisi,
  account = excluded.account,
  problem_1 = excluded.problem_1,
  problem_2 = excluded.problem_2,
  problem_3 = excluded.problem_3,
  degisim_nedeni = excluded.degisim_nedeni,
  updated_at = now();

create or replace view public.v_musteri_kunye_form as
select
  m.id as musteri_id,
  m.musteri as firma_adi,
  m.sektor,
  m.sorumlu,
  k.id as kunye_id,
  k.magaza_sayisi,
  k.franchise_sayisi,
  k.sabit_kasa_adedi,
  k.kasapos_firmasi,
  k.pos_modeli,
  k.pos_markasi,
  k.toplam_pos_adedi,
  k.pos_alim_yili,
  k.sabit_bilgisayar_markasi,
  k.pos_notu,
  k.reyon_kullaniliyor,
  k.reyon_odeme_yazilimi,
  k.reyon_cihaz_modeli,
  k.reyon_cihaz_sayisi,
  k.reyon_alim_yili,
  k.el_terminali_kullaniliyor,
  k.el_terminali_modeli,
  k.el_terminali_yazilimi,
  k.el_terminali_adedi,
  k.el_terminali_alim_yili,
  k.erp,
  k.bankalar,
  k.pos_mulkiyet,
  k.pos_mulkiyet_bankalari,
  k.saha_hizmeti_firmasi,
  k.genel_memnuniyet,
  k.risk,
  k.entegrasyon_yapisi,
  k.account as musteri_account,
  k.account,
  k.problem_1,
  k.problem_2,
  k.problem_3,
  k.degisim_nedeni,
  k.created_at,
  k.updated_at
from public.musteriler m
left join public.musteri_kunye_v2 k
  on k.musteri_id = m.id;
