-- Canonical document-version state for deal_analyses.
--
-- Scope: add and backfill only is_active, superseded_at, and superseded_by.
-- extraction_version is intentionally unchanged (production uses integer).
-- Transaction Record data, histories, approvals, Verified Asset snapshots,
-- artifacts, files, and room lifecycle data are not touched.
--
-- Exact rollback (destructive to the newly written version metadata):
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- LOCK TABLE public.deal_analyses IN ACCESS EXCLUSIVE MODE;
-- DROP TRIGGER IF EXISTS trg_deal_analyses_system_inactive_version_state
--   ON public.deal_analyses;
-- DROP FUNCTION IF EXISTS
--   public.enforce_deal_analyses_system_inactive_version_state();
-- DROP INDEX IF EXISTS public.idx_deal_analyses_active_version;
-- ALTER TABLE public.deal_analyses
--   DROP COLUMN superseded_by,
--   DROP COLUMN superseded_at,
--   DROP COLUMN is_active;
-- COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';

LOCK TABLE public.deal_analyses IN ACCESS EXCLUSIVE MODE;

-- Fail closed if the audited production preconditions have changed.
DO $$
DECLARE
  v_extraction_version_type text;
  v_existing_version_columns integer;
  v_pending_or_failed integer;
  v_invalid_keys integer;
  v_null_timestamps integer;
  v_unknown_statuses integer;
  v_ambiguous_groups integer;
