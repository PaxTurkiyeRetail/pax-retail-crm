-- 20260915_033_ortak_hedefler.sql
-- ORTAK HEDEFLER — Çağdaş Bey, 15.09.2026 (ses kaydı 10.40):
--   "Ortalama temas / firma default 5 olacak, aynı şekilde aktivite hedefi. Bunları girerken ortak
--    hedef alanı olsun, oraya herkesi etkileyecek şekilde; kişi bazlıya bunlarda gerek yok."
--   "Hedefte kazanılan teklife gerek yok, hedef olarak gerek yok — yoksa gözükebilir."
--
-- KARARLAR:
--   * Ortak hedef = `crm_target_values` üzerinde **scope_type='company'** satırı (tablo zaten
--     destekliyor; yeni kolon/tablo açılmadı). Kişi satırı varsa bile bu iki kod için ORTAK değer
--     kullanılır — ekranda kişi başına girilmez.
--   * Haftalık aktivite için yeni tanım `weekly_activity`. `allowed_users.weekly_target_total_activities`
--     kolonu KALDIRILMADI: ortak hedef girilmemişse eski kolon yedek olarak okunur (Kullanıcı
--     Yönetimi › Hedefleri Düzenle bozulmasın). Ortak değer girilince o kazanır.
--   * `contacts_per_customer` ortak varsayılanı **5** (Çağdaş Bey), `weekly_activity` **20**
--     (016'daki mevcut varsayılan). İçinde bulunulan yıl için yazılır; sonraki yıl Hedefler
--     ekranından girilir.
--   * `quotes_won_count` hedef tanımı **pasife alınır** — Canlı Ekran kazanılan teklif ADEDİNİ
--     göstermeye devam eder, yanında hedef/yüzde çıkmaz. Girilmiş değerler silinmez (tanım
--     yeniden açılırsa geri gelir).
--
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Yeni tanım: haftalık aktivite (ortak)
-- ---------------------------------------------------------------------------
insert into public.crm_target_definitions (code, name, description, unit, source_type, display_order)
values
  ('weekly_activity', 'Haftalık Aktivite (ortak)',
   'Kişi başına haftalık toplam aktivite hedefi. ORTAK hedeftir (scope_type=company): tüm satış ekibine aynı sayı uygulanır.',
   'count', 'activities', 5)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, unit = excluded.unit,
      source_type = excluded.source_type, display_order = excluded.display_order, is_active = true, updated_at = now();

update public.crm_target_definitions
set name = 'Ortalama Temas / Firma (ortak)',
    description = 'Kapsanan firma başına ortalama temas (ziyaret + online görüşme). ORTAK hedeftir; varsayılan 5.',
    updated_at = now()
where code = 'contacts_per_customer';

-- ---------------------------------------------------------------------------
-- 2) Kazanılan teklif HEDEFİ kalkıyor (sayı ekranda kalır)
-- ---------------------------------------------------------------------------
update public.crm_target_definitions
set is_active = false, updated_at = now()
where code = 'quotes_won_count';

-- ---------------------------------------------------------------------------
-- 3) Ortak varsayılanlar (içinde bulunulan yıl) — zaten girilmişse dokunulmaz
-- ---------------------------------------------------------------------------
insert into public.crm_target_values
  (definition_id, scope_type, scope_user_id, period_type, period_start, period_end, target_value, created_by, updated_by)
select d.code_id, 'company', null, 'year',
       make_date(extract(year from now())::int, 1, 1),
       make_date(extract(year from now())::int, 12, 31),
       d.value, null, null
from (
  select (select id from public.crm_target_definitions where code = 'weekly_activity') as code_id, 20::numeric as value
  union all
  select (select id from public.crm_target_definitions where code = 'contacts_per_customer'), 5::numeric
) d
where d.code_id is not null
  and not exists (
    select 1 from public.crm_target_values v
    where v.definition_id = d.code_id and v.scope_type = 'company'
      and v.period_type = 'year'
      and v.period_start = make_date(extract(year from now())::int, 1, 1)
  );

comment on column public.crm_target_values.scope_type is
  'company = ORTAK hedef (tüm satış ekibine uygulanır; weekly_activity ve contacts_per_customer bu şekilde girilir) · user = kişi bazlı hedef.';
