-- =============================================================================
-- Phase 3: Policy Engine Schema Extension
--
-- Extends the existing kontra_rules / kontra_rule_audit_log infrastructure
-- with: source_agency field, org-level overrides, extended categories,
-- reserve triggers, maturity rules, hazard loss conditions, token transfer,
-- and policy evaluation audit enrichment.
--
-- Run after baseline schema is applied.
-- =============================================================================

-- ── 1. Extend kontra_rules with Phase 3 fields ────────────────────────────────

-- Add source_agency if not present
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS source_agency TEXT
  CHECK (source_agency IN ('freddie_mac','fannie_mae','cfpb','hud','lender','platform','other'));

-- Add override permission fields
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS override_allowed BOOLEAN DEFAULT FALSE;
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS override_requires_role TEXT
  CHECK (override_requires_role IN ('lender_admin','platform_admin','servicer'));

-- Add escalation path (JSON array of roles)
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS escalation_path JSONB DEFAULT '[]';

-- Add expiration date (separate from end_date for semantic clarity)
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Add threshold metadata
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS threshold_value NUMERIC;
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS threshold_unit TEXT;
ALTER TABLE kontra_rules ADD COLUMN IF NOT EXISTS rule_operator TEXT
  CHECK (rule_operator IN ('>=','<=','>','<','==','!=','flag','days_since','range','exists'));

-- Extend category enum to include Phase 3 categories
-- Note: If using a CHECK constraint, we add the new values here.
-- If your DB already has the column, this updates the allowed values.
ALTER TABLE kontra_rules DROP CONSTRAINT IF EXISTS kontra_rules_category_check;
ALTER TABLE kontra_rules ADD CONSTRAINT kontra_rules_category_check
  CHECK (category IN (
    -- Phase 1 categories
    'servicing', 'compliance', 'tokenization', 'governance',
    'investor_eligibility', 'document_requirements', 'jurisdiction',
    -- Phase 3 regulatory categories
    'freddie_mac', 'fannie_mae', 'hazard_loss', 'watchlist',
    'reserve', 'maturity', 'token_transfer', 'lender_specific',
    'cfpb', 'hud', 'draw_eligibility'
  ));

-- ── 2. Org-level rule overrides table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_rule_overrides (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID         NOT NULL,
  rule_key           TEXT         NOT NULL,         -- matches kontra_rules.rule_key
  rule_db_id         UUID         REFERENCES kontra_rules(id) ON DELETE SET NULL,

  override_type      TEXT         NOT NULL          -- 'threshold', 'disable', 'enable', 'severity_downgrade', 'approval_path'
    CHECK (override_type IN ('threshold','disable','enable','severity_downgrade','approval_path')),
  override_result    JSONB,                          -- { result: 'clear'/'triggered', reason: '...' }
  override_value     JSONB,                          -- what was overridden (new threshold, new path, etc.)
  override_reason    TEXT         NOT NULL,
  override_by        UUID         NOT NULL,
  override_role      TEXT         NOT NULL,

  effective_from     DATE         NOT NULL DEFAULT CURRENT_DATE,
  effective_until    DATE,                           -- NULL = permanent
  status             TEXT         NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','revoked')),

  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_rule_overrides_org_rule_idx ON kontra_rule_overrides(org_id, rule_key, status);

-- ── 3. Enrich audit log with agent tracking ───────────────────────────────────

ALTER TABLE kontra_rule_audit_log ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE kontra_rule_audit_log ADD COLUMN IF NOT EXISTS loan_id UUID;
ALTER TABLE kontra_rule_audit_log ADD COLUMN IF NOT EXISTS workflow_run_id UUID;
ALTER TABLE kontra_rule_audit_log ADD COLUMN IF NOT EXISTS evaluation_source TEXT
  CHECK (evaluation_source IN ('db_rule','hardcoded_fallback','org_override'));
ALTER TABLE kontra_rule_audit_log ADD COLUMN IF NOT EXISTS evaluated_value JSONB;

-- ── 4. Agent ↔ Rule dependency registry ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_agent_rule_dependencies (
  id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    TEXT   NOT NULL,   -- matches agentDefinitions agent id
  rule_key    TEXT   NOT NULL,   -- matches kontra_rules.rule_key or fallback rule id
  usage_type  TEXT   NOT NULL    -- 'evaluates', 'triggers_on', 'blocks_on'
    CHECK (usage_type IN ('evaluates','triggers_on','blocks_on')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, rule_key)
);

-- Seed agent→rule dependencies (Phase 2 agents)
INSERT INTO kontra_agent_rule_dependencies (agent_id, rule_key, usage_type) VALUES
  ('inspection_agent', 'GSE-INSP-01',     'triggers_on'),
  ('inspection_agent', 'GSE-INSP-02',     'evaluates'),
  ('inspection_agent', 'DRAW-HOLD-CRIT',  'blocks_on'),
  ('inspection_agent', 'FREDDIE-5.3.2',   'evaluates'),
  ('hazard_loss_agent','HAZARD-HOLD-50PCT','triggers_on'),
  ('hazard_loss_agent','HAZARD-PSA-NOTIFY','triggers_on'),
  ('hazard_loss_agent','HAZARD-INSPECT-REQ','blocks_on'),
  ('surveillance_agent','WATCH-DQ90',      'triggers_on'),
  ('surveillance_agent','WATCH-DSCR-SUB',  'triggers_on'),
  ('surveillance_agent','WATCH-RESERVE-DEP','evaluates'),
  ('compliance_agent', 'FREDDIE-ANNUAL',   'evaluates'),
  ('compliance_agent', 'FREDDIE-INS-MIN',  'evaluates'),
  ('compliance_agent', 'CFPB-LOSS-MIT-REQ','evaluates'),
  ('covenant_agent',   'COV-DSCR-01',      'triggers_on'),
  ('covenant_agent',   'COV-LTV-MAX',      'evaluates'),
  ('covenant_agent',   'COV-OCC-MIN',      'evaluates'),
  ('covenant_agent',   'COV-CURE-30',      'triggers_on'),
  ('covenant_agent',   'PSA-INVESTOR-NOTIFY','triggers_on'),
  ('tokenization_agent','TOKEN-DSCR-MIN',  'blocks_on'),
  ('tokenization_agent','TOKEN-LTV-MAX',   'blocks_on'),
  ('tokenization_agent','TOKEN-CURRENT',   'blocks_on'),
  ('tokenization_agent','TOKEN-AUDIT',     'evaluates')
ON CONFLICT (agent_id, rule_key) DO NOTHING;

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE kontra_rule_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'kontra_rule_overrides'
      AND policyname = 'rule_overrides_org_policy'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY rule_overrides_org_policy ON kontra_rule_overrides
        USING (org_id = (current_setting('app.org_id', true))::uuid)
    $policy$;
  END IF;
END;
$$;

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS kontra_rules_rule_key_idx ON kontra_rules(rule_key);
CREATE INDEX IF NOT EXISTS kontra_rules_category_idx ON kontra_rules(category);
CREATE INDEX IF NOT EXISTS kontra_rules_source_agency_idx ON kontra_rules(source_agency);
CREATE INDEX IF NOT EXISTS kontra_rules_status_idx ON kontra_rules(status);

-- Done.
-- Run seed-phase3-regulatory-rules.sql next to populate the canonical ruleset.
