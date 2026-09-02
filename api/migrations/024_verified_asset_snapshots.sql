-- Immutable, versioned Verified Asset / Digital Asset Readiness snapshots.
-- Snapshots are derived from canonical Transaction Record state and are never
-- updated in place. A changed source state creates a new version.
CREATE TABLE IF NOT EXISTS verified_asset_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      TEXT NOT NULL,
  version          INTEGER NOT NULL,
  snapshot_hash    TEXT NOT NULL,
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('eligible', 'ineligible')),
  source_state_at  TIMESTAMPTZ,
  snapshot         JSONB NOT NULL,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, version),
  UNIQUE (property_id, snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_vas_property_version
  ON verified_asset_snapshots(property_id, version DESC);

ALTER TABLE verified_asset_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'verified_asset_snapshots' AND policyname = 'service_role_vas'
  ) THEN
    CREATE POLICY "service_role_vas"
      ON verified_asset_snapshots FOR ALL USING (true);
  END IF;
END $$;