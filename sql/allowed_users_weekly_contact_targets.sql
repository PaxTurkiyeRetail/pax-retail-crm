-- Kullanıcı bazlı haftalık temas hedefleri
-- Bu kolonlar Kullanıcılar ekranından yönetilir ve Temas Edilen Müşteriler / Yönetici Sunumu / Satışçı Sunumu içinde gerçekleşen / hedef formatında gösterilir.

alter table public.allowed_users
  add column if not exists weekly_target_sales_physical integer not null default 0,
  add column if not exists weekly_target_sales_online integer not null default 0,
  add column if not exists weekly_target_sales_phone integer not null default 0,
  add column if not exists weekly_target_sales_email integer not null default 0,
  add column if not exists weekly_target_technical_physical integer not null default 0,
  add column if not exists weekly_target_technical_online integer not null default 0,
  add column if not exists weekly_target_total_activities integer not null default 0,
  add column if not exists weekly_target_unique_customers integer not null default 0;
