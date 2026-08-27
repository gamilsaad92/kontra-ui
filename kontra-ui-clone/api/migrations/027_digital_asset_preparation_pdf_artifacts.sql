-- Append-only human-readable PDFs generated from an exact saved preparation revision.
-- The PDF bytes live in Supabase Storage; this table stores immutable metadata.
CREATE TABLE IF NOT EXISTS digital_asset_preparation_pdf_artifacts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id               UUID NOT NULL REFERENCES digital_asset_preparation_packages(id),
  property_id              TEXT NOT NULL,
  source_snapshot_id       UUID NOT NULL REFERENCES verified_asset_snapshots(id),
  source_snapshot_version INTEGER NOT NULL,
  source_snapshot_hash     TEXT NOT NULL,
  source_revision_id       UUID NOT NULL REFERENCES digital_asset_preparation_package_revisions(id),
  source_revision          INTEGER NOT NULL,
  source_revision_hash     TEXT NOT NULL,
  artifact_hash            TEXT NOT NULL,
  storage_bucket           TEXT NOT NULL,
  storage_path              TEXT NOT NULL,
  filename                 TEXT NOT NULL,
  content_type             TEXT NOT NULL DEFAULT 'application/pdf',
  generated_by             TEXT,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, source_revision_id),
  UNIQUE (artifact_hash)
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_preparation_pdf_artifacts_history
  ON digital_asset_preparation_pdf_artifacts(property_id, package_id, source_revision DESC);

ALTER TABLE digital_asset_preparation_pdf_artifacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'digital_asset_preparation_pdf_artifacts'
      AND policyname = 'service_role_digital_asset_preparation_pdf_artifacts'
  ) THEN
    CREATE POLICY "service_role_digital_asset_preparation_pdf_artifacts"
      ON digital_asset_preparation_pdf_artifacts FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;