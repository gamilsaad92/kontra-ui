ALTER TABLE IF EXISTS loans
  ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE INDEX IF NOT EXISTS idx_loans_org ON loans (organization_id);

ALTER TABLE IF EXISTS exchange_listings
  ADD COLUMN IF NOT EXISTS marketplace_metrics JSONB DEFAULT '{}'::jsonb;

UPDATE exchange_listings
SET marketplace_metrics = '{}'::jsonb
WHERE marketplace_metrics IS NULL;
