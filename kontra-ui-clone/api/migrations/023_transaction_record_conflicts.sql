-- Durable, source-linked conflicts found while extracting Transaction Record fields.
-- The canonical field row remains the value shown to coordinators; this table keeps
-- every unresolved disagreement without overwriting that value.
CREATE TABLE IF NOT EXISTS transaction_record_conflicts (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                TEXT NOT NULL,
  field_id                   UUID REFERENCES transaction_record_fields(id) ON DELETE SET NULL,
  field_key                  TEXT NOT NULL,
  display_label              TEXT NOT NULL,
  canonical_value             TEXT,
  conflicting_value           TEXT NOT NULL,
  canonical_source_doc_id     UUID,
  conflicting_source_doc_id   UUID,
  canonical_source_page       INTEGER,
  conflicting_source_page     INTEGER,
  canonical_source_excerpt    TEXT,
  conflicting_source_excerpt  TEXT,
  status                     TEXT NOT NULL DEFAULT 'unresolved'
                             CHECK (status IN ('unresolved', 'resolved')),
  resolution_value            TEXT,
  resolution_note             TEXT,
  resolved_by                 TEXT,
  resolved_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trc_one_open_per_field
  ON transaction_record_conflicts (property_id, field_key)
  WHERE status = 'unresolved';
CREATE INDEX IF NOT EXISTS idx_trc_property_status
  ON transaction_record_conflicts (property_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trc_source
  ON transaction_record_conflicts (canonical_source_doc_id, conflicting_source_doc_id);

ALTER TABLE transaction_record_conflicts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transaction_record_conflicts'
      AND policyname = 'service_role_trc'
  ) THEN
    CREATE POLICY "service_role_trc"
      ON transaction_record_conflicts FOR ALL USING (true);
  END IF;
END $$;