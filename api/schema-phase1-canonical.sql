-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: Enterprise Core — Canonical Entity Extensions
-- Run after: 001_canonical_schema.sql, schema-workflow-ai-v1.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto for gen_random_uuid() if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── BORROWERS ─────────────────────────────────────────────────────────────────
-- Borrower entities separate from user accounts (legal persons/entities)
CREATE TABLE IF NOT EXISTS borrowers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_name     TEXT NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('individual','llc','lp','corporation','trust','other')),
  tax_id          TEXT,
  primary_contact_name  TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  address_street  TEXT,
  address_city    TEXT,
  address_state   TEXT,
  address_zip     TEXT,
  credit_score    INTEGER,
  net_worth_usd   BIGINT,
  liquidity_usd   BIGINT,
  kyc_status      TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','in_progress','approved','flagged','rejected')),
  kyc_reviewed_at TIMESTAMPTZ,
  kyc_notes       TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','watch','defaulted')),
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_borrowers_org ON borrowers(org_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);

-- ── PROPERTIES ────────────────────────────────────────────────────────────────
-- Collateral properties tied to loans
CREATE TABLE IF NOT EXISTS properties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id              UUID REFERENCES loans(id) ON DELETE SET NULL,
  property_name        TEXT,
  property_type        TEXT NOT NULL CHECK (property_type IN ('multifamily','office','retail','industrial','hotel','mixed_use','land','other')),
  address_street       TEXT NOT NULL,
  address_city         TEXT NOT NULL,
  address_state        TEXT NOT NULL,
  address_zip          TEXT,
  year_built           INTEGER,
  gross_sf             INTEGER,
  net_sf               INTEGER,
  units                INTEGER,
  occupancy_pct        NUMERIC(5,2),
  appraised_value_usd  BIGINT,
  appraisal_date       DATE,
  as_stabilized_value  BIGINT,
  cap_rate             NUMERIC(6,4),
  noi_annual_usd       BIGINT,
  last_inspection_date DATE,
  environmental_status TEXT DEFAULT 'clear' CHECK (environmental_status IN ('clear','phase_i_required','phase_ii_required','remediation','clean')),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reo','sold','demolished')),
  data                 JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(org_id);
CREATE INDEX IF NOT EXISTS idx_properties_loan ON properties(loan_id);

-- ── DEFICIENCIES ──────────────────────────────────────────────────────────────
-- Inspection deficiencies (property-level issues identified during site visits)
CREATE TABLE IF NOT EXISTS deficiencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inspection_id    UUID,  -- references inspections table
  property_id      UUID REFERENCES properties(id) ON DELETE SET NULL,
  loan_id          UUID REFERENCES loans(id) ON DELETE SET NULL,
  deficiency_type  TEXT NOT NULL CHECK (deficiency_type IN ('structural','mechanical','electrical','plumbing','roofing','life_safety','environmental','deferred_maintenance','code_violation','other')),
  severity         TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('critical','high','medium','low','informational')),
  description      TEXT NOT NULL,
  location_detail  TEXT,
  estimated_cost   BIGINT,
  reserve_required BOOLEAN DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','cured','waived','escalated')),
  cure_deadline    DATE,
  cured_at         TIMESTAMPTZ,
  cured_by         TEXT,
  cure_evidence    TEXT,
  assigned_to      TEXT,
  notes            TEXT,
  data             JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deficiencies_org ON deficiencies(org_id);
CREATE INDEX IF NOT EXISTS idx_deficiencies_loan ON deficiencies(loan_id);
CREATE INDEX IF NOT EXISTS idx_deficiencies_status ON deficiencies(status);
CREATE INDEX IF NOT EXISTS idx_deficiencies_severity ON deficiencies(severity);

-- ── HAZARD LOSS EVENTS ────────────────────────────────────────────────────────
-- Insurance claims, natural disasters, property damage events
CREATE TABLE IF NOT EXISTS hazard_loss_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id               UUID REFERENCES loans(id) ON DELETE SET NULL,
  property_id           UUID REFERENCES properties(id) ON DELETE SET NULL,
  event_type            TEXT NOT NULL CHECK (event_type IN ('fire','flood','earthquake','hurricane','hail','vandalism','liability','other')),
  event_date            DATE NOT NULL,
  description           TEXT NOT NULL,
  estimated_loss_usd    BIGINT,
  insured_loss_usd      BIGINT,
  deductible_usd        BIGINT,
  claim_number          TEXT,
  insurer_name          TEXT,
  adjuster_name         TEXT,
  adjuster_phone        TEXT,
  adjuster_email        TEXT,
  claim_filed_date      DATE,
  claim_status          TEXT NOT NULL DEFAULT 'filed' CHECK (claim_status IN ('not_filed','filed','under_review','approved','denied','settled','closed')),
  settlement_amount_usd BIGINT,
  settlement_date       DATE,
  disbursement_status   TEXT NOT NULL DEFAULT 'pending' CHECK (disbursement_status IN ('pending','approved','disbursed','held_in_reserve','denied')),
  disbursed_amount_usd  BIGINT,
  disbursed_at          TIMESTAMPTZ,
  reserve_holdback_usd  BIGINT,
  release_conditions    TEXT,
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','monitoring','closed')),
  workflow_run_id       UUID,
  data                  JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hazard_loss_org ON hazard_loss_events(org_id);
CREATE INDEX IF NOT EXISTS idx_hazard_loss_loan ON hazard_loss_events(loan_id);

-- ── RESERVES ──────────────────────────────────────────────────────────────────
-- Loan-level reserve accounts (operating, interest, capex, tax, insurance)
CREATE TABLE IF NOT EXISTS reserves (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  reserve_type        TEXT NOT NULL CHECK (reserve_type IN ('operating','interest','capex','tax_insurance','repair_replacement','deferred_maintenance','hazard_insurance','environmental','other')),
  label               TEXT,
  required_balance_usd   BIGINT NOT NULL DEFAULT 0,
  current_balance_usd    BIGINT NOT NULL DEFAULT 0,
  monthly_deposit_usd    BIGINT DEFAULT 0,
  last_funded_at         TIMESTAMPTZ,
  last_disbursed_at      TIMESTAMPTZ,
  disbursement_trigger   TEXT,
  disbursement_conditions TEXT,
  status               TEXT NOT NULL DEFAULT 'funded' CHECK (status IN ('funded','underfunded','depleted','released','waived')),
  release_date         DATE,
  notes                TEXT,
  data                 JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reserves_org ON reserves(org_id);
CREATE INDEX IF NOT EXISTS idx_reserves_loan ON reserves(loan_id);
CREATE INDEX IF NOT EXISTS idx_reserves_type ON reserves(reserve_type);

-- ── COVENANTS ─────────────────────────────────────────────────────────────────
-- Loan covenant definitions, test periods, and current compliance status
CREATE TABLE IF NOT EXISTS covenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  covenant_type       TEXT NOT NULL CHECK (covenant_type IN ('dscr','ltv','occupancy','debt_yield','net_worth','liquidity','recourse_trigger','cash_sweep','interest_coverage','other')),
  label               TEXT NOT NULL,
  description         TEXT,
  threshold_value     NUMERIC NOT NULL,
  threshold_operator  TEXT NOT NULL DEFAULT '>=' CHECK (threshold_operator IN ('>=','>','<=','<','=')),
  test_frequency      TEXT NOT NULL DEFAULT 'quarterly' CHECK (test_frequency IN ('monthly','quarterly','semi_annual','annual','event_driven')),
  next_test_date      DATE,
  last_tested_at      TIMESTAMPTZ,
  last_tested_value   NUMERIC,
  current_status      TEXT NOT NULL DEFAULT 'passing' CHECK (current_status IN ('passing','failing','cure_period','waived','not_yet_tested')),
  violation_date      DATE,
  cure_deadline       DATE,
  cure_period_days    INTEGER DEFAULT 30,
  cure_description    TEXT,
  consequence_if_uncured TEXT,
  is_springing        BOOLEAN DEFAULT FALSE,
  springing_condition TEXT,
  workflow_run_id     UUID,
  data                JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_covenants_org ON covenants(org_id);
CREATE INDEX IF NOT EXISTS idx_covenants_loan ON covenants(loan_id);
CREATE INDEX IF NOT EXISTS idx_covenants_status ON covenants(current_status);

-- ── MATURITIES ────────────────────────────────────────────────────────────────
-- Maturity tracking with extension option monitoring
CREATE TABLE IF NOT EXISTS maturities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id               UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  original_maturity_date DATE NOT NULL,
  current_maturity_date  DATE NOT NULL,
  extension_options_total INTEGER DEFAULT 0,
  extensions_used         INTEGER DEFAULT 0,
  extension_option_months INTEGER,
  extension_conditions    TEXT,
  alert_90_day_sent_at    TIMESTAMPTZ,
  alert_60_day_sent_at    TIMESTAMPTZ,
  alert_30_day_sent_at    TIMESTAMPTZ,
  alert_14_day_sent_at    TIMESTAMPTZ,
  extension_request_status TEXT DEFAULT 'none' CHECK (extension_request_status IN ('none','requested','under_review','approved','denied','executed')),
  extension_request_date  DATE,
  extension_approved_date DATE,
  extension_fee_usd       BIGINT,
  payoff_quote_requested  BOOLEAN DEFAULT FALSE,
  payoff_quote_date       DATE,
  payoff_amount_usd       BIGINT,
  investor_vote_required  BOOLEAN DEFAULT FALSE,
  workflow_run_id         UUID,
  status                  TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current','approaching','critical','extended','paid_off','defaulted')),
  notes                   TEXT,
  data                    JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maturities_org ON maturities(org_id);
CREATE INDEX IF NOT EXISTS idx_maturities_loan ON maturities(loan_id);
CREATE INDEX IF NOT EXISTS idx_maturities_current_date ON maturities(current_maturity_date);

-- ── WATCHLIST ITEMS ───────────────────────────────────────────────────────────
-- Loans under enhanced monitoring / special watch
CREATE TABLE IF NOT EXISTS watchlist_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id             UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  watch_category      TEXT NOT NULL CHECK (watch_category IN ('delinquency','covenant_breach','maturity_risk','collateral_decline','sponsor_distress','market_risk','construction_delay','environmental','litigation','other')),
  risk_rating         TEXT NOT NULL DEFAULT 'watch' CHECK (risk_rating IN ('watch','substandard','doubtful','loss')),
  trigger_description TEXT NOT NULL,
  added_by            TEXT,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_frequency    TEXT NOT NULL DEFAULT 'monthly' CHECK (review_frequency IN ('weekly','bi_weekly','monthly','quarterly')),
  next_review_date    DATE,
  last_reviewed_at    TIMESTAMPTZ,
  last_reviewer       TEXT,
  action_plan         TEXT,
  resolution_target   DATE,
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','escalated','transferred')),
  workflow_run_id     UUID,
  data                JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watchlist_org ON watchlist_items(org_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_loan ON watchlist_items(loan_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_status ON watchlist_items(status);

-- ── APPROVALS ─────────────────────────────────────────────────────────────────
-- Structured approval records (more granular than human_reviews)
CREATE TABLE IF NOT EXISTS approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_run_id     UUID,
  step_name           TEXT NOT NULL,
  entity_type         TEXT NOT NULL,
  entity_id           UUID,
  approval_type       TEXT NOT NULL CHECK (approval_type IN ('draw_disbursement','hazard_disbursement','extension_execution','modification_execution','special_servicing','covenant_waiver','reserve_release','payoff_approval','disposition','other')),
  required_role       TEXT NOT NULL DEFAULT 'lender_admin',
  threshold_usd       BIGINT,
  description         TEXT NOT NULL,
  requested_by        TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline            TIMESTAMPTZ,
  assigned_to         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','changes_requested','expired','withdrawn')),
  reviewed_by         TEXT,
  reviewed_at         TIMESTAMPTZ,
  review_notes        TEXT,
  approved_amount_usd BIGINT,
  conditions          TEXT,
  requires_counter_sign BOOLEAN DEFAULT FALSE,
  counter_signed_by   TEXT,
  counter_signed_at   TIMESTAMPTZ,
  data                JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approvals_org ON approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_approvals_workflow ON approvals(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approvals(entity_type, entity_id);

-- ── WEBHOOK CONFIGS ───────────────────────────────────────────────────────────
-- Per-org webhook subscriptions with HMAC signing
CREATE TABLE IF NOT EXISTS webhook_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label         TEXT,
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL,
  event_types   TEXT[] NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT,
  last_fired_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_org ON webhook_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active ON webhook_configs(active);

-- ── WEBHOOK DELIVERIES ────────────────────────────────────────────────────────
-- Immutable outbound webhook delivery log with retry tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  webhook_config_id UUID REFERENCES webhook_configs(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL,
  event_id          UUID NOT NULL DEFAULT gen_random_uuid(),
  payload           JSONB NOT NULL,
  url               TEXT NOT NULL,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 3,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','exhausted')),
  last_http_status  INTEGER,
  last_response     TEXT,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'pending';

-- ── WORKFLOW TEMPLATES ────────────────────────────────────────────────────────
-- Machine-readable workflow definitions (source of truth for the template library)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('servicing','compliance','capital_markets','risk','operations')),
  trigger_types    TEXT[] NOT NULL DEFAULT '{}',
  sla_hours        INTEGER NOT NULL DEFAULT 72,
  steps            JSONB NOT NULL DEFAULT '[]',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend workflow_runs with template tracking
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS current_step TEXT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS approval_id UUID;

-- Extend agent_steps with step metadata
ALTER TABLE agent_steps ADD COLUMN IF NOT EXISTS step_type TEXT DEFAULT 'automated';
ALTER TABLE agent_steps ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE agent_steps ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- ── TRIGGERS FOR UPDATED_AT ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_borrowers_updated BEFORE UPDATE ON borrowers FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_deficiencies_updated BEFORE UPDATE ON deficiencies FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_hazard_loss_updated BEFORE UPDATE ON hazard_loss_events FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_reserves_updated BEFORE UPDATE ON reserves FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_covenants_updated BEFORE UPDATE ON covenants FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_maturities_updated BEFORE UPDATE ON maturities FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_watchlist_updated BEFORE UPDATE ON watchlist_items FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_approvals_updated BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_webhook_configs_updated BEFORE UPDATE ON webhook_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at()'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
