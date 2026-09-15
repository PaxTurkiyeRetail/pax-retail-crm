-- ===========================================================================
-- 035 — MÜŞTERİ LİSTESİ (H/F/L/K) ↔ MÜŞTERİ KÜNYESİ ENTEGRASYONU
--
-- Sinan, 15.09.2026 akşam:
--   "Hunter/Farmer'daki her şirketi müşteriler ile entegre etmen lazım… olmayanları
--    Lead'in Havuz Account'una at… her yapılan işlem diğerini de tetiklesin ki
--    sürekli düzgün kalsın iki tarafta."
--   "Satıcı etiketine Kasa ve Lead de ekleyelim, bundan sonra karışmasın."
--   "Yeni açılan firma, açan kişinin Lead kısmına atılsın."
--   Çelişki kuralı: **MÜŞTERİ LİSTESİ KAZANIR** (künye sorumlusu listeye göre düzeltilir).
--   Künyede olup listede olmayan firmalar: **künye sorumlusunun Lead kolonuna** (sorumlusu
--   yoksa Havuz Account).
--
-- SÖZLÜK (tek eşleme, iki tarafta da aynı):
--   H ↔ Hunter · F ↔ Farmer · L ↔ Lead · K ↔ Kasa
--
-- EŞLEŞTİRME: ad normalize (Türkçe harf çevirisi + yalnız A-Z0-9) + **TEK ADAY**.
--   Aynı ada birden çok künye varsa satır BAĞLANMAZ — elle karar için
--   `sql/musteri_listesi_entegrasyon_RAPOR.sql` §F'de listelenir.
--
-- ÖNCE RAPORU KOŞTUR: `sql/musteri_listesi_entegrasyon_RAPOR.sql` (salt okunur).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Ad normalize yardımcısı (trigger'lar ve eşleme aynı kuralı kullansın)
-- ---------------------------------------------------------------------------
create or replace function public.crm_firma_key(p_ad text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(translate(coalesce(p_ad, ''), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g')
$$;

-- Kategori ↔ satıcı etiketi sözlüğü (iki yön)
create or replace function public.crm_kategori_to_etiket(p_kategori text)
returns text language sql immutable as $$
  select case upper(coalesce(p_kategori, '')) when 'H' then 'Hunter' when 'F' then 'Farmer'
                                              when 'L' then 'Lead'   when 'K' then 'Kasa' end
$$;

create or replace function public.crm_etiket_to_kategori(p_etiket text)
returns text language sql immutable as $$
  select case lower(trim(coalesce(p_etiket, ''))) when 'hunter' then 'H' when 'farmer' then 'F'
                                                  when 'lead' then 'L'  when 'kasa' then 'K' end
$$;

-- ---------------------------------------------------------------------------
-- 2) Satıcı Etiketi listesine Lead + Kasa (Liste Yönetimleri'nden de görünür)
-- ---------------------------------------------------------------------------
insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active)
values ('kunye_satici_etiketi', 'lead', 'Lead',  'Lead',  30, true),
       ('kunye_satici_etiketi', 'kasa', 'Kasa',  'Kasa',  40, true)
on conflict (group_key, param_key) do update
  set label = excluded.label, value = excluded.value, is_active = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Liste → künye BAĞLANTISI (tek adaylı eşleşmeler)
-- ---------------------------------------------------------------------------
with tek as (
  select public.crm_firma_key(m.musteri) as k, (array_agg(m.id order by m.id))[1] as id
  from public.musteriler m
  group by 1 having count(*) = 1
)
update public.crm_musteri_listesi l
set musteri_id = tek.id, updated_at = now(), updated_by = 'migration-035'
from tek
where l.is_active and l.musteri_id is null and tek.k = public.crm_firma_key(l.firma);

-- ---------------------------------------------------------------------------
-- 4) Listede var, künyede YOK → künyeyi AÇ (satırın kendi sahibi ve kategorisiyle;
--    liste kazandığı için Havuz Account'a atılmaz, kendi satıcısında kalır)
-- ---------------------------------------------------------------------------
with eksik as (
  select distinct on (public.crm_firma_key(l.firma))
         l.firma, l.satici, l.owner_user_id, l.kategori
  from public.crm_musteri_listesi l
  where l.is_active and l.musteri_id is null
    and not exists (select 1 from public.musteriler m where public.crm_firma_key(m.musteri) = public.crm_firma_key(l.firma))
  order by public.crm_firma_key(l.firma), l.kategori, l.satici
),
yeni as (
  insert into public.musteriler (musteri, sorumlu, owner_user_id, updated_by, updated_at)
  select e.firma, nullif(e.satici, 'Havuz Account'), e.owner_user_id, 'migration-035', now()
  from eksik e
  returning id, musteri
)
insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi)
select y.id, public.crm_kategori_to_etiket(e.kategori)
from yeni y
join eksik e on public.crm_firma_key(e.firma) = public.crm_firma_key(y.musteri)
on conflict (musteri_id) do update set satici_etiketi = excluded.satici_etiketi;

-- Yeni açılanları bağla
with tek as (
  select public.crm_firma_key(m.musteri) as k, (array_agg(m.id order by m.id))[1] as id
  from public.musteriler m group by 1 having count(*) = 1
)
update public.crm_musteri_listesi l
set musteri_id = tek.id, updated_at = now(), updated_by = 'migration-035'
from tek
where l.is_active and l.musteri_id is null and tek.k = public.crm_firma_key(l.firma);

-- ---------------------------------------------------------------------------
-- 5) ÇELİŞKİLERDE LİSTE KAZANIR — künye sorumlusu ve satıcı etiketi listeye çekilir
-- ---------------------------------------------------------------------------
update public.musteriler m
set sorumlu = nullif(l.satici, 'Havuz Account'),
    owner_user_id = l.owner_user_id,
    updated_by = 'migration-035', updated_at = now()
from public.crm_musteri_listesi l
where l.is_active and l.musteri_id = m.id
  and (coalesce(m.sorumlu, 'Havuz Account') is distinct from coalesce(l.satici, 'Havuz Account')
       or m.owner_user_id is distinct from l.owner_user_id);

insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi)
select l.musteri_id, public.crm_kategori_to_etiket(l.kategori)
from public.crm_musteri_listesi l
where l.is_active and l.musteri_id is not null
on conflict (musteri_id) do update set satici_etiketi = excluded.satici_etiketi;

-- ---------------------------------------------------------------------------
-- 6) Künyede var, listede YOK → künye sorumlusunun **Lead** kolonuna
-- ---------------------------------------------------------------------------
insert into public.crm_musteri_listesi (kategori, satici, owner_user_id, firma, musteri_id, sira, created_by, updated_by)
select 'L',
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account'),
       m.owner_user_id,
       m.musteri,
       m.id,
       0,
       'migration-035', 'migration-035'
from public.musteriler m
where not exists (
  select 1 from public.crm_musteri_listesi l
  where l.is_active and public.crm_firma_key(l.firma) = public.crm_firma_key(m.musteri)
)
on conflict do nothing;

-- Yeni eklenenlerin künye etiketi de Lead olsun (boşsa)
insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi)
select m.id, 'Lead'
from public.musteriler m
join public.crm_musteri_listesi l on l.musteri_id = m.id and l.is_active and l.kategori = 'L'
where l.created_by = 'migration-035'
on conflict (musteri_id) do update
  set satici_etiketi = coalesce(nullif(trim(public.musteri_kunye_v2.satici_etiketi), ''), 'Lead');

-- ---------------------------------------------------------------------------
-- 7) İKİ YÖNLÜ SENKRON (trigger) — "her yapılan işlem diğerini de tetiklesin"
--
-- Sonsuz döngü koruması: her trigger yalnız EN ÜST seviyede çalışır
-- (`pg_trigger_depth() > 1` ise çıkar). Yani liste → künye güncellemesi, künyenin
-- trigger'ını tekrar liste'ye döndürmez.
-- ---------------------------------------------------------------------------

-- 7a) Liste satırı değişti → künyeyi güncelle (LİSTE KAZANIR)
create or replace function public.crm_liste_to_kunye() returns trigger
language plpgsql as $$
declare v_id uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if not new.is_active then return null; end if;

  v_id := new.musteri_id;
  if v_id is null then
    select (array_agg(m.id order by m.id))[1] into v_id
    from public.musteriler m
    where public.crm_firma_key(m.musteri) = public.crm_firma_key(new.firma)
    group by public.crm_firma_key(m.musteri) having count(*) = 1;

    if v_id is null then
      -- Künyede yok → aç (satırın kendi sahibiyle)
      insert into public.musteriler (musteri, sorumlu, owner_user_id, updated_by, updated_at)
      values (new.firma, nullif(new.satici, 'Havuz Account'), new.owner_user_id, 'sync-liste', now())
      returning id into v_id;
    end if;
    update public.crm_musteri_listesi set musteri_id = v_id where id = new.id;
  end if;

  update public.musteriler
  set sorumlu = nullif(new.satici, 'Havuz Account'),
      owner_user_id = new.owner_user_id,
      updated_by = 'sync-liste', updated_at = now()
  where id = v_id
    and (coalesce(sorumlu, 'Havuz Account') is distinct from coalesce(new.satici, 'Havuz Account')
         or owner_user_id is distinct from new.owner_user_id);

  insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi)
  values (v_id, public.crm_kategori_to_etiket(new.kategori))
  on conflict (musteri_id) do update set satici_etiketi = excluded.satici_etiketi;

  return null;
end $$;

drop trigger if exists trg_crm_liste_to_kunye on public.crm_musteri_listesi;
create trigger trg_crm_liste_to_kunye
after insert or update of satici, owner_user_id, kategori, firma, musteri_id, is_active
on public.crm_musteri_listesi
for each row execute function public.crm_liste_to_kunye();

-- 7b) Künye açıldı / sorumlusu değişti → liste satırını aç veya taşı
create or replace function public.crm_kunye_to_liste() returns trigger
language plpgsql as $$
declare v_satici text;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  v_satici := coalesce(nullif(trim(new.sorumlu), ''), 'Havuz Account');

  if tg_op = 'INSERT' then
    -- YENİ FİRMA → açan kişinin **Lead** kolonuna (Sinan, 15.09)
    insert into public.crm_musteri_listesi (kategori, satici, owner_user_id, firma, musteri_id, sira, created_by, updated_by)
    values ('L', v_satici, new.owner_user_id, new.musteri, new.id, 0, 'sync-kunye', 'sync-kunye')
    on conflict do nothing;
    insert into public.musteri_kunye_v2 (musteri_id, satici_etiketi) values (new.id, 'Lead')
    on conflict (musteri_id) do nothing;
    return null;
  end if;

  update public.crm_musteri_listesi
  set satici = v_satici, owner_user_id = new.owner_user_id, updated_at = now(), updated_by = 'sync-kunye'
  where is_active and musteri_id = new.id
    and (satici is distinct from v_satici or owner_user_id is distinct from new.owner_user_id);
  return null;
end $$;

drop trigger if exists trg_crm_kunye_to_liste on public.musteriler;
create trigger trg_crm_kunye_to_liste
after insert or update of sorumlu, owner_user_id
on public.musteriler
for each row execute function public.crm_kunye_to_liste();

-- 7c) Satıcı etiketi değişti → liste kategorisi
create or replace function public.crm_etiket_to_liste() returns trigger
language plpgsql as $$
declare v_kat text;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  v_kat := public.crm_etiket_to_kategori(new.satici_etiketi);
  if v_kat is null then return null; end if;
  update public.crm_musteri_listesi
  set kategori = v_kat, updated_at = now(), updated_by = 'sync-etiket'
  where is_active and musteri_id = new.musteri_id and kategori is distinct from v_kat;
  return null;
end $$;

drop trigger if exists trg_crm_etiket_to_liste on public.musteri_kunye_v2;
create trigger trg_crm_etiket_to_liste
after insert or update of satici_etiketi
on public.musteri_kunye_v2
for each row execute function public.crm_etiket_to_liste();
