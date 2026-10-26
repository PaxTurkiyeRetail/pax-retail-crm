-- Mevcut POS sayısı bağımsız, isteğe bağlı net adettir.
-- Eski Toplam POS / Sabit Kasa değerlerinden otomatik türetilmez.
alter table public.musteri_kunye_v2
  add column if not exists mevcut_pos_sayisi integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.musteri_kunye_v2'::regclass
      and conname = 'musteri_kunye_v2_mevcut_pos_sayisi_check'
  ) then
    alter table public.musteri_kunye_v2
      add constraint musteri_kunye_v2_mevcut_pos_sayisi_check
      check (mevcut_pos_sayisi >= 0);
  end if;
end $$;

comment on column public.musteri_kunye_v2.mevcut_pos_sayisi
  is 'Firmanın mevcut POS cihazı adedi. NULL: bilinmiyor, 0: cihaz yok.';

-- Mevcut kolon sırası, bağımlılıklar, izinler ve doluluk hesapları korunur.
-- Her iki okuma view'ine alan sona eklenir; tekrar çalıştırılabilir.
do $$
declare
  view_name text;
  definition text;
begin
  foreach view_name in array array['v_musteri_kunye_form', 'v_musteri_kunye_status'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = view_name
        and column_name = 'mevcut_pos_sayisi'
    ) then
      definition := rtrim(pg_get_viewdef(format('public.%I', view_name)::regclass, true), E';\n\r ');
      execute format(
        'create or replace view public.%I as select existing.*, pos.mevcut_pos_sayisi from (%s) existing left join public.musteri_kunye_v2 pos on pos.musteri_id = existing.musteri_id',
        view_name, definition
      );
    end if;
  end loop;
end $$;
