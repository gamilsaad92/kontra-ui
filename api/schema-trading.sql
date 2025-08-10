-- Trading tables for financial operations
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT CHECK (
    trade_type IN (
      'loan_sale',
      'participation',
      'syndication_assignment',
      'portfolio_sale',
      'repo',
      'reverse_repo',
      'securitization_allocation',
      'debt_facility_draw'
    )
  ),
  notional_amount NUMERIC,
   repo_rate_bps NUMERIC,
  term_days INTEGER,
  collateral_ref UUID,
  tranche_id UUID,
  waterfall_config JSONB,
  facility_line_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  counterparty_id UUID NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  settlement_date TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange specific settlement tracking
ALTER TABLE IF EXISTS exchange_trades ADD COLUMN IF NOT EXISTS escrow_account_id UUID;

CREATE TABLE IF NOT EXISTS exchange_trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES exchange_trades(id) ON DELETE CASCADE,
  status TEXT,
  event_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Child assets for portfolio sales
CREATE TABLE IF NOT EXISTS exchange_trade_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES exchange_trades(id) ON DELETE CASCADE,
  asset_ref_id UUID NOT NULL,
  amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS kyc_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_offers ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_trades ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;

-- Full-text search index for exchange listings
ALTER TABLE IF EXISTS exchange_listings
  ADD COLUMN IF NOT EXISTS coupon_bps NUMERIC,
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(sector,'') || ' ' ||
      coalesce(borrower_name,'') || ' ' ||
      coalesce(geography,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS exchange_listings_search_idx
  ON exchange_listings USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS exchange_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  search_text TEXT,
  filters JSONB,
  notify_email BOOLEAN DEFAULT FALSE,
  notify_sms BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
