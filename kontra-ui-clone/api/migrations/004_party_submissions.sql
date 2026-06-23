-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor

-- Add lifecycle stage to deal_rooms
ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS deal_stage text DEFAULT 'uploading';

-- Party submissions: each party signals "I'm done submitting"
CREATE TABLE IF NOT EXISTS party_submissions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id  text        NOT NULL,
  role         text        NOT NULL,
  name         text,
  email        text,
  doc_count    integer     DEFAULT 0,
  notes        text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(property_id, role)
);

CREATE INDEX IF NOT EXISTS party_submissions_property_id_idx ON party_submissions (property_id);

ALTER TABLE party_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON party_submissions
  FOR ALL USING (true);
