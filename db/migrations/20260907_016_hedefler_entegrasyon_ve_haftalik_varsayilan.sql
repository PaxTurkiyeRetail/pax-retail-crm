-- 20260907_016_hedefler_entegrasyon_ve_haftalik_varsayilan.sql
-- Çağdaş Bey'in 07.09 satış toplantısı kararları (hedef modeli):
--   1) Üçüncü yıllık hedef: KasaPOS ENTEGRASYON adedi (integration_count).
--      Gerçekleşen = is_ortagi_tipi='Entegrasyon Firması' olan iş ortaklarından
--      aktif fazı 9+ (entegrasyon tamamlandı, Entegrasyon Raporu'ndaki yeşil eşik)
--      olanların sayısı. Kaynak tipi 'integration_partners' — check kısıtı genişletilir.
--   2) Haftalık satış hedefi varsayılanı: 8 görüşme (fiziki ya da online) +
--      12 temas (telefon ya da e-posta) = 20 aktivite. Yalnız account_manager rolü
--      ve yalnız hiç hedefi olmayan kullanıcılar; girilmiş hedef ezilmez.
--      (Kanal alanları: fiziki=8, telefon=12; Canlı Ekran grupları toplayarak gösterir.)
-- Dosya idempotenttir.

-- 1) Kaynak tipi kısıtı
alter table public.crm_target_definitions drop constraint if exists crm_target_definitions_source_type_check;
alter table public.crm_target_definitions
  add constraint crm_target_definitions_source_type_check
  check (source_type in ('quotes_won', 'integration_partners'));

insert into public.crm_target_definitions (code, name, description, unit, source_type, display_order)
values ('integration_count', 'Entegrasyon Adedi', 'KasaPOS entegrasyonu tamamlanan (faz 9+) entegrasyon firması sayısı', 'count', 'integration_partners', 30)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, unit = excluded.unit,
      source_type = excluded.source_type, display_order = excluded.display_order, is_active = true, updated_at = now();

-- 2) Haftalık varsayılan hedefler (yalnız boş olanlara)
update public.allowed_users u
set weekly_target_sales_physical   = 8,
    weekly_target_sales_online     = 0,
    weekly_target_sales_phone      = 12,
    weekly_target_sales_email      = 0,
    weekly_target_total_activities = 20
where u.is_active = true
  and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
  and coalesce(u.weekly_target_total_activities, 0) = 0
  and coalesce(u.weekly_target_sales_physical, 0) + coalesce(u.weekly_target_sales_online, 0)
    + coalesce(u.weekly_target_sales_phone, 0) + coalesce(u.weekly_target_sales_email, 0) = 0;
