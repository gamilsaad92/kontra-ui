-- Immutable Digital Asset Preparation Packages.
-- Each artifact is generated from one persisted eligible readiness snapshot.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.verified_asset_snapshots') IS NULL THEN
    RAISE EXCEPTION 'Migration 025 requires public.verified_asset_snapshots';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS digital_asset_preparation_packages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           TEXT NOT NULL,
  source_snapshot_id    UUID NOT NULL REFERENCES verified_asset_snapshots(id),
  source_snapshot_version INTEGER NOT NULL,
  source_snapshot_hash  TEXT NOT NULL,
  package_hash          TEXT NOT NULL,
  package               JSONB NOT NULL,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, source_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_preparation_packages_property
  ON digital_asset_preparation_packages(property_id, created_at DESC);

ALTER TABLE digital_asset_preparation_packages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_asset_preparation_packages'
      AND policyname = 'service_role_digital_asset_preparation_packages'
  ) THEN
    CREATE POLICY "service_role_digital_asset_preparation_packages"
      ON digital_asset_preparation_packages FOR ALL TO service_role
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

REVOKE ALL PRIVILEGES ON TABLE public.digital_asset_preparation_packages
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.digital_asset_preparation_packages
  TO service_role;

DO $verify$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.digital_asset_preparation_packages'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on digital_asset_preparation_packages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'digital_asset_preparation_packages'
      AND policyname = 'service_role_digital_asset_preparation_packages'
      AND roles = ARRAY['service_role']::name[]
      AND cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'Service-role policy is missing or incorrectly scoped on digital_asset_preparation_packages';
  END IF;
  IF has_table_privilege('anon', 'public.digital_asset_preparation_packages', 'SELECT')
     OR has_table_privilege('authenticated', 'public.digital_asset_preparation_packages', 'SELECT')
     OR has_table_privilege('anon', 'public.digital_asset_preparation_packages', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.digital_asset_preparation_packages', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.digital_asset_preparation_packages', 'UPDATE')
     OR has_table_privilege('service_role', 'public.digital_asset_preparation_packages', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Unexpected privileges remain on digital_asset_preparation_packages';
  END IF;
END
$verify$;

COMMIT;