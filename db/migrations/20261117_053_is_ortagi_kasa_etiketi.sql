-- 20261117_053_is_ortagi_kasa_etiketi.sql
-- Firma Rolleri'nde "İş Ortağı" (organization_roles.role_key = 'business_partner', aktif)
-- seçili firmaların künye Satıcı Etiketi = 'Kasa' olur; müşteri listesi kategorisi 'K'.
-- Eski kayıtlar tek seferde güncellenir, yeni/değişen kayıtlar trigger ile.
-- İdempotent; DROP/DELETE yok (yalnız trigger yeniden tanımlanır).

-- 1) Künye: iş ortağı firma hangi yoldan yazılırsa yazılsın etiket Kasa kalır
create or replace function public.crm_partner_kasa_etiket() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.organization_roles r
             where r.customer_id = new.musteri_id and r.role_key = 'business_partner' and r.is_active) then
    new.satici_etiketi := 'Kasa';
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_partner_kasa_etiket on public.musteri_kunye_v2;
create trigger trg_crm_partner_kasa_etiket
before insert or update of satici_etiketi on public.musteri_kunye_v2
for each row execute function public.crm_partner_kasa_etiket();

-- 2) Rol İş Ortağı olarak açıldı → künye + liste Kasa
create or replace function public.crm_partner_role_to_kasa() returns trigger
language plpgsql as $$
begin
  if new.role_key <> 'business_partner' or not new.is_active then return null; end if;
  insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi) values (new.customer_id, 'Kasa')
  on conflict (musteri_id) do update set satici_etiketi = 'Kasa'
  where public.musteri_kunye_v2.satici_etiketi is distinct from 'Kasa';
  update public.crm_musteri_listesi
  set kategori = 'K', updated_at = now(), updated_by = 'sync-is-ortagi'
  where is_active and musteri_id = new.customer_id and kategori is distinct from 'K';
  return null;
end $$;

drop trigger if exists trg_crm_partner_role_to_kasa on public.organization_roles;
create trigger trg_crm_partner_role_to_kasa
after insert or update of role_key, is_active on public.organization_roles
for each row execute function public.crm_partner_role_to_kasa();

-- 3) Eski kayıtlar
insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi)
select distinct r.customer_id, 'Kasa'
from public.organization_roles r
where r.role_key = 'business_partner' and r.is_active
on conflict (musteri_id) do update set satici_etiketi = 'Kasa'
where public.musteri_kunye_v2.satici_etiketi is distinct from 'Kasa';

update public.crm_musteri_listesi l
set kategori = 'K', updated_at = now(), updated_by = 'migration-053'
from public.organization_roles r
where l.is_active and l.musteri_id = r.customer_id
  and r.role_key = 'business_partner' and r.is_active
  and l.kategori is distinct from 'K';
