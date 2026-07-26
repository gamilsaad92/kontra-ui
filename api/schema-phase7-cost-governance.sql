-- ═══════════════════════════════════════════════════════════════════════════
-- Kontra Phase 7 — AI Cost Governance & Enterprise Budget Controls
-- Run once against the Supabase project: supabase db push or paste in SQL editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Usage event log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kontra_ai_usage_events (
  id             BIGSERIAL PRIMARY KEY,
  event_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id         TEXT         NOT NULL,
  workflow_type  TEXT         NOT NULL,
  tier_id        TEXT,
  model          TEXT,
  provider       TEXT,
  input_tokens   INTEGER      NOT NULL DEFAULT 0,
  output_tokens  INTEGER      NOT NULL DEFAULT 0,
  total_tokens   INTEGER      GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd       NUMERIC(12,8) NOT NULL DEFAULT 0,
  latency_ms     INTEGER,
  loan_id        TEXT,
  request_id     TEXT,
  outcome        TEXT         NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','error','timeout','budget_blocked')),
  metadata       JSONB,
  recorded_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_recorded   ON kontra_ai_usage_events (org_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workflow        ON kontra_ai_usage_events (workflow_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_loan            ON kontra_ai_usage_events (loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_tier            ON kontra_ai_usage_events (tier_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_outcome         ON kontra_ai_usage_events (outcome);

-- ── Budget definitions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kontra_ai_budgets (
  id               BIGSERIAL PRIMARY KEY,
  budget_id        UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id           TEXT         NOT NULL,
  name             TEXT         NOT NULL,
  scope            TEXT         NOT NULL DEFAULT 'monthly'
                     CHECK (scope IN ('monthly','quarterly','annual','per_workflow','per_loan')),
  limit_usd        NUMERIC(12,4) NOT NULL CHECK (limit_usd > 0),
  alert_at         NUMERIC(4,2) NOT NULL DEFAULT 0.80 CHECK (alert_at BETWEEN 0 AND 1),
  hard_stop        BOOLEAN      NOT NULL DEFAULT false,
  tier_override    TEXT,
  workflow_scopes  TEXT[],      -- null = all workflows
  current_period_start DATE,
  spent_usd        NUMERIC(12,6) NOT NULL DEFAULT 0,
  status           TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','expired')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_budgets_org    ON kontra_ai_budgets (org_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_scope  ON kontra_ai_budgets (scope);

-- ── Monthly rollup materialized view ─────────────────────────────────────────
-- Gives fast access to MTD spend per org / workflow / model
CREATE TABLE IF NOT EXISTS kontra_ai_spend_rollup (
  id             BIGSERIAL PRIMARY KEY,
  org_id         TEXT         NOT NULL,
  period_month   DATE         NOT NULL,   -- first day of month
  workflow_type  TEXT         NOT NULL,
  tier_id        TEXT,
  model          TEXT,
  total_runs     INTEGER      NOT NULL DEFAULT 0,
  total_tokens   BIGINT       NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0,
  error_count    INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (org_id, period_month, workflow_type, COALESCE(tier_id,''), COALESCE(model,''))
);

CREATE INDEX IF NOT EXISTS idx_ai_rollup_org_period ON kontra_ai_spend_rollup (org_id, period_month DESC);

-- ── Tier policy overrides (per org) ──────────────────────────────────────────
-- Allows an org admin to override the default tier for a given workflow type
CREATE TABLE IF NOT EXISTS kontra_ai_tier_policies (
  id             BIGSERIAL PRIMARY KEY,
  org_id         TEXT         NOT NULL,
  workflow_type  TEXT         NOT NULL,
  tier_id        TEXT         NOT NULL,
  max_runs_day   INTEGER,       -- optional rate limit: max AI calls per day per workflow
  enabled        BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  UNIQUE (org_id, workflow_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_tier_policy_org ON kontra_ai_tier_policies (org_id);

-- ── Budget alert log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kontra_ai_budget_alerts (
  id             BIGSERIAL PRIMARY KEY,
  alert_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  budget_id      UUID         NOT NULL REFERENCES kontra_ai_budgets(budget_id) ON DELETE CASCADE,
  org_id         TEXT         NOT NULL,
  alert_type     TEXT         NOT NULL CHECK (alert_type IN ('threshold_warning','hard_stop','period_reset')),
  utilization_pct NUMERIC(6,2),
  spent_usd      NUMERIC(12,6),
  limit_usd      NUMERIC(12,4),
  triggered_by   TEXT,         -- event_id that triggered the alert
  acknowledged   BOOLEAN      NOT NULL DEFAULT false,
  triggered_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_org    ON kontra_ai_budget_alerts (org_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_budget ON kontra_ai_budget_alerts (budget_id);

-- ── Enable Row Level Security ─────────────────────────────────────────────────
ALTER TABLE kontra_ai_usage_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontra_ai_budgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontra_ai_spend_rollup   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontra_ai_tier_policies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kontra_ai_budget_alerts  ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API uses service role key — full access)
CREATE POLICY "service_role_all_usage_events"  ON kontra_ai_usage_events  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_budgets"       ON kontra_ai_budgets        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_rollup"        ON kontra_ai_spend_rollup   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_tier_policies" ON kontra_ai_tier_policies  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_budget_alerts" ON kontra_ai_budget_alerts  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Helper: refresh monthly rollup ────────────────────────────────────────────
-- Call after bulk inserts: SELECT refresh_ai_spend_rollup('your-org-id', '2026-04-01');
CREATE OR REPLACE FUNCTION refresh_ai_spend_rollup(p_org_id TEXT, p_month DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO kontra_ai_spend_rollup (
    org_id, period_month, workflow_type, tier_id, model,
    total_runs, total_tokens, total_cost_usd, error_count, updated_at
  )
  SELECT
    org_id,
    date_trunc('month', recorded_at)::DATE AS period_month,
    workflow_type,
    COALESCE(tier_id, ''),
    COALESCE(model, ''),
    COUNT(*)                    AS total_runs,
    SUM(total_tokens)           AS total_tokens,
    SUM(cost_usd)               AS total_cost_usd,
    SUM(CASE WHEN outcome != 'success' THEN 1 ELSE 0 END) AS error_count,
    now()                       AS updated_at
  FROM kontra_ai_usage_events
  WHERE org_id = p_org_id
    AND date_trunc('month', recorded_at)::DATE = p_month
  GROUP BY 1, 2, 3, 4, 5
  ON CONFLICT (org_id, period_month, workflow_type, COALESCE(tier_id,''), COALESCE(model,''))
  DO UPDATE SET
    total_runs     = EXCLUDED.total_runs,
    total_tokens   = EXCLUDED.total_tokens,
    total_cost_usd = EXCLUDED.total_cost_usd,
    error_count    = EXCLUDED.error_count,
    updated_at     = now();
END;
$$;

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE kontra_ai_usage_events   IS 'Every AI inference call tracked for cost governance and audit';
COMMENT ON TABLE kontra_ai_budgets        IS 'Monthly / per-workflow spend caps with soft-alert and hard-stop options';
COMMENT ON TABLE kontra_ai_spend_rollup   IS 'Monthly aggregated spend rollup for fast dashboard queries';
COMMENT ON TABLE kontra_ai_tier_policies  IS 'Per-org default tier assignments per workflow type';
COMMENT ON TABLE kontra_ai_budget_alerts  IS 'Audit log of budget threshold and hard-stop events';
