-- ═══════════════════════════════════════════════════════════════
-- Rules & Policy Engine Schema
-- Run once in Supabase SQL Editor to enable the rules engine.
-- ═══════════════════════════════════════════════════════════════

-- 1. POLICY_RULES — the live rule registry
CREATE TABLE IF NOT EXISTS public.policy_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  BIGINT REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Identity
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL CHECK (category IN (
    'servicing','compliance','tokenization','governance',
    'investor_eligibility','document_requirements','jurisdiction'
  )),
  rule_key         TEXT UNIQUE NOT NULL,

  -- Scope (array fields — null or empty = applies to all)
  jurisdictions    TEXT[]   DEFAULT '{}',
  loan_types       TEXT[]   DEFAULT '{}',
  token_types      TEXT[]   DEFAULT '{}',
  workflow_stages  TEXT[]   DEFAULT '{}',

  -- Logic
  conditions       JSONB    NOT NULL DEFAULT '[]',
  condition_logic  TEXT     NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND','OR')),
  actions          JSONB    NOT NULL DEFAULT '[]',

  -- Metadata
  severity         TEXT     NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','info')),
  source_reference TEXT,

  -- Versioning & Status
  version          INTEGER  NOT NULL DEFAULT 1,
  status           TEXT     NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_review','approved','published','archived','emergency'
  )),

  -- Date range
  effective_date   TIMESTAMPTZ DEFAULT NOW(),
  end_date         TIMESTAMPTZ,

  -- Audit
  created_by       UUID REFERENCES auth.users(id),
  updated_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_rules_category_idx ON public.policy_rules(category);
CREATE INDEX IF NOT EXISTS policy_rules_status_idx   ON public.policy_rules(status);
CREATE INDEX IF NOT EXISTS policy_rules_org_idx      ON public.policy_rules(organization_id);

ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;

-- Admins can do anything; the evaluate endpoint uses service role
CREATE POLICY "platform_admin full access" ON public.policy_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.app_role IN ('platform_admin','lender_admin')
    )
  );

-- Published rules are readable by all authenticated users (for evaluation)
CREATE POLICY "authenticated read published" ON public.policy_rules
  FOR SELECT USING (auth.uid() IS NOT NULL AND status IN ('published','emergency'));

-- ───────────────────────────────────────────────────────────────
-- 2. POLICY_RULE_VERSIONS — immutable version archive
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_rule_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID NOT NULL REFERENCES public.policy_rules(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  snapshot    JSONB NOT NULL,
  changed_by  UUID REFERENCES auth.users(id),
  change_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, version)
);

CREATE INDEX IF NOT EXISTS policy_rule_versions_rule_idx ON public.policy_rule_versions(rule_id);
ALTER TABLE public.policy_rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin access" ON public.policy_rule_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.app_role IN ('platform_admin','lender_admin')
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 3. POLICY_APPROVALS — maker-checker workflow
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES public.policy_rules(id) ON DELETE CASCADE,
  rule_version  INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  submitted_by  UUID REFERENCES auth.users(id),
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by   UUID REFERENCES auth.users(id),
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  is_emergency  BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS policy_approvals_rule_idx   ON public.policy_approvals(rule_id);
CREATE INDEX IF NOT EXISTS policy_approvals_status_idx ON public.policy_approvals(status);
ALTER TABLE public.policy_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin access" ON public.policy_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.app_role IN ('platform_admin','lender_admin')
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 4. POLICY_AUDIT_LOG — every evaluation, change, and override
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.policy_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  rule_id      UUID REFERENCES public.policy_rules(id) ON DELETE SET NULL,
  rule_version INTEGER,
  actor_id     UUID REFERENCES auth.users(id),
  context      JSONB,
  result       JSONB,
  portal       TEXT CHECK (portal IN ('lender','investor','borrower')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_audit_log_rule_idx       ON public.policy_audit_log(rule_id);
CREATE INDEX IF NOT EXISTS policy_audit_log_event_idx      ON public.policy_audit_log(event_type);
CREATE INDEX IF NOT EXISTS policy_audit_log_created_at_idx ON public.policy_audit_log(created_at DESC);
ALTER TABLE public.policy_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin access" ON public.policy_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.app_role IN ('platform_admin','lender_admin')
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 5. Trigger: auto-update updated_at on policy_rules
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS policy_rules_updated_at ON public.policy_rules;
CREATE TRIGGER policy_rules_updated_at
  BEFORE UPDATE ON public.policy_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
