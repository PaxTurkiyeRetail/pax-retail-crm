-- crm_minimal_targets_verify.sql
-- Yalnız SELECT. DB'yi değiştirmez.

-- 1) İki tablo mevcut mu
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('crm_target_definitions','crm_target_values')
ORDER BY table_name;

-- 2) Kolon tipleri
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('crm_target_definitions','crm_target_values')
ORDER BY table_name, ordinal_position;

-- 3) Foreign keyler
SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='crm_target_values'
ORDER BY kcu.column_name;

-- 4) Check constraintler
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.crm_target_definitions'::regclass, 'public.crm_target_values'::regclass)
  AND contype = 'c'
ORDER BY conrelid, conname;

-- 5) Unique constraint
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.crm_target_values'::regclass AND contype = 'u';

-- 6) İki metric seed mevcut mu
SELECT code, name, unit, source_type, is_active, display_order
FROM public.crm_target_definitions
ORDER BY display_order;

SELECT count(*) AS definition_count FROM public.crm_target_definitions;

-- 7) crm_target_values satır sayısı (0 olmalı)
SELECT count(*) AS target_values_row_count FROM public.crm_target_values;

-- 8) Eski 14 Codex tablosu geri gelmedi mi (0 olmalı)
SELECT count(*) AS removed_tables_present FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'crm_user_permission_overrides','crm_user_roles','crm_role_permissions','crm_permissions','crm_roles',
  'crm_target_revisions','crm_performance_snapshots','crm_targets','crm_target_metrics',
  'crm_team_members','crm_tv_devices','crm_teams','crm_audit_logs','faz_hareketleri'
);

-- 9) Core tablo satır sayıları (migrasyon öncesi snapshot ile karşılaştırılmalı)
SELECT 'musteriler' AS tbl, count(*) FROM public.musteriler
UNION ALL SELECT 'quotes', count(*) FROM public.quotes
UNION ALL SELECT 'requests', count(*) FROM public.requests
UNION ALL SELECT 'musteri_pipeline', count(*) FROM public.musteri_pipeline
UNION ALL SELECT 'pipeline_eventleri', count(*) FROM public.pipeline_eventleri
UNION ALL SELECT 'allowed_users', count(*) FROM public.allowed_users
UNION ALL SELECT 'quote_items', count(*) FROM public.quote_items;

-- 10) Toplam public tablo sayısı
SELECT count(*) AS total_public_tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