BEGIN
  SELECT data_type
    INTO v_extraction_version_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'deal_analyses'
     AND column_name = 'extraction_version';

  IF v_extraction_version_type IS DISTINCT FROM 'integer' THEN
    RAISE EXCEPTION
      'Preflight failed: deal_analyses.extraction_version must remain integer (found %)',
      COALESCE(v_extraction_version_type, '<missing>');
  END IF;

  SELECT count(*)
    INTO v_existing_version_columns
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'deal_analyses'
     AND column_name IN ('is_active', 'superseded_at', 'superseded_by');

  IF v_existing_version_columns <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: expected all three document-version columns to be absent; found %',
      v_existing_version_columns;
  END IF;

  IF to_regclass('public.idx_deal_analyses_active_version') IS NOT NULL THEN
    RAISE EXCEPTION
      'Preflight failed: idx_deal_analyses_active_version already exists';
  END IF;

  IF to_regprocedure(
    'public.enforce_deal_analyses_system_inactive_version_state()'
  ) IS NOT NULL THEN
    RAISE EXCEPTION
      'Preflight failed: system document-version trigger function already exists';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'deal_analyses'
       AND t.tgname = 'trg_deal_analyses_system_inactive_version_state'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Preflight failed: system document-version trigger already exists';
  END IF;

  WITH classified AS (
    SELECT
      id,
      property_id,
      section,
      created_at,
      lower(COALESCE(processing_status, '')) AS processing_status,
      COALESCE(lower(uploaded_by_role) = 'verification_engine', false)
        AS verification_engine_row,
      COALESCE(lower(uploaded_by_role) = 'system', false)
        AS generic_system_role,
      COALESCE(section = 'cross_document_verification', false) AS verification_section_row,
      COALESCE(section IN ('verification_summary', 'system'), false) AS generic_system_section,
      COALESCE(analysis -> 'pending' = 'true'::jsonb, false) AS analysis_pending
    FROM public.deal_analyses
  ),
  ordinary AS (
    SELECT *
      FROM classified
     WHERE NOT (
       verification_engine_row
       OR generic_system_role
       OR verification_section_row
       OR generic_system_section
     )
  )
  SELECT count(*)
    INTO v_pending_or_failed
    FROM ordinary
   WHERE processing_status IN ('failed', 'uploaded', 'processing', 'retrying')
      OR analysis_pending;

  IF v_pending_or_failed <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: found % pending or failed ordinary document rows',
      v_pending_or_failed;
  END IF;

  WITH classified AS (
    SELECT
      property_id,
      section,
      created_at,
      lower(COALESCE(processing_status, '')) AS processing_status,
      COALESCE(lower(uploaded_by_role) = 'verification_engine', false)
        AS verification_engine_row,
      COALESCE(lower(uploaded_by_role) = 'system', false)
        AS generic_system_role,
      COALESCE(section = 'cross_document_verification', false) AS verification_section_row,
      COALESCE(section IN ('verification_summary', 'system'), false) AS generic_system_section,
      COALESCE(analysis -> 'pending' = 'true'::jsonb, false) AS analysis_pending
    FROM public.deal_analyses
  ),
  ordinary AS (
    SELECT *
      FROM classified
     WHERE NOT (
       verification_engine_row
       OR generic_system_role
       OR verification_section_row
       OR generic_system_section
     )
  )
  SELECT count(*)
    INTO v_invalid_keys
    FROM ordinary
   WHERE property_id IS NULL
      OR section IS NULL
      OR btrim(section) = '';

  IF v_invalid_keys <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: found % ordinary document rows with unusable group keys',
      v_invalid_keys;
  END IF;

  WITH classified AS (
    SELECT
      property_id,
      section,
      created_at,
      lower(COALESCE(processing_status, '')) AS processing_status,
      COALESCE(lower(uploaded_by_role) = 'verification_engine', false)
        AS verification_engine_row,
      COALESCE(lower(uploaded_by_role) = 'system', false)
        AS generic_system_role,
      COALESCE(section = 'cross_document_verification', false) AS verification_section_row,
      COALESCE(section IN ('verification_summary', 'system'), false) AS generic_system_section
    FROM public.deal_analyses
  ),
  ordinary AS (
    SELECT *
      FROM classified
     WHERE NOT (
       verification_engine_row
       OR generic_system_role
       OR verification_section_row
       OR generic_system_section
     )
  )
  SELECT count(*)
    INTO v_null_timestamps
    FROM ordinary
   WHERE created_at IS NULL;

  IF v_null_timestamps <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: found % ordinary document rows with null created_at',
      v_null_timestamps;
  END IF;

  WITH classified AS (
    SELECT
      property_id,
      section,
      created_at,
      lower(COALESCE(processing_status, '')) AS processing_status,
      COALESCE(lower(uploaded_by_role) = 'verification_engine', false)
        AS verification_engine_row,
      COALESCE(lower(uploaded_by_role) = 'system', false)
        AS generic_system_role,
      COALESCE(section = 'cross_document_verification', false) AS verification_section_row,
      COALESCE(section IN ('verification_summary', 'system'), false) AS generic_system_section,
      COALESCE(analysis -> 'pending' = 'true'::jsonb, false) AS analysis_pending
    FROM public.deal_analyses
  ),
  ordinary AS (
    SELECT *
      FROM classified
     WHERE NOT (
       verification_engine_row
       OR generic_system_role
       OR verification_section_row
       OR generic_system_section
     )
  )
  SELECT count(*)
    INTO v_unknown_statuses
    FROM ordinary
   WHERE processing_status NOT IN (
     '', 'extracted', 'failed', 'uploaded', 'processing', 'retrying'
   );

  IF v_unknown_statuses <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: found % ordinary document rows with unrecognized processing_status',
      v_unknown_statuses;
  END IF;

  WITH classified AS (
    SELECT
      id,
      property_id,
      section,
      created_at,
      lower(COALESCE(processing_status, '')) AS processing_status,
      COALESCE(lower(uploaded_by_role) = 'verification_engine', false)
        AS verification_engine_row,
      COALESCE(lower(uploaded_by_role) = 'system', false)
        AS generic_system_role,
      COALESCE(section = 'cross_document_verification', false) AS verification_section_row,
      COALESCE(section IN ('verification_summary', 'system'), false) AS generic_system_section,
      COALESCE(analysis -> 'pending' = 'true'::jsonb, false) AS analysis_pending
    FROM public.deal_analyses
  ),
  ordinary AS (
    SELECT *
      FROM classified
     WHERE NOT (
       verification_engine_row
       OR generic_system_role
       OR verification_section_row
       OR generic_system_section
     )
       AND property_id IS NOT NULL
       AND section IS NOT NULL
       AND btrim(section) <> ''
  ),
  ranked AS (
    SELECT
      *,
      rank() OVER (
        PARTITION BY property_id, section
        ORDER BY
          CASE
            WHEN processing_status IN ('failed', 'uploaded', 'processing', 'retrying')
              OR analysis_pending
            THEN 1
            ELSE 0
          END ASC,
          created_at DESC NULLS LAST
      ) AS semantic_rank
    FROM ordinary
  ),
  ambiguous AS (
    SELECT property_id, section
      FROM ranked
     GROUP BY property_id, section
    HAVING count(*) FILTER (WHERE semantic_rank = 1) > 1
  )
  SELECT count(*)
    INTO v_ambiguous_groups
    FROM ambiguous;

  IF v_ambiguous_groups <> 0 THEN
    RAISE EXCEPTION
      'Preflight failed: found % ordinary document groups with ambiguous winning ties',
      v_ambiguous_groups;
  END IF;
