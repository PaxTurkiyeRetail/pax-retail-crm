-- BANKA / VERTICAL rapor müşterilerinde künye oluşturmayı DB seviyesinde engelle
-- Sorumlu Seda Kesikoğlu veya Cem Koç ise musteri_kunye ve musteri_kunye_v2 insert/update bloklanır.

create or replace function public.prevent_report_only_kunye()
returns trigger
language plpgsql
as $$
declare
  v_sorumlu text;
begin
  select lower(trim(coalesce(m.sorumlu, '')))
    into v_sorumlu
  from public.musteriler m
  where m.id = new.musteri_id;

  if v_sorumlu in ('seda kesikoğlu', 'cem koç') then
    raise exception 'Bu müşteri Banka/Vertical rapor müşterisidir; künye kaydı açılamaz.';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.musteri_kunye') is not null then
    drop trigger if exists trg_prevent_report_only_kunye on public.musteri_kunye;
    create trigger trg_prevent_report_only_kunye
      before insert or update on public.musteri_kunye
      for each row execute function public.prevent_report_only_kunye();
  end if;

  if to_regclass('public.musteri_kunye_v2') is not null then
    drop trigger if exists trg_prevent_report_only_kunye_v2 on public.musteri_kunye_v2;
    create trigger trg_prevent_report_only_kunye_v2
      before insert or update on public.musteri_kunye_v2
      for each row execute function public.prevent_report_only_kunye();
  end if;
end $$;

-- Daha önce yanlış açılmış künye varsa temizle.
delete from public.musteri_kunye k
using public.musteriler m
where k.musteri_id = m.id
  and lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç');

delete from public.musteri_kunye_v2 k
using public.musteriler m
where k.musteri_id = m.id
  and lower(trim(coalesce(m.sorumlu, ''))) in ('seda kesikoğlu', 'cem koç');
