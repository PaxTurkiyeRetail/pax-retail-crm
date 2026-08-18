-- Entra ID App Role tabanli SSO icin sistem parametre seed'i.
-- Idempotent: tekrar calistirilabilir, mevcut kayitlari degistirmez.

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('system_oidc_enabled', 'system_oidc_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_app_role_sync_enabled', 'system_oidc_app_role_sync_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_group_role_sync_enabled', 'system_oidc_group_role_sync_enabled', 'Kapalı', 'false', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005'))
on conflict (group_key, param_key) do nothing;

insert into public.system_parameters (group_key, param_key, label, value, sort_order, is_active, meta)
values
  ('system_oidc_app_role_mapping', 'crm_super_admin', 'crm.super_admin', 'super_admin', 10, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_app_role_mapping', 'crm_admin', 'crm.admin', 'admin', 20, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_app_role_mapping', 'crm_itsm', 'crm.itsm', 'itsm', 30, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_app_role_mapping', 'crm_account_manager', 'crm.account_manager', 'account_manager', 40, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005')),
  ('system_oidc_app_role_mapping', 'crm_user', 'crm.user', 'user', 50, true, jsonb_build_object('source', 'seed', 'migration', '20260818_005'))
on conflict (group_key, param_key) do nothing;
