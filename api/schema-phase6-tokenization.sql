-- ============================================================
-- Kontra Phase 6 — Tokenization Execution Layer Schema
-- ============================================================
-- Tables:
--   kontra_token_packages       — ERC-1400 compatible asset packages
--   kontra_investor_wallets     — KYC/AML whitelisted investor wallets
--   kontra_token_transfers      — on-chain transfer history
--   kontra_stablecoin_payments  — interest/principal payments (USDC/USDT/DAI/PYUSD)
--   kontra_token_orders         — secondary market order book
--   kontra_governance_proposals — investor governance proposals
--   kontra_governance_votes     — individual votes on proposals
--   kontra_readiness_assessments — tokenization readiness assessment history
-- ============================================================

-- ── Token Packages (ERC-1400) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_token_packages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID,
  loan_id             TEXT NOT NULL,
  loan_number         TEXT,
  property_address    TEXT,
  property_type       TEXT,
  borrower_name       TEXT,

  -- Financial metrics
  loan_balance        NUMERIC(18, 2),
  property_value      NUMERIC(18, 2),
  ltv                 NUMERIC(6, 4),
  dscr                NUMERIC(6, 4),
  noi                 NUMERIC(18, 2),
  interest_rate       NUMERIC(8, 6),
  maturity_date       DATE,
  origination_date    DATE,

  -- Token structure
  partition_type      TEXT NOT NULL DEFAULT 'whole_loan'
                        CHECK (partition_type IN ('whole_loan','senior','mezzanine','equity')),
  blockchain          TEXT NOT NULL DEFAULT 'ethereum',
  chain_id            INTEGER NOT NULL DEFAULT 1,
  token_standard      TEXT NOT NULL DEFAULT 'ERC-1400',
  contract_address    TEXT,
  total_tokens        INTEGER NOT NULL DEFAULT 1000,
  tokens_issued       INTEGER NOT NULL DEFAULT 0,
  tokens_outstanding  INTEGER NOT NULL DEFAULT 0,
  token_price_usd     NUMERIC(18, 2),
  total_value_usd     NUMERIC(18, 2),

  -- Offering
  ipfs_document_hash  TEXT,
  accredited_only     BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_jurisdictions TEXT[] NOT NULL DEFAULT ARRAY['US','CA','GB','EU','SG','JP'],
  hold_period_days    INTEGER NOT NULL DEFAULT 90,
  min_investment      NUMERIC(18, 2) DEFAULT 25000,
  max_investment      NUMERIC(18, 2),
  offering_size       NUMERIC(18, 2),
  target_yield        NUMERIC(8, 6),
  closing_date        DATE,

  -- State
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','offering','active','matured','redeemed','cancelled')),
  investor_count      INTEGER NOT NULL DEFAULT 0,
  transfer_count      INTEGER NOT NULL DEFAULT 0,

  -- Chain metadata
  block_number        BIGINT,
  tx_hash             TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ktp_org_id    ON kontra_token_packages(org_id);
CREATE INDEX IF NOT EXISTS idx_ktp_loan_id   ON kontra_token_packages(loan_id);
CREATE INDEX IF NOT EXISTS idx_ktp_status    ON kontra_token_packages(status);
CREATE INDEX IF NOT EXISTS idx_ktp_partition ON kontra_token_packages(partition_type);

-- ── Investor Wallets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_investor_wallets (
  address             TEXT PRIMARY KEY,           -- checksummed Ethereum address
  org_id              UUID,
  investor_name       TEXT NOT NULL,
  investor_type       TEXT NOT NULL DEFAULT 'accredited_individual'
                        CHECK (investor_type IN ('institutional','accredited_individual','qualified_purchaser','family_office','reit','pension_fund')),
  jurisdiction        TEXT NOT NULL DEFAULT 'US',
  accredited          BOOLEAN NOT NULL DEFAULT TRUE,

  -- KYC/AML
  kyc_status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (kyc_status IN ('pending','approved','rejected','expired')),
  aml_status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (aml_status IN ('pending','cleared','flagged')),
  ofac_status         TEXT NOT NULL DEFAULT 'cleared'
                        CHECK (ofac_status IN ('cleared','flagged','pending')),

  -- Investor details
  tax_id              TEXT,
  entity_type         TEXT,
  max_position_usd    NUMERIC(18, 2),
  holding_value_usd   NUMERIC(18, 2) NOT NULL DEFAULT 0,
  transfer_count      INTEGER NOT NULL DEFAULT 0,

  -- Approved token packages
  approved_token_ids  UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  whitelisted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kiw_org_id     ON kontra_investor_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_kiw_kyc_status ON kontra_investor_wallets(kyc_status);
CREATE INDEX IF NOT EXISTS idx_kiw_aml_status ON kontra_investor_wallets(aml_status);

-- ── Token Transfers ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_token_transfers (
  transfer_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id            UUID NOT NULL REFERENCES kontra_token_packages(id) ON DELETE CASCADE,
  from_address        TEXT,                        -- null for minting
  to_address          TEXT NOT NULL,
  amount              INTEGER NOT NULL,
  price_usd           NUMERIC(18, 4),
  total_value_usd     NUMERIC(18, 2),
  stablecoin          TEXT CHECK (stablecoin IN ('USDC','USDT','DAI','PYUSD','EURC')),
  transfer_type       TEXT NOT NULL DEFAULT 'secondary'
                        CHECK (transfer_type IN ('purchase','secondary','redemption','forced')),
  tx_hash             TEXT,
  block_number        BIGINT,
  status              TEXT NOT NULL DEFAULT 'confirmed',
  transferred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ktt_token_id  ON kontra_token_transfers(token_id);
CREATE INDEX IF NOT EXISTS idx_ktt_to_addr   ON kontra_token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_ktt_from_addr ON kontra_token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_ktt_type      ON kontra_token_transfers(transfer_type);

-- ── Stablecoin Payments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_stablecoin_payments (
  payment_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id            UUID NOT NULL REFERENCES kontra_token_packages(id) ON DELETE CASCADE,
  from_address        TEXT,
  amount              NUMERIC(18, 6) NOT NULL,    -- human-readable (e.g. 49218.75 USDC)
  amount_raw          TEXT,                       -- on-chain integer (6 or 18 decimals)
  stablecoin          TEXT NOT NULL DEFAULT 'USDC'
                        CHECK (stablecoin IN ('USDC','USDT','DAI','PYUSD','EURC')),
  payment_type        TEXT NOT NULL DEFAULT 'interest'
                        CHECK (payment_type IN ('interest','principal','interest_principal','prepayment','late_fee','payoff')),
  period_start        DATE,
  period_end          DATE,
  tx_hash             TEXT,
  block_number        BIGINT,
  reconciled          BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at       TIMESTAMPTZ,
  notes               TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ksp_token_id   ON kontra_stablecoin_payments(token_id);
CREATE INDEX IF NOT EXISTS idx_ksp_reconciled ON kontra_stablecoin_payments(reconciled);
CREATE INDEX IF NOT EXISTS idx_ksp_stablecoin ON kontra_stablecoin_payments(stablecoin);

-- ── Secondary Market Orders ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_token_orders (
  order_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id            UUID NOT NULL REFERENCES kontra_token_packages(id) ON DELETE CASCADE,
  side                TEXT NOT NULL CHECK (side IN ('buy','sell')),
  investor_address    TEXT NOT NULL,
  amount              INTEGER NOT NULL,
  price_usd           NUMERIC(18, 4) NOT NULL,
  total_value_usd     NUMERIC(18, 2),
  filled_amount       INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','filled','cancelled','expired')),
  expiry              TIMESTAMPTZ,
  placed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kto_token_id ON kontra_token_orders(token_id);
CREATE INDEX IF NOT EXISTS idx_kto_status   ON kontra_token_orders(status);
CREATE INDEX IF NOT EXISTS idx_kto_side     ON kontra_token_orders(side);

-- ── Governance Proposals ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_governance_proposals (
  proposal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID,
  token_id            UUID NOT NULL REFERENCES kontra_token_packages(id) ON DELETE CASCADE,
  proposer_address    TEXT,
  type                TEXT NOT NULL
                        CHECK (type IN ('maturity_extension','rate_modification','property_disposition','servicer_replacement','covenant_waiver','special_distribution')),
  title               TEXT NOT NULL,
  description         TEXT,
  options             JSONB NOT NULL DEFAULT '[{"id":0,"label":"Approve","votes":0},{"id":1,"label":"Reject","votes":0}]',
  voting_deadline     TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','passed','rejected','cancelled')),
  total_voting_power  NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quorum_pct          NUMERIC(5,4) NOT NULL DEFAULT 0.51,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kgp_token_id ON kontra_governance_proposals(token_id);
CREATE INDEX IF NOT EXISTS idx_kgp_status   ON kontra_governance_proposals(status);

-- ── Governance Votes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_governance_votes (
  vote_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id         UUID NOT NULL REFERENCES kontra_governance_proposals(proposal_id) ON DELETE CASCADE,
  voter_address       TEXT NOT NULL,
  option_id           INTEGER NOT NULL,
  voting_power        NUMERIC(18, 4) NOT NULL DEFAULT 1,
  cast_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, voter_address)
);

CREATE INDEX IF NOT EXISTS idx_kgv_proposal_id ON kontra_governance_votes(proposal_id);

-- ── Readiness Assessments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_readiness_assessments (
  assessment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID,
  loan_id             TEXT NOT NULL,
  overall_score       INTEGER NOT NULL,
  status              TEXT NOT NULL
                        CHECK (status IN ('token_ready','conditional','not_ready')),
  dimensions          JSONB NOT NULL DEFAULT '[]',
  blocking_issues     JSONB NOT NULL DEFAULT '[]',
  conditional_issues  JSONB NOT NULL DEFAULT '[]',
  recommendations     JSONB NOT NULL DEFAULT '[]',
  assessed_by         TEXT NOT NULL DEFAULT 'kontra-tokenization-agent-v1',
  assessed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kra_loan_id    ON kontra_readiness_assessments(loan_id);
CREATE INDEX IF NOT EXISTS idx_kra_org_id     ON kontra_readiness_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_kra_status     ON kontra_readiness_assessments(status);

-- ── Seed demo data ────────────────────────────────────────────────────────────

-- Sample token package for LN-0094
INSERT INTO kontra_token_packages (
  loan_id, loan_number, property_address, property_type, borrower_name,
  loan_balance, property_value, ltv, dscr, noi, interest_rate, maturity_date, origination_date,
  partition_type, total_tokens, tokens_issued, tokens_outstanding, token_price_usd, total_value_usd,
  accredited_only, hold_period_days, min_investment, offering_size, target_yield,
  status, investor_count, transfer_count
) VALUES (
  'LN-0094', 'LN-0094', '1204 Harbor View Drive, Miami, FL 33101', 'multifamily', 'Harbor View Partners LLC',
  8750000.00, 12500000.00, 0.70, 1.22, 687500.00, 0.0675, '2028-06-01', '2023-06-01',
  'whole_loan', 1000, 650, 610, 8750.00, 8750000.00,
  TRUE, 90, 25000.00, 8750000.00, 0.0675,
  'active', 8, 12
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE kontra_token_packages IS 'ERC-1400 compatible CRE loan token packages. Each row represents a tokenized loan or tranche thereof. contract_address is the deployed ERC-1400 smart contract.';
COMMENT ON TABLE kontra_investor_wallets IS 'KYC/AML whitelisted investor wallets. Only wallets with kyc_status=approved and aml_status=cleared may receive token transfers. OFAC screening required.';
COMMENT ON TABLE kontra_governance_proposals IS 'Investor governance proposals. Token holders vote proportionally to their holdings. Quorum of 51% required for maturity_extension and property_disposition proposals.';