END;
$$;

-- Add nullable columns first; populate the audited canonical state before
-- establishing the ordinary-row insertion default and NOT NULL constraint.
ALTER TABLE public.deal_analyses
  ADD COLUMN is_active boolean,
  ADD COLUMN superseded_at timestamptz,
  ADD COLUMN superseded_by uuid;

-- Verification/system rows are not ordinary document versions and must not
-- participate in active document projections.
UPDATE public.deal_analyses
   SET is_active = false,
       superseded_at = NULL,
       superseded_by = NULL
 WHERE (
   COALESCE(section = 'cross_document_verification', false)
   OR lower(COALESCE(uploaded_by_role, '')) = 'verification_engine'
   OR COALESCE(section IN ('verification_summary', 'system'), false)
   OR lower(COALESCE(uploaded_by_role, '')) = 'system'
 );

-- Rank ordinary rows using the audited legacy selection semantics: successful
-- rows outrank failed/pending rows; then the newest created_at wins. id is a
-- deterministic final ordering key after the preflight rejects semantic ties.
WITH ordinary_ranked AS (
  SELECT
    id,
    property_id,
    section,
    created_at,
    row_number() OVER (
      PARTITION BY property_id, section
      ORDER BY
        CASE
          WHEN lower(COALESCE(processing_status, ''))
                 IN ('failed', 'uploaded', 'processing', 'retrying')
            OR COALESCE(analysis -> 'pending' = 'true'::jsonb, false)
          THEN 1
          ELSE 0
        END ASC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS version_rank,
    first_value(id) OVER (
      PARTITION BY property_id, section
      ORDER BY
        CASE
          WHEN lower(COALESCE(processing_status, ''))
                 IN ('failed', 'uploaded', 'processing', 'retrying')
            OR COALESCE(analysis -> 'pending' = 'true'::jsonb, false)
          THEN 1
          ELSE 0
        END ASC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS winner_id,
    first_value(created_at) OVER (
      PARTITION BY property_id, section
      ORDER BY
        CASE
          WHEN lower(COALESCE(processing_status, ''))
                 IN ('failed', 'uploaded', 'processing', 'retrying')
            OR COALESCE(analysis -> 'pending' = 'true'::jsonb, false)
          THEN 1
          ELSE 0
        END ASC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS winner_created_at
  FROM public.deal_analyses
  WHERE NOT (
    COALESCE(section = 'cross_document_verification', false)
    OR lower(COALESCE(uploaded_by_role, '')) = 'verification_engine'
    OR COALESCE(section IN ('verification_summary', 'system'), false)
    OR lower(COALESCE(uploaded_by_role, '')) = 'system'
  )
)
UPDATE public.deal_analyses AS document
   SET is_active = (ranked.version_rank = 1),
       superseded_at = CASE
         WHEN ranked.version_rank = 1 THEN NULL
         ELSE ranked.winner_created_at
       END,
       superseded_by = CASE
         WHEN ranked.version_rank = 1 THEN NULL
         ELSE ranked.winner_id
       END
  FROM ordinary_ranked AS ranked
 WHERE document.id = ranked.id;

ALTER TABLE public.deal_analyses
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX idx_deal_analyses_active_version
  ON public.deal_analyses (property_id, section, is_active, created_at DESC);

CREATE FUNCTION public.enforce_deal_analyses_system_inactive_version_state()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (
    COALESCE(NEW.section = 'cross_document_verification', false)
    OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'verification_engine'
    OR COALESCE(NEW.section IN ('verification_summary', 'system'), false)
    OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'system'
  ) THEN
    NEW.is_active := false;
    NEW.superseded_at := NULL;
    NEW.superseded_by := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_deal_analyses_system_inactive_version_state
  BEFORE INSERT OR UPDATE ON public.deal_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deal_analyses_system_inactive_version_state();

-- Required in-transaction postflight assertions. Keep the full system-row
-- category predicate parenthesized before applying the state checks.
DO $$
DECLARE
  v_invalid_groups integer;
  v_invalid_system_rows integer;
  v_invalid_metadata integer;
BEGIN
  WITH ordinary AS (
    SELECT property_id, section, is_active
      FROM public.deal_analyses
     WHERE NOT (
       COALESCE(section = 'cross_document_verification', false)
       OR lower(COALESCE(uploaded_by_role, '')) = 'verification_engine'
       OR COALESCE(section IN ('verification_summary', 'system'), false)
       OR lower(COALESCE(uploaded_by_role, '')) = 'system'
     )
       AND property_id IS NOT NULL
       AND section IS NOT NULL
       AND btrim(section) <> ''
  )
  SELECT count(*)
    INTO v_invalid_groups
    FROM (
      SELECT property_id, section
        FROM ordinary
       GROUP BY property_id, section
      HAVING count(*) FILTER (WHERE is_active) <> 1
    ) AS invalid_groups;

  IF v_invalid_groups <> 0 THEN
    RAISE EXCEPTION
      'Postflight failed: % ordinary document groups do not have exactly one active version',
      v_invalid_groups;
  END IF;

  SELECT count(*)
    INTO v_invalid_system_rows
    FROM public.deal_analyses
   WHERE (
     COALESCE(section = 'cross_document_verification', false)
     OR lower(COALESCE(uploaded_by_role, '')) = 'verification_engine'
     OR COALESCE(section IN ('verification_summary', 'system'), false)
     OR lower(COALESCE(uploaded_by_role, '')) = 'system'
   )
     AND (
       is_active IS DISTINCT FROM false
       OR superseded_at IS NOT NULL
       OR superseded_by IS NOT NULL
     );

  IF v_invalid_system_rows <> 0 THEN
    RAISE EXCEPTION
      'Postflight failed: % recognized system rows have invalid version state',
      v_invalid_system_rows;
  END IF;

  SELECT count(*)
    INTO v_invalid_metadata
    FROM public.deal_analyses AS document
   WHERE NOT (
     COALESCE(document.section = 'cross_document_verification', false)
     OR lower(COALESCE(document.uploaded_by_role, '')) = 'verification_engine'
     OR COALESCE(document.section IN ('verification_summary', 'system'), false)
     OR lower(COALESCE(document.uploaded_by_role, '')) = 'system'
   )
     AND (
       (
         document.is_active
         AND (document.superseded_at IS NOT NULL OR document.superseded_by IS NOT NULL)
       )
       OR (
         NOT document.is_active
         AND (
           document.superseded_at IS NULL
           OR document.superseded_by IS NULL
           OR NOT EXISTS (
             SELECT 1
               FROM public.deal_analyses AS winner
              WHERE winner.id = document.superseded_by
                AND winner.property_id = document.property_id
                AND winner.section = document.section
                AND winner.is_active
           )
         )
       )
     );

  IF v_invalid_metadata <> 0 THEN
    RAISE EXCEPTION
      'Postflight failed: % ordinary rows have invalid supersession metadata',
      v_invalid_metadata;
  END IF;
END;
$$;

COMMIT;