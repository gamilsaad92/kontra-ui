-- Immutable Digital Asset Preparation Packages.
-- Each artifact is generated from one persisted eligible readiness snapshot.
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
      ON digital_asset_preparation_packages FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;