CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Marketplace for investor bids and asks
CREATE TABLE IF NOT EXISTS trade_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('bid', 'ask')),
  symbol TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  investor_id UUID NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mini_cmbs_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pool_name TEXT NOT NULL,
  total_balance NUMERIC NOT NULL,
  coupon_rate NUMERIC NOT NULL,
  structure TEXT,
  auction_type TEXT DEFAULT 'order_book',
  collateral JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mini_cmbs_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES mini_cmbs_pools(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  investor_id UUID,
  side TEXT CHECK (side IN ('bid', 'ask')) NOT NULL,
  price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  loan_name TEXT NOT NULL,
  available_amount NUMERIC NOT NULL,
  min_piece NUMERIC NOT NULL,
  target_yield NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_participation_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES loan_participations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  investor_id UUID,
  bidder TEXT NOT NULL,
  size NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preferred_equity_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  token_name TEXT NOT NULL,
  project TEXT,
  price_per_token NUMERIC NOT NULL,
  total_supply NUMERIC NOT NULL,
  target_irr NUMERIC,
  distribution_frequency TEXT,
  waterfall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preferred_equity_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES preferred_equity_tokens(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  distribution_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generic trade event log for audit trails
CREATE TABLE IF NOT EXISTS trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange specific settlement tracking
ALTER TABLE IF EXISTS exchange_trades ADD COLUMN IF NOT EXISTS escrow_account_id UUID;

CREATE TABLE IF NOT EXISTS exchange_trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES exchange_trades(id) ON DELETE CASCADE,
  status TEXT,
  event_payload JSONB,
  prev_event_hash TEXT,
  event_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hash chain and immutability for trade events
CREATE OR REPLACE FUNCTION set_exchange_trade_event_hash()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
BEGIN
  payload := row_to_json(NEW)::text;
  NEW.event_hash := encode(digest(payload || coalesce(NEW.prev_event_hash,''), 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_trade_events_hash
BEFORE INSERT ON exchange_trade_events
FOR EACH ROW EXECUTE FUNCTION set_exchange_trade_event_hash();

CREATE OR REPLACE FUNCTION prevent_exchange_trade_events_mod()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'exchange_trade_events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exchange_trade_events_immutable
BEFORE UPDATE OR DELETE ON exchange_trade_events
FOR EACH ROW EXECUTE FUNCTION prevent_exchange_trade_events_mod();

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
ALTER TABLE IF EXISTS exchange_listings
  ADD COLUMN IF NOT EXISTS occupancy_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS cashflow_summary JSONB,
  ADD COLUMN IF NOT EXISTS borrower_kpis JSONB,
  ADD COLUMN IF NOT EXISTS marketplace_metrics JSONB,
  ADD COLUMN IF NOT EXISTS dscr_trend JSONB,
  ADD COLUMN IF NOT EXISTS payment_history_summary JSONB;
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

-- Composite indexes for performance
CREATE INDEX IF NOT EXISTS trades_status_created_at_idx
  ON trades (status, created_at);
CREATE INDEX IF NOT EXISTS exchange_trade_events_status_created_at_idx
  ON exchange_trade_events (status, created_at);
CREATE INDEX IF NOT EXISTS exchange_listings_sector_geography_idx
  ON exchange_listings (sector, geography);
CREATE INDEX IF NOT EXISTS exchange_listings_par_amount_idx
 ON exchange_listings (par_amount);
CREATE INDEX IF NOT EXISTS mini_cmbs_orders_pool_id_idx
  ON mini_cmbs_orders (pool_id);
CREATE INDEX IF NOT EXISTS loan_participation_bids_listing_id_idx
  ON loan_participation_bids (listing_id);
CREATE INDEX IF NOT EXISTS preferred_equity_distributions_token_id_idx
  ON preferred_equity_distributions (token_id);
