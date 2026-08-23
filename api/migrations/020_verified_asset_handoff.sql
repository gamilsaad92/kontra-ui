-- Provider-neutral Verified Asset Package handoff metadata.
-- The existing package JSON remains the customer-facing artifact; these columns
-- make revisions auditable and safe to retry by a future external consumer.
ALTER TABLE verified_asset_packages
  ADD COLUMN IF NOT EXISTS schema_version TEXT,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_state_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vap_handoff_key
  ON verified_asset_packages(property_id, handoff_key)
  WHERE handoff_key IS NOT NULL;