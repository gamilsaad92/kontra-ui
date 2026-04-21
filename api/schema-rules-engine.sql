-- ═══════════════════════════════════════════════════════════════
-- Kontra Rules Engine — Idempotent Schema Migration
-- Uses tables prefixed with "kontra_" to avoid conflicts.
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. kontra_rules ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kontra_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  BIGINT,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT,
  category         TEXT NOT NULL DEFAULT 'compliance',
  rule_key         TEXT,
  jurisdictions    TEXT[]      DEFAULT '{}',
  loan_types       TEXT[]      DEFAULT '{}',
  token_types      TEXT[]      DEFAULT '{}',
  workflow_stages  TEXT[]      DEFAULT '{}',
  conditions       JSONB       NOT NULL DEFAULT '[]',
  condition_logic  TEXT        NOT NULL DEFAULT 'AND',
  actions          JSONB       NOT NULL DEFAULT '[]',
  severity         TEXT        NOT NULL DEFAULT 'medium',
  source_reference TEXT,
  version          INTEGER     NOT NULL DEFAULT 1,
  status           TEXT        NOT NULL DEFAULT 'draft',
  effective_date   TIMESTAMPTZ DEFAULT NOW(),
  end_date         TIMESTAMPTZ,
  created_by       UUID,
  updated_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_rules_category_idx ON public.kontra_rules(category);
CREATE INDEX IF NOT EXISTS kontra_rules_status_idx   ON public.kontra_rules(status);
CREATE INDEX IF NOT EXISTS kontra_rules_org_idx      ON public.kontra_rules(organization_id);

-- ── 2. kontra_rule_versions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kontra_rule_versions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID    NOT NULL,
  version     INTEGER NOT NULL,
  snapshot    JSONB   NOT NULL DEFAULT '{}',
  changed_by  UUID,
  change_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rule_id, version)
);

CREATE INDEX IF NOT EXISTS kontra_rule_versions_rule_idx ON public.kontra_rule_versions(rule_id);

-- ── 3. kontra_rule_approvals ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kontra_rule_approvals (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID    NOT NULL,
  rule_version  INTEGER NOT NULL DEFAULT 1,
  status        TEXT    NOT NULL DEFAULT 'pending',
  submitted_by  UUID,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  is_emergency  BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS kontra_rule_approvals_rule_idx   ON public.kontra_rule_approvals(rule_id);
CREATE INDEX IF NOT EXISTS kontra_rule_approvals_status_idx ON public.kontra_rule_approvals(status);

-- ── 4. kontra_rule_audit_log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kontra_rule_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL DEFAULT 'unknown',
  rule_id      UUID,
  rule_version INTEGER,
  actor_id     UUID,
  context      JSONB,
  result       JSONB,
  portal       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_rule_audit_rule_idx  ON public.kontra_rule_audit_log(rule_id);
CREATE INDEX IF NOT EXISTS kontra_rule_audit_event_idx ON public.kontra_rule_audit_log(event_type);
CREATE INDEX IF NOT EXISTS kontra_rule_audit_ts_idx    ON public.kontra_rule_audit_log(created_at DESC);

-- ── 5. Auto-update trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kontra_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kontra_rules_updated_at ON public.kontra_rules;
CREATE TRIGGER kontra_rules_updated_at
  BEFORE UPDATE ON public.kontra_rules
  FOR EACH ROW EXECUTE FUNCTION public.kontra_set_updated_at();
