-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor

CREATE TABLE IF NOT EXISTS deal_analyses (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT        NOT NULL,
  section     TEXT        NOT NULL,  -- 'inspection' | 'insurance' | 'financials'
  filename    TEXT,
  analysis    JSONB       NOT NULL,
  uploaded_by_role TEXT   DEFAULT 'unknown',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deal_analyses_property_id_idx ON deal_analyses (property_id);
CREATE INDEX IF NOT EXISTS deal_analyses_created_at_idx  ON deal_analyses (created_at DESC);

ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON deal_analyses
  FOR ALL USING (true);
