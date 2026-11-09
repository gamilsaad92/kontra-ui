-- Append-only owner revisions for Digital Asset Preparation Packages.
-- The parent package row and its source readiness snapshot remain immutable.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.digital_asset_preparation_packages') IS NULL
     OR to_regclass('public.verified_asset_snapshots') IS NULL THEN
    RAISE EXCEPTION 'Migration 026 requires migrations 024 and 025';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS digital_asset_preparation_package_revisions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id            UUID NOT NULL REFERENCES digital_asset_preparation_packages(id),
  property_id           TEXT NOT NULL,
  revision              INTEGER NOT NULL,
  source_snapshot_id    UUID NOT NULL REFERENCES verified_asset_snapshots(id),
  source_snapshot_version INTEGER NOT NULL,
  source_snapshot_hash  TEXT NOT NULL,
  package_hash          TEXT NOT NULL,
  package               JSONB NOT NULL,
  changed_fields        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_preparation_package_revisions_latest
  ON digital_asset_preparation_package_revisions(package_id, revision DESC);

ALTER TABLE digital_asset_preparation_package_revisions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_asset_preparation_package_revisions'
      AND policyname = 'service_role_digital_asset_preparation_package_revisions'
  ) THEN
    CREATE POLICY "service_role_digital_asset_preparation_package_revisions"
      ON digital_asset_preparation_package_revisions FOR ALL TO service_role
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

REVOKE ALL PRIVILEGES ON TABLE public.digital_asset_preparation_package_revisions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.digital_asset_preparation_package_revisions
  TO service_role;

DO $verify$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.digital_asset_preparation_package_revisions'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on digital_asset_preparation_package_revisions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'digital_asset_preparation_package_revisions'
      AND policyname = 'service_role_digital_asset_preparation_package_revisions'
      AND roles = ARRAY['service_role']::name[]
      AND cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'Service-role policy is missing or incorrectly scoped on digital_asset_preparation_package_revisions';
  END IF;
  IF has_table_privilege('anon', 'public.digital_asset_preparation_package_revisions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.digital_asset_preparation_package_revisions', 'SELECT')
     OR has_table_privilege('anon', 'public.digital_asset_preparation_package_revisions', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.digital_asset_preparation_package_revisions', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.digital_asset_preparation_package_revisions', 'UPDATE')
     OR has_table_privilege('service_role', 'public.digital_asset_preparation_package_revisions', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Unexpected privileges remain on digital_asset_preparation_package_revisions';
  END IF;
END
$verify$;

COMMIT;