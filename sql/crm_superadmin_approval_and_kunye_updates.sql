BEGIN;

------------------------------------------------------------
-- 1) MUSTERILER.RISK -> SATIS_OLASILIGI
------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'musteriler'
      AND column_name = 'risk'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'musteriler'
      AND column_name = 'satis_olasiligi'
  ) THEN
    ALTER TABLE public.musteriler
      RENAME COLUMN risk TO satis_olasiligi;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'musteriler'
      AND column_name = 'satis_olasiligi'
  ) THEN
    COMMENT ON COLUMN public.musteriler.satis_olasiligi
      IS 'Ekranda Satış Olasılığı olarak kullanılır';
  END IF;
END $$;

------------------------------------------------------------
-- 2) VIEW'LERI KALDIR
------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_musteri_kunye_form;
DROP VIEW IF EXISTS public.vw_musteri_kunye_durum;

------------------------------------------------------------
-- 3) POS MULKIYET BANKALARI KOLONUNU GUVENLI HAZIRLA
------------------------------------------------------------
ALTER TABLE public.musteri_kunye
  ADD COLUMN IF NOT EXISTS pos_mulkiyet_bankalari text[];

DO $$
DECLARE
  v_udt_name text;
BEGIN
  SELECT c.udt_name
    INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'musteri_kunye'
    AND c.column_name = 'pos_mulkiyet_bankalari';

  IF v_udt_name = 'text' THEN
    ALTER TABLE public.musteri_kunye
      ADD COLUMN IF NOT EXISTS pos_mulkiyet_bankalari_new text[];

    UPDATE public.musteri_kunye
    SET pos_mulkiyet_bankalari_new =
      CASE
        WHEN pos_mulkiyet_bankalari IS NULL THEN '{}'::text[]
        WHEN pos_mulkiyet_bankalari = '' THEN '{}'::text[]
        ELSE string_to_array(regexp_replace(pos_mulkiyet_bankalari, '\s*,\s*', ',', 'g'), ',')
      END;

    ALTER TABLE public.musteri_kunye
      DROP COLUMN pos_mulkiyet_bankalari;

    ALTER TABLE public.musteri_kunye
      RENAME COLUMN pos_mulkiyet_bankalari_new TO pos_mulkiyet_bankalari;
  END IF;
END $$;

UPDATE public.musteri_kunye
SET pos_mulkiyet_bankalari = '{}'::text[]
WHERE pos_mulkiyet_bankalari IS NULL;

COMMENT ON COLUMN public.musteri_kunye.bankalar
  IS 'Ekranda Hangi bankalar';

COMMENT ON COLUMN public.musteri_kunye.pos_mulkiyet_bankalari
  IS 'POS Cihazı Mülkiyeti = Banka ise seçilen bankalar listesi';

------------------------------------------------------------
-- 4) ACCOUNT DEGISIKLIK ONAY TABLOSU
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.musteri_account_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid NOT NULL REFERENCES public.musteriler(id) ON DELETE CASCADE,
  musteri text NOT NULL,
  current_account text,
  requested_account text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_musteri_account_change_requests_status
  ON public.musteri_account_change_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_musteri_account_change_requests_musteri
  ON public.musteri_account_change_requests(musteri_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_musteri_account_change_requests_pending
  ON public.musteri_account_change_requests(musteri_id)
  WHERE status = 'pending';

------------------------------------------------------------
-- 5) KUNYE VIEW'LERI
------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_musteri_kunye_durum AS
SELECT
  m.id AS musteri_id,
  m.musteri,
  CASE
    WHEN k.id IS NULL THEN 'Yok'
    WHEN (
      k.magaza_sayisi IS NULL
      OR k.toplam_pos_adedi IS NULL
      OR k.erp IS NULL
      OR k.pos_modeli IS NULL
      OR k.bankalar IS NULL
      OR k.pos_mulkiyet IS NULL
      OR (
        k.pos_mulkiyet = 'Banka'
        AND (
          k.pos_mulkiyet_bankalari IS NULL
          OR array_length(k.pos_mulkiyet_bankalari, 1) IS NULL
          OR array_length(k.pos_mulkiyet_bankalari, 1) = 0
        )
      )
    ) THEN 'Eksik'
    ELSE 'Var'
  END AS kunye_durum
FROM public.musteriler m
LEFT JOIN public.musteri_kunye k
  ON m.id = k.musteri_id;

CREATE OR REPLACE VIEW public.vw_musteri_kunye_form AS
SELECT
  k.*,
  array_to_string(COALESCE(k.pos_mulkiyet_bankalari, '{}'::text[]), ', ') AS pos_mulkiyet_bankalari_text
FROM public.musteri_kunye k;

COMMIT;
