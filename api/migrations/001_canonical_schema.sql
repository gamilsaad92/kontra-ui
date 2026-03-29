-- Kontra Platform — Canonical Schema Migration
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/sql)
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF NOT EXISTS column checks.

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: add a column only if it does not already exist
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _kontra_add_column_if_missing(
  _table  text,
  _column text,
  _type   text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = _table
      AND column_name  = _column
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', _table, _column, _type);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX legacy NOT NULL columns — set safe defaults so generic entity router
-- inserts don't fail when these columns aren't supplied.
-- Safe to run repeatedly: SET DEFAULT on an already-defaulted column is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- loans: borrower_name, property_address and similar legacy required fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='borrower_name') THEN
    ALTER TABLE public.loans ALTER COLUMN borrower_name SET DEFAULT '';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='property_address') THEN
    ALTER TABLE public.loans ALTER COLUMN property_address SET DEFAULT '';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='loan_amount') THEN
    ALTER TABLE public.loans ALTER COLUMN loan_amount SET DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='loans' AND column_name='interest_rate') THEN
    ALTER TABLE public.loans ALTER COLUMN interest_rate SET DEFAULT 0;
  END IF;
  -- assets: any legacy required fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='name') THEN
    ALTER TABLE public.assets ALTER COLUMN name SET DEFAULT '';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='address') THEN
    ALTER TABLE public.assets ALTER COLUMN address SET DEFAULT '';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='asset_type') THEN
    ALTER TABLE public.assets ALTER COLUMN asset_type SET DEFAULT '';
  END IF;
  -- payments: any legacy required fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='amount') THEN
    ALTER TABLE public.payments ALTER COLUMN amount SET DEFAULT 0;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX existing tables: add missing org_id / title / status / data columns
-- ─────────────────────────────────────────────────────────────────────────────
SELECT _kontra_add_column_if_missing('loans',            'org_id',  'uuid');
SELECT _kontra_add_column_if_missing('loans',            'title',   'text');
SELECT _kontra_add_column_if_missing('loans',            'status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('loans',            'data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('loans',            'updated_at', 'timestamptz DEFAULT now()');

SELECT _kontra_add_column_if_missing('assets',           'org_id',  'uuid');
SELECT _kontra_add_column_if_missing('assets',           'title',   'text');
SELECT _kontra_add_column_if_missing('assets',           'status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('assets',           'data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('assets',           'updated_at', 'timestamptz DEFAULT now()');

SELECT _kontra_add_column_if_missing('inspections',      'org_id',  'uuid');
SELECT _kontra_add_column_if_missing('inspections',      'title',   'text');
SELECT _kontra_add_column_if_missing('inspections',      'status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('inspections',      'data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('inspections',      'updated_at', 'timestamptz DEFAULT now()');

SELECT _kontra_add_column_if_missing('payments',         'org_id',  'uuid');
SELECT _kontra_add_column_if_missing('payments',         'title',   'text');
SELECT _kontra_add_column_if_missing('payments',         'status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('payments',         'data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('payments',         'currency','text DEFAULT ''USD''');
SELECT _kontra_add_column_if_missing('payments',         'updated_at', 'timestamptz DEFAULT now()');

SELECT _kontra_add_column_if_missing('escrows',          'org_id',  'uuid');
SELECT _kontra_add_column_if_missing('escrows',          'title',   'text');
SELECT _kontra_add_column_if_missing('escrows',          'status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('escrows',          'data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('escrows',          'updated_at', 'timestamptz DEFAULT now()');

SELECT _kontra_add_column_if_missing('exchange_listings','org_id',  'uuid');
SELECT _kontra_add_column_if_missing('exchange_listings','title',   'text');
SELECT _kontra_add_column_if_missing('exchange_listings','status',  'text DEFAULT ''active''');
SELECT _kontra_add_column_if_missing('exchange_listings','data',    'jsonb DEFAULT ''{}''');
SELECT _kontra_add_column_if_missing('exchange_listings','updated_at', 'timestamptz DEFAULT now()');

-- ─────────────────────────────────────────────────────────────────────────────
-- NEW canonical tables (id, org_id, title, status, data, timestamps)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.draws (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.borrower_financials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.management_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pools (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  pool_id      uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  symbol       text,
  supply       numeric DEFAULT 0,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.legal_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regulatory_scans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.risk_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'active',
  data         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  loan_id             uuid,
  project_id          uuid,
  type                text NOT NULL DEFAULT 'general',
  entity_type         text,
  entity_id           text,
  source_id           text,
  status              text NOT NULL DEFAULT 'needs_review',
  confidence          numeric DEFAULT 0.8,
  title               text,
  summary             text,
  reasons             jsonb NOT NULL DEFAULT '[]',
  evidence            jsonb NOT NULL DEFAULT '[]',
  recommended_actions jsonb NOT NULL DEFAULT '[]',
  proposed_updates    jsonb NOT NULL DEFAULT '{}',
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_review_actions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid,
  review_id      uuid REFERENCES public.ai_reviews(id) ON DELETE CASCADE,
  action_type    text,
  action_payload jsonb NOT NULL DEFAULT '{}',
  outcome        text,
  notes          text,
  actor_id       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- org_memberships (needed for auth org resolution)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       text NOT NULL DEFAULT 'member',
  status     text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- organizations (needed for multi-tenant setup)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_org_id             ON public.loans(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_id            ON public.assets(org_id);
CREATE INDEX IF NOT EXISTS idx_inspections_org_id       ON public.inspections(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id          ON public.payments(org_id);
CREATE INDEX IF NOT EXISTS idx_escrows_org_id           ON public.escrows(org_id);
CREATE INDEX IF NOT EXISTS idx_draws_org_id             ON public.draws(org_id);
CREATE INDEX IF NOT EXISTS idx_borrower_financials_org_id ON public.borrower_financials(org_id);
CREATE INDEX IF NOT EXISTS idx_management_items_org_id  ON public.management_items(org_id);
CREATE INDEX IF NOT EXISTS idx_pools_org_id             ON public.pools(org_id);
CREATE INDEX IF NOT EXISTS idx_tokens_org_id            ON public.tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_items_org_id  ON public.compliance_items(org_id);
CREATE INDEX IF NOT EXISTS idx_legal_items_org_id       ON public.legal_items(org_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_scans_org_id  ON public.regulatory_scans(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_items_org_id        ON public.risk_items(org_id);
CREATE INDEX IF NOT EXISTS idx_document_reviews_org_id  ON public.document_reviews(org_id);
CREATE INDEX IF NOT EXISTS idx_reports_org_id           ON public.reports(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_org_id        ON public.ai_reviews(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_status        ON public.ai_reviews(status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id  ON public.org_memberships(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup helper function
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS _kontra_add_column_if_missing(text, text, text);
