-- 20260902_009_bildirim_merkezi.sql
-- Bildirim Merkezi altyapısı (Sinan talebi, 02.09.2026):
--   * report_schedules  → rapor PPTX'lerinin zamanlanmış e-posta planları
--                         (haftalık/aylık, gün, saat, alıcılar — panelden yönetilir)
--   * notification_log  → gönderilen/atlanan/başarısız tüm bildirimlerin izi
--   * Talep bildirim kuralları ve izinli alıcı domain'leri parametre olarak
--   * Yeni yetki: admin.notifications.manage (yalnızca Super Admin; kod tarafında
--     ALL_PERMISSIONS üzerinden gelir, role satırı eklenmez)
--
-- Mail sağlayıcı (Resend API anahtarı) yapılandırılana kadar gönderimler
-- notification_log'a "skipped" olarak düşer; panel ve kurallar şimdiden
-- kurulup test edilebilir.
--
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir.

create table if not exists public.report_schedules (
    id uuid default gen_random_uuid() not null primary key,
    report_key text not null,
    frequency text not null default 'weekly',
    day_of_week integer,
    day_of_month integer,
    send_hour integer not null default 8,
    recipients text[] not null default '{}'::text[],
    is_active boolean not null default true,
    -- Aynı dönem için ikinci gönderimi engeller (ör. '2026-W37' veya '2026-09').
    last_sent_period text,
    last_sent_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint report_schedules_report_key_check
      check (report_key = any (array['weekly_management'::text, 'seller_followup'::text])),
    constraint report_schedules_frequency_check
      check (frequency = any (array['weekly'::text, 'monthly'::text])),
    constraint report_schedules_day_of_week_check
      check (day_of_week is null or (day_of_week between 1 and 7)),
    constraint report_schedules_day_of_month_check
      check (day_of_month is null or (day_of_month between 1 and 28)),
    constraint report_schedules_send_hour_check
      check (send_hour between 0 and 23)
);

create table if not exists public.notification_log (
    id uuid default gen_random_uuid() not null primary key,
    kind text not null,
    subject text not null,
    recipients text[] not null default '{}'::text[],
    status text not null,
    detail text,
    ref_id text,
    created_at timestamp with time zone default now() not null,
    constraint notification_log_kind_check
      check (kind = any (array['report'::text, 'request'::text, 'system'::text])),
    constraint notification_log_status_check
      check (status = any (array['sent'::text, 'skipped'::text, 'failed'::text, 'rejected'::text]))
);

create index if not exists idx_notification_log_created on public.notification_log (created_at desc);
create index if not exists idx_notification_log_kind on public.notification_log (kind, created_at desc);

-- Parametreler: talep bildirim kuralları + izinli alıcı domain'leri.
-- Değerler Admin → Parametreler'den (ve gelecek Bildirim Merkezi ekranından) yönetilir.
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('notify_request_assignee_enabled', 'enabled', 'Aktif', 'true', 10, '{"source":"manual","module":"Bildirim","category":"Talep"}'::jsonb),
  ('notify_request_resolved_enabled', 'enabled', 'Aktif', 'true', 10, '{"source":"manual","module":"Bildirim","category":"Talep"}'::jsonb),
  ('notify_allowed_domains', 'paxturkiye_com', 'paxturkiye.com', 'paxturkiye.com', 10, '{"source":"manual","module":"Bildirim","category":"Güvenlik"}'::jsonb),
  ('notify_allowed_domains', 'axela_com_tr', 'axela.com.tr', 'axela.com.tr', 20, '{"source":"manual","module":"Bildirim","category":"Güvenlik"}'::jsonb)
on conflict (group_key, param_key) do nothing;

-- notify_request_cc: her talepte bilgilendirilecek sabit alıcılar.
-- Satır eklemek panelden yapılır; başlangıçta Sinan eklenir (talep sahibi).
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('notify_request_cc', 'sinan_isik', 'Sinan Işık', 'sinan.isik@axela.com.tr', 10, '{"source":"manual","module":"Bildirim","category":"Talep"}'::jsonb)
on conflict (group_key, param_key) do nothing;

-- Yetkiler: yalnızca tanım eklenir; super_admin kod tarafında tüm yetkilere
-- zaten sahiptir. Başka role bilinçli olarak verilmez (Sinan kararı).
insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('admin.notifications.manage', 'admin', 'Bildirim yönetimi', 'Rapor gönderim planlarını ve talep bildirim kurallarını yönetme (Bildirim Merkezi).'),
  ('screen.admin.notifications.view', 'screen', 'Ekran: Bildirim Merkezi', 'Bildirim Merkezi ekranını görüntüleme.')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;
