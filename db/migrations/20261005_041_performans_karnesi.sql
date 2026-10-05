-- 20261005_041_performans_karnesi.sql
-- PERFORMANS KARNESİ (Retail Sales Performance Report V1, 05.10.2026)
--
-- 1) crm_perf_reviews: Yönetici Değerlendirmesi — 3 kart (Güçlü Alanlar / Gelişim Alanları /
--    Sonraki Dönem Odağı). İK görüşmesi özeti; admin elle yazar (otomatik AI metni değil).
--    Anahtar: satıcı (normalize ad, ekip için '__team__') + dönem ('ytd-2026', 'q4-2026', 'm-2026-10').
-- 2) crm_pipeline_snapshots: aylık açık pipeline / forecast fotoğrafı. Teklif durum geçmişi
--    tutulmadığı için geçmiş aylar geriye dönük HESAPLANAMAZ; bu tablo ileriye dönük doldurulur
--    (raporun ilk açılışında ayın satırı yazılır, aynı ay tekrar yazılmaz). Önceki aylar N/A.
-- 3) Yetki: report.performance.read + screen.reports.performance.view → admin + super_admin.
--
-- Dosya idempotenttir. Veri silmez.

create table if not exists public.crm_perf_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  period_key text not null,
  strong text not null default '',
  improve text not null default '',
  focus text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint crm_perf_reviews_owner_period_key unique (owner_key, period_key)
);

comment on table public.crm_perf_reviews is
  'Performans Karnesi yönetici değerlendirmesi (admin elle yazar). Her satır: satıcı + dönem.';

create table if not exists public.crm_pipeline_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_month date not null,
  owner_name text not null,
  open_count integer not null default 0,
  open_amount numeric(14,2) not null default 0,
  weighted_amount numeric(14,2) not null default 0,
  forecast_amount numeric(14,2) not null default 0,
  taken_at timestamptz not null default now(),
  constraint crm_pipeline_snapshots_month_owner_key unique (snapshot_month, owner_name)
);
create index if not exists idx_crm_pipeline_snapshots_month on public.crm_pipeline_snapshots (snapshot_month);

comment on table public.crm_pipeline_snapshots is
  'Aylık açık pipeline / forecast fotoğrafı (ileriye dönük). Geçmiş ay için kayıt yoksa rapor N/A gösterir.';

insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('report.performance.read', 'report', 'Performans Karnesi',
   'Satıcı performans karnesini (skor, pipeline, portföy, risk, yönetici değerlendirmesi) görme ve değerlendirme yazma.'),
  ('screen.reports.performance.view', 'screen', 'Ekran: Performans Karnesi',
   'Performans Karnesi ekranını (/performans-karnesi) görebilme.')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, p.permission_key, true
from (values ('admin'), ('super_admin')) r(role_key)
cross join (values ('report.performance.read'), ('screen.reports.performance.view')) p(permission_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions rp where rp.permission_key = p.permission_key)
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();
