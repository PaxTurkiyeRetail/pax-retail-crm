-- allowed_users.role için yeni roller
-- super_admin: tüm ekranlar + kullanıcı yönetimi
-- account_manager: kullanıcılar hariç tüm iş ekranları
-- itsm: kullanıcılar ve müşteriler ekranı hariç diğer iş ekranları

-- Eski kayıtları yeni role modeline geçirmek istersen örnek backfill:
-- update public.allowed_users set role = 'super_admin' where role = 'admin';
-- update public.allowed_users set role = 'account_manager' where role = 'user';

-- Eğer allowed_users.role alanında CHECK constraint varsa buna benzer şekilde güncelle:
-- alter table public.allowed_users drop constraint if exists allowed_users_role_check;
-- alter table public.allowed_users
--   add constraint allowed_users_role_check
--   check (role in ('super_admin', 'account_manager', 'itsm', 'admin', 'user'));
