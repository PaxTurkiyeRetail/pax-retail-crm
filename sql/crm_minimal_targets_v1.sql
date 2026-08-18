-- crm_minimal_targets_v1.sql
-- Minimal hedef altyapısı: crm_target_definitions + crm_target_values
-- Idempotent, transaction içinde. View/function/trigger/örnek veri YOK.
-- Yanlış tipte mevcut nesne bulunursa RAISE EXCEPTION ile durur.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='crm_target_definitions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='crm_target_definitions'
        AND column_name='code' AND data_type='text'
    ) THEN
      RAISE EXCEPTION 'crm_target_definitions var ama beklenen semaya uymuyor (code:text kolonu yok). Manuel inceleme gerekli.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='crm_target_values'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='crm_target_values'
        AND column_name='definition_id' AND data_type='uuid'
    ) THEN
      RAISE EXCEPTION 'crm_target_values var ama beklenen semaya uymuyor (definition_id:uuid kolonu yok). Manuel inceleme gerekli.';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_target_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  unit text NOT NULL,
  source_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_target_definitions_code_key UNIQUE (code),
  CONSTRAINT crm_target_definitions_code_not_blank CHECK (btrim(code) <> ''),
  CONSTRAINT crm_target_definitions_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT crm_target_definitions_unit_check CHECK (unit IN ('money', 'count')),
  CONSTRAINT crm_target_definitions_source_type_check CHECK (source_type = 'quotes_won'),
  CONSTRAINT crm_target_definitions_display_order_check CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS public.crm_target_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL,
  scope_type text NOT NULL,
  scope_user_id uuid NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_value numeric(18,2) NOT NULL,
  note text NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_target_values_definition_fk
    FOREIGN KEY (definition_id) REFERENCES public.crm_target_definitions(id) ON DELETE RESTRICT,
  CONSTRAINT crm_target_values_scope_user_fk
    FOREIGN KEY (scope_user_id) REFERENCES public.allowed_users(id) ON DELETE RESTRICT,
  CONSTRAINT crm_target_values_created_by_fk
    FOREIGN KEY (created_by) REFERENCES public.allowed_users(id) ON DELETE SET NULL,
  CONSTRAINT crm_target_values_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES public.allowed_users(id) ON DELETE SET NULL,
  CONSTRAINT crm_target_values_scope_type_check CHECK (scope_type IN ('company', 'user')),
  CONSTRAINT crm_target_values_scope_user_consistency CHECK (
    (scope_type = 'company' AND scope_user_id IS NULL)
    OR (scope_type = 'user' AND scope_user_id IS NOT NULL)
  ),
  CONSTRAINT crm_target_values_period_type_check CHECK (period_type IN ('year', 'month', 'week')),
  CONSTRAINT crm_target_values_period_order_check CHECK (period_end >= period_start),
  CONSTRAINT crm_target_values_target_value_check CHECK (target_value >= 0),
  CONSTRAINT crm_target_values_unique_combo
    UNIQUE NULLS NOT DISTINCT (definition_id, scope_type, scope_user_id, period_type, period_start, period_end)
);

-- Not: period_start/period_end'in yıl/ay/hafta sınırlarına (Europe/Istanbul, Pazartesi başlangıç)
-- tam uyduğunun kanonik kontrolü burada YOK. IMMUTABLE olmayan/karmaşık tarih ifadeleri DB CHECK'e
-- taşınmadı; bu kontrol API katmanında yapılmalı. Burada yalnız period_end >= period_start
-- temel kısıtı uygulanıyor.

CREATE INDEX IF NOT EXISTS crm_target_values_definition_id_idx
  ON public.crm_target_values (definition_id);

CREATE INDEX IF NOT EXISTS crm_target_values_scope_user_id_idx
  ON public.crm_target_values (scope_user_id);

CREATE INDEX IF NOT EXISTS crm_target_values_period_range_idx
  ON public.crm_target_values (period_start, period_end);

CREATE INDEX IF NOT EXISTS crm_target_values_scope_period_idx
  ON public.crm_target_values (scope_type, period_type);

INSERT INTO public.crm_target_definitions (code, name, description, unit, source_type, is_active, display_order)
VALUES
  ('sales_revenue', 'Satış Tutarı', 'Gerçekleşen satış: quotes.status=closed AND closed_reason=won üzerinden SUM(total_amount)', 'money', 'quotes_won', true, 1),
  ('device_count', 'Cihaz Adedi', 'Gerçekleşen satış: quotes.status=closed AND closed_reason=won üzerinden SUM(total_device_count)', 'count', 'quotes_won', true, 2)
ON CONFLICT (code) DO NOTHING;

COMMIT;
