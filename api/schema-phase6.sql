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

-- Hazard loss records linked to draw requests
CREATE TABLE IF NOT EXISTS hazard_losses (
  id BIGSERIAL PRIMARY KEY,
  draw_id BIGINT REFERENCES draw_requests(id) ON DELETE CASCADE,
  part_i JSONB NOT NULL,
  follow_up JSONB,
  restoration JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
