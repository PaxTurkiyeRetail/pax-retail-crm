-- 20260910_026_hedefler_ceyrek_ziyaret_cevirme.sql
-- HEDEFLER v2 — Çağdaş Bey'in 10.09.2026 toplantı istekleri (Canlı Ekran v2.7 + Hedefler ekranı):
--   * Kişi bazlı hedefleri Admin / Super Admin ayrı bir ekrandan girer (/admin/targets);
--     satışçılar bu ekranı görmez.
--   * Çeyrek dilimleri: hedef değerleri yıl + çeyrek (Q1 Oca–Mar, Q2 Nis–Haz, Q3 Tem–Eyl,
--     Q4 Eki–Ara) olarak girilir; Canlı Ekran içinde bulunulan çeyreğin donut'unu gösterir.
--   * Yeni hedef tanımları: ziyaret adedi (yıl + çeyrek), Hunter→Farmer ve Lead→Hunter
--     çevirme (yıl), kazanılan teklif adedi (yıl). "Yıllık ciro hedefi" ekranda artık
--     "Yıllık Bütçe Hedefi" adıyla görünür (tanım kodu değişmez: sales_revenue; çeyrek bütçe
--     de aynı koda period_type='quarter' ile yazılır).
--   * Çevirme sayımı: Müşteri Listesi (H/F/L/K) ekranında bir firmanın kategorisi taşındığında
--     tarihli hareket kaydı düşer (crm_musteri_listesi_hareket). Canlı Ekran yıl içindeki
--     H→F ve L→H taşımalarını kişi (hedef kolon) bazında sayar.
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir. Uygulanmış migration dosyaları
-- değiştirilmez (checksum kilidi) — düzeltme gerekirse 027 açılır.

-- ---------------------------------------------------------------------------
-- 1) Dönem tipi: çeyrek
-- ---------------------------------------------------------------------------
alter table public.crm_target_values drop constraint if exists crm_target_values_period_type_check;
alter table public.crm_target_values
  add constraint crm_target_values_period_type_check
  check (period_type in ('year', 'quarter', 'month', 'week'));

comment on column public.crm_target_values.period_type is
  'year | quarter | month | week. Çeyrek: period_start = çeyreğin ilk günü (01-01, 04-01, 07-01, 10-01), period_end = son günü.';

-- ---------------------------------------------------------------------------
-- 2) Kaynak tipi kısıtı genişledi + yeni hedef tanımları
-- ---------------------------------------------------------------------------
alter table public.crm_target_definitions drop constraint if exists crm_target_definitions_source_type_check;
alter table public.crm_target_definitions
  add constraint crm_target_definitions_source_type_check
  check (source_type in ('quotes_won', 'integration_partners', 'activities', 'customer_list', 'quotes'));

insert into public.crm_target_definitions (code, name, description, unit, source_type, display_order)
values
  ('visit_count', 'Ziyaret Adedi',
   'Fiziki + online satış görüşmesi sayısı (pipeline_eventleri; aktiviteyi giren kişiye göre). Yıl ve çeyrek hedefi girilir.',
   'count', 'activities', 40),
  ('hunter_to_farmer', 'Hunter → Farmer Çevirme',
   'Müşteri Listesi (H/F/L/K) ekranında Hunter''dan Farmer''a taşınan firma sayısı (yıl içi).',
   'count', 'customer_list', 50),
  ('lead_to_hunter', 'Lead → Hunter Çevirme',
   'Müşteri Listesi (H/F/L/K) ekranında Lead''den Hunter''a taşınan firma sayısı (yıl içi).',
   'count', 'customer_list', 60),
  ('quotes_won_count', 'Kazanılan Teklif Adedi',
   'Yıl içinde kazanılan (status=closed, closed_reason=won) teklif sayısı.',
   'count', 'quotes', 70)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, unit = excluded.unit,
      source_type = excluded.source_type, display_order = excluded.display_order, is_active = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Müşteri Listesi hareket kaydı (kategori / kişi taşımaları)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_musteri_listesi_hareket (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.crm_musteri_listesi(id) on delete set null,
  firma text not null,
  -- Taşıma SONRASI kişi (hedef kolon) — çevirme bu kişiye sayılır
  satici text not null,
  owner_user_id uuid references public.allowed_users(id) on delete set null,
  from_satici text,
  from_kategori text,
  to_kategori text not null,
  moved_at timestamptz not null default now(),
  moved_by text,
  constraint crm_musteri_listesi_hareket_from_check check (from_kategori is null or from_kategori in ('H', 'F', 'L', 'K')),
  constraint crm_musteri_listesi_hareket_to_check check (to_kategori in ('H', 'F', 'L', 'K'))
);
create index if not exists idx_crm_musteri_listesi_hareket_moved_at on public.crm_musteri_listesi_hareket (moved_at);
create index if not exists idx_crm_musteri_listesi_hareket_satici on public.crm_musteri_listesi_hareket (lower(satici), moved_at);

comment on table public.crm_musteri_listesi_hareket is
  'Müşteri Listesi (H/F/L/K) taşıma günlüğü: kategori ve/veya kişi değişimleri. Canlı Ekran Hunter→Farmer ve Lead→Hunter çevirme donut''ları yıl içi H→F / L→H satırlarını sayar.';

-- ---------------------------------------------------------------------------
-- 4) Yetki: Hedefler ekranı (yalnız admin + super_admin)
-- ---------------------------------------------------------------------------
insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('admin.targets.manage', 'admin', 'Hedef yönetimi',
   'Kişi bazlı satış hedeflerini (haftalık aktivite, yıllık/çeyrek bütçe ve ziyaret, çevirme, kazanılan teklif) girme ve değiştirme.'),
  ('screen.admin.targets.view', 'screen', 'Ekran: Hedef Yönetimi',
   'Hedefler ekranını (/admin/targets) görebilme.')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, p.permission_key, true
from (values ('admin'), ('super_admin')) r(role_key)
cross join (values ('admin.targets.manage'), ('screen.admin.targets.view')) p(permission_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions rp where rp.permission_key = p.permission_key)
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();
