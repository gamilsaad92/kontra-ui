-- Asset inspections table for document/photo ingestion
CREATE TABLE IF NOT EXISTS asset_inspections (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT REFERENCES assets(id) ON DELETE CASCADE,
  report_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
