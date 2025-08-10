-- Trading tables for financial operations
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT CHECK (trade_type IN ('loan_sale', 'repo')),
  notional_amount NUMERIC,
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

ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS kyc_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_offers ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS exchange_trades ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN DEFAULT FALSE;
