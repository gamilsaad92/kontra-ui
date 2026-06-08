-- Run this once in your Supabase SQL editor to enable property persistence.
-- The API endpoints fail gracefully if this table doesn't exist yet.

CREATE TABLE IF NOT EXISTS user_properties (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  type          TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  units         INTEGER,
  sqft          INTEGER,
  year_built    INTEGER,
  occupancy     NUMERIC(5,2),
  noi           NUMERIC(14,2),
  status        TEXT        NOT NULL DEFAULT 'Active',
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_properties_user_id_idx ON user_properties(user_id);

-- Row-level security: users can only read/write their own properties
ALTER TABLE user_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own properties"
  ON user_properties
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_properties_updated_at ON user_properties;
CREATE TRIGGER update_user_properties_updated_at
  BEFORE UPDATE ON user_properties
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
