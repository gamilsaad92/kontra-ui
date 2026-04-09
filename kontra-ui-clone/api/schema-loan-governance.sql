-- =============================================================
-- Kontra Loan Governance — Role Separation Schema
-- DEV ONLY — Run in Supabase SQL Editor when ready to deploy
-- =============================================================

-- ── Governance Roles ──────────────────────────────────────────
-- Role values: lender_controller, master_servicer,
--              special_servicer, asset_manager, investor, admin

CREATE TABLE IF NOT EXISTS governance_role_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN (
                     'lender_controller','master_servicer','special_servicer',
                     'asset_manager','investor','admin'
                   )),
  assigned_by      UUID REFERENCES users(id),
  voting_power     NUMERIC(7,4) DEFAULT 0,  -- fractional %, for investor role
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_gov_roles_org ON governance_role_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_gov_roles_user ON governance_role_assignments(user_id);

-- ── Governance Proposals ──────────────────────────────────────

CREATE TYPE IF NOT EXISTS proposal_type_enum AS ENUM (
  'loan_extension',
  'rate_modification',
  'collateral_disposition',
  'distribution_policy',
  'servicer_replacement',
  'workout_strategy',
  'other'
);

CREATE TYPE IF NOT EXISTS proposal_status_enum AS ENUM (
  'draft', 'active', 'approved', 'rejected', 'expired', 'executed'
);

CREATE TABLE IF NOT EXISTS governance_proposals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id          UUID REFERENCES loans(id),
  proposal_number  TEXT NOT NULL,            -- e.g. GV-047
  proposal_type    proposal_type_enum NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  proposed_by      UUID REFERENCES users(id),
  proposed_by_role TEXT NOT NULL,
  threshold_pct    NUMERIC(5,2) NOT NULL,    -- % of votes needed to approve
  quorum_pct       NUMERIC(5,2) NOT NULL,    -- % of total voting power needed
  voting_deadline  TIMESTAMPTZ NOT NULL,
  status           proposal_status_enum NOT NULL DEFAULT 'draft',
  votes_for_pct    NUMERIC(5,2) DEFAULT 0,
  votes_against_pct NUMERIC(5,2) DEFAULT 0,
  votes_abstain_pct NUMERIC(5,2) DEFAULT 0,
  total_voting_power_cast NUMERIC(10,4) DEFAULT 0,
  quorum_met       BOOLEAN DEFAULT FALSE,
  blockchain_tx_hash TEXT,                   -- recorded on-chain after outcome
  executed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_org ON governance_proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_loan ON governance_proposals(loan_id);

-- ── Governance Votes ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_votes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      UUID NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
  voter_id         UUID NOT NULL REFERENCES users(id),
  vote             TEXT NOT NULL CHECK (vote IN ('for','against','abstain')),
  voting_power     NUMERIC(7,4) NOT NULL,    -- voter's share at time of vote
  rationale        TEXT,
  cast_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blockchain_tx_hash TEXT,
  UNIQUE (proposal_id, voter_id)
);

-- ── Governance Audit Log ──────────────────────────────────────
-- Every action across ALL roles is logged here.
-- decision_category: 'servicing' | 'governance'
-- action_type: e.g. 'payment_processed', 'proposal_approved', 'draw_released'

CREATE TABLE IF NOT EXISTS governance_audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id             UUID REFERENCES loans(id),
  actor_user_id       UUID REFERENCES users(id),
  actor_role          TEXT NOT NULL,
  action_type         TEXT NOT NULL,
  decision_category   TEXT NOT NULL CHECK (decision_category IN ('servicing','governance')),
  description         TEXT NOT NULL,
  metadata            JSONB DEFAULT '{}',
  outcome             TEXT,                  -- e.g. 'approved', 'executed', 'denied'
  proposal_id         UUID REFERENCES governance_proposals(id),
  blockchain_tx_hash  TEXT,
  ip_address          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON governance_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_loan ON governance_audit_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_category ON governance_audit_log(decision_category);
CREATE INDEX IF NOT EXISTS idx_audit_created ON governance_audit_log(created_at DESC);

-- ── Row-Level Security ─────────────────────────────────────────
ALTER TABLE governance_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_proposals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_audit_log        ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; app-level checks enforce role-based access
