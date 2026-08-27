-- Append-only owner revisions for Digital Asset Preparation Packages.
-- The parent package row and its source readiness snapshot remain immutable.
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
      ON digital_asset_preparation_package_revisions FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;