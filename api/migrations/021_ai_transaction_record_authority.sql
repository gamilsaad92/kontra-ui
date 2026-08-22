-- Durable definition metadata for AI-generated Transaction Record fields.
-- This is additive and leaves template-room schemas unchanged.
ALTER TABLE transaction_record_fields
  ADD COLUMN IF NOT EXISTS definition_key text,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS conflict_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE transaction_record_fields
SET definition_key = field_key
WHERE definition_key IS NULL;

CREATE INDEX IF NOT EXISTS transaction_record_fields_definition_idx
  ON transaction_record_fields(property_id, definition_key);