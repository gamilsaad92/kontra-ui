-- Private Credit Distribution (permissioned market) schema
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('internal', 'partner')),
  brand JSONB DEFAULT '{}'::jsonb,
  access_policy JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_tenant_id ON markets(tenant_id);

CREATE TABLE IF NOT EXISTS tokenized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  loan_id BIGINT REFERENCES loans(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('loan', 'tranche')),
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'polygon', 'solana', 'testnet')),
  contract_address TEXT,
  decimals INTEGER NOT NULL DEFAULT 0,
  total_supply NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'minted', 'paused', 'retired')) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokenized_assets_tenant_id ON tokenized_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_status ON tokenized_assets(status);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_loan_id ON tokenized_assets(loan_id);

CREATE TABLE IF NOT EXISTS offering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tokenized_asset_id UUID REFERENCES tokenized_assets(id) ON DELETE CASCADE,
  offering_type TEXT NOT NULL CHECK (offering_type IN ('fixed', 'rfq')),
  min_ticket NUMERIC,
  max_ticket NUMERIC,
  price_type TEXT NOT NULL CHECK (price_type IN ('par', 'premium', 'discount', 'yield')),
  price_value NUMERIC,
  target_yield_bps NUMERIC,
  settlement_terms JSONB DEFAULT '{}'::jsonb,
  disclosure_pack_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'proposed', 'approved', 'listed', 'suspended', 'closed')) DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID,
  market_id UUID REFERENCES markets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offering_tenant_id ON offering(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offering_status ON offering(status);
CREATE INDEX IF NOT EXISTS idx_offering_tokenized_asset ON offering(tokenized_asset_id);

CREATE TABLE IF NOT EXISTS offering_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID REFERENCES offering(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('whitelist_group', 'org', 'wallet', 'market')),
  org_id UUID,
  wallet_address TEXT,
  group_key TEXT,
  market_id UUID REFERENCES markets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offering_access_tenant_id ON offering_access(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offering_access_offering_id ON offering_access(offering_id);

CREATE TABLE IF NOT EXISTS rfq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID REFERENCES offering(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL,
  buyer_user_id UUID NOT NULL,
  requested_amount NUMERIC NOT NULL,
  requested_price_value NUMERIC,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'expired')) DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_offering_id ON rfq(offering_id);
CREATE INDEX IF NOT EXISTS idx_rfq_buyer_org_id ON rfq(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfq(status);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID REFERENCES offering(id) ON DELETE SET NULL,
  rfq_id UUID REFERENCES rfq(id) ON DELETE SET NULL,
  buyer_org_id UUID NOT NULL,
  seller_org_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  price_value NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'settled', 'failed', 'cancelled')) DEFAULT 'pending',
  settlement_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_offering_id ON trades(offering_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_org_id ON trades(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

CREATE TABLE IF NOT EXISTS approvals_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('offering', 'trade', 'tokenized_asset')),
  object_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes')),
  requested_by UUID,
  assigned_to_role TEXT NOT NULL CHECK (assigned_to_role IN ('admin', 'compliance', 'capital_markets')),
  status TEXT NOT NULL CHECK (status IN ('open', 'approved', 'rejected')) DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_queue_tenant_id ON approvals_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_queue_status ON approvals_queue(status);

CREATE TABLE IF NOT EXISTS kyc_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  org_id UUID,
  wallet_address TEXT,
  kyc_status TEXT NOT NULL CHECK (kyc_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  accreditation TEXT NOT NULL CHECK (accreditation IN ('unknown', 'verified')) DEFAULT 'unknown',
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'med', 'high')) DEFAULT 'low',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_registry_tenant_id ON kyc_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_registry_org_id ON kyc_registry(org_id);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trade_approval_min_amount NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID,
  before_status TEXT,
  after_status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_object_type ON audit_events(object_type);

ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokenized_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY markets_tenant_policy ON markets
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY tokenized_assets_tenant_policy ON tokenized_assets
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY offering_tenant_policy ON offering
  USING (
    tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text)
    AND (
      status <> 'listed'
      OR EXISTS (
        SELECT 1 FROM offering_access oa
        WHERE oa.offering_id = offering.id
          AND oa.tenant_id = offering.tenant_id
          AND (
            oa.org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', oa.org_id::text)
            OR oa.wallet_address = (current_setting('request.jwt.claims', true)::jsonb ->> 'wallet')
            OR oa.group_key = ANY (string_to_array(coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'groups', ''), ','))
          )
      )
    )
  )
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY offering_access_tenant_policy ON offering_access
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY rfq_access_policy ON rfq
  USING (
    buyer_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', buyer_org_id::text)
    OR EXISTS (
      SELECT 1 FROM offering o
      WHERE o.id = rfq.offering_id
        AND o.tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', o.tenant_id::text)
    )
  )
  WITH CHECK (buyer_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', buyer_org_id::text));

CREATE POLICY trades_access_policy ON trades
  USING (
    buyer_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', buyer_org_id::text)
    OR seller_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', seller_org_id::text)
    OR coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') IN ('admin', 'compliance')
  )
  WITH CHECK (
    buyer_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', buyer_org_id::text)
    OR seller_org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', seller_org_id::text)
    OR coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') IN ('admin', 'compliance')
  );

CREATE POLICY approvals_queue_tenant_policy ON approvals_queue
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY kyc_registry_tenant_policy ON kyc_registry
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY tenant_settings_tenant_policy ON tenant_settings
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text))
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY audit_events_insert_policy ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));

CREATE POLICY audit_events_select_policy ON audit_events
  FOR SELECT
  USING (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', tenant_id::text));
