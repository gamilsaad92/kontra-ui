-- Verified Asset Package persistence
-- Run in Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS verified_asset_packages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  TEXT NOT NULL UNIQUE,
  package      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sealed       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE once the deal is funded; blocks auto-regeneration
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vap_property ON verified_asset_packages(property_id);

-- Row-level security mirrors deal_rooms: public read, service-role write
ALTER TABLE verified_asset_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "public_read_vap"
  ON verified_asset_packages FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "service_role_write_vap"
  ON verified_asset_packages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
