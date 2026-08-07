-- Transaction Record — field-level structured data table
-- Run in Supabase SQL editor. Safe to re-run (all statements are IF NOT EXISTS).
-- IMPORTANT: This migration is the authoritative schema change.
-- The application server does NOT create or alter these tables at startup.

-- One row per extracted/confirmed field per deal room.
-- field_key is dotted: category.field_name e.g. 'parties.buyer_entity'
CREATE TABLE IF NOT EXISTS transaction_record_fields (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          TEXT NOT NULL,
  field_key            TEXT NOT NULL,
  field_category       TEXT NOT NULL,  -- asset_identity | transaction | parties | beneficial_ownership | financial | legal | approvals
  display_label        TEXT NOT NULL,
  value_text           TEXT,
  value_json           JSONB,
  status               TEXT NOT NULL DEFAULT 'missing'
                       CHECK (status IN ('missing','extracted','needs_review','verified','conflicting','not_applicable','source_changed')),
  confidence           NUMERIC(4,3),   -- 0.000 – 1.000; null when manually entered
  source_doc_id        UUID,           -- references deal_analyses.id
  source_doc_version   TEXT,           -- document version identifier at extraction time
  source_file_hash     TEXT,           -- SHA-256 of the source file (hex); used to detect replacements
  source_page          INTEGER,
  source_excerpt       TEXT,           -- raw clause the value was pulled from
  extraction_timestamp TIMESTAMPTZ,    -- when AI extraction ran for this field
  extracted_by         TEXT,           -- 'ai' | coordinator email | participant email
  verified_by          TEXT,           -- email of person who confirmed
  verified_role        TEXT,           -- role label: 'Deal Coordinator' | 'Legal Advisor' | 'Workspace Owner' etc.
  verified_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, field_key)
);

-- Indexes covering the access patterns used by the API routes
CREATE INDEX IF NOT EXISTS idx_trf_property    ON transaction_record_fields (property_id);
CREATE INDEX IF NOT EXISTS idx_trf_category    ON transaction_record_fields (property_id, field_category);
CREATE INDEX IF NOT EXISTS idx_trf_status      ON transaction_record_fields (property_id, status);
CREATE INDEX IF NOT EXISTS idx_trf_source_doc  ON transaction_record_fields (source_doc_id);
CREATE INDEX IF NOT EXISTS idx_trf_field_key   ON transaction_record_fields (property_id, field_key);

ALTER TABLE transaction_record_fields ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transaction_record_fields' AND policyname='service_role_trf') THEN
    CREATE POLICY "service_role_trf" ON transaction_record_fields FOR ALL USING (true);
  END IF;
END $$;

-- Approval / audit history for every field change
-- Stores who confirmed, their role, the prior and new value, and the source.
CREATE TABLE IF NOT EXISTS transaction_record_approvals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id              UUID NOT NULL REFERENCES transaction_record_fields(id) ON DELETE CASCADE,
  property_id           TEXT NOT NULL,
  action                TEXT NOT NULL CHECK (action IN ('approved','rejected','flagged','overridden','source_changed')),
  actor_email           TEXT NOT NULL,
  actor_role            TEXT NOT NULL,    -- role label shown to participants
  is_manual             BOOLEAN NOT NULL DEFAULT true,  -- false = provider-supplied
  prior_value           TEXT,
  new_value             TEXT,
  source_doc_id         UUID,             -- supporting document for this change
  source_file_hash      TEXT,             -- hash of the source doc at time of action
  note                  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tra_field    ON transaction_record_approvals (field_id);
CREATE INDEX IF NOT EXISTS idx_tra_property ON transaction_record_approvals (property_id);
CREATE INDEX IF NOT EXISTS idx_tra_created  ON transaction_record_approvals (property_id, created_at DESC);

ALTER TABLE transaction_record_approvals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transaction_record_approvals' AND policyname='service_role_tra') THEN
    CREATE POLICY "service_role_tra" ON transaction_record_approvals FOR ALL USING (true);
  END IF;
END $$;

-- Add extraction columns to deal_analyses (additive — existing rows get NULL)
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS extracted_fields JSONB;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS extraction_version INTEGER DEFAULT 1;
