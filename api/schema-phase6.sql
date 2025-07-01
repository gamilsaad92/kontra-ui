-- Asset inspections table for document/photo ingestion
CREATE TABLE IF NOT EXISTS asset_inspections (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT REFERENCES assets(id) ON DELETE CASCADE,
  report_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for assets experiencing issues
CREATE TABLE IF NOT EXISTS troubled_assets (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT REFERENCES assets(id) ON DELETE CASCADE,
  file_url TEXT,
  ai_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
