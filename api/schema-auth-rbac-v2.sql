-- =============================================================================
-- Kontra Platform — Auth, RBAC & Multi-tenant Schema (v2)
-- Safe to run against the existing Supabase project:
--   - Uses ALTER TABLE for existing tables (organizations, loans, organization_members)
--   - Uses CREATE TABLE IF NOT EXISTS for new tables
--   - Correct FK types: loans.id = BIGINT, organizations.id = BIGINT
--   - profiles.id = UUID (matches auth.users — already correct)
-- Run in: Dashboard → SQL Editor → New Query
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. PROFILES — already exists with the right structure; add missing columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Ensure the trigger exists to auto-create a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 2. ORGANIZATIONS — already exists (id = BIGINT); add missing columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug     TEXT UNIQUE;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS type     TEXT DEFAULT 'lender'
  CHECK (type IN ('lender','servicer','fund','borrower_entity','platform'));
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 3. ORGANIZATION_MEMBERS — already exists; add app_role and indexes
-- ---------------------------------------------------------------------------
-- Add the typed app_role column alongside the existing `role` column
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS app_role TEXT
    CHECK (app_role IN ('platform_admin','lender_admin','servicer','asset_manager','investor','borrower'));

-- Backfill app_role from the legacy role column (safe to re-run — only updates NULLs)
UPDATE public.organization_members
SET app_role = CASE
  WHEN role IN ('platform_admin','lender_admin','servicer','asset_manager','investor','borrower') THEN role
  WHEN role = 'admin'         THEN 'lender_admin'
  WHEN role = 'member'        THEN 'servicer'
  ELSE 'lender_admin'
END
WHERE app_role IS NULL;

-- Keep app_role in sync whenever role is updated
CREATE OR REPLACE FUNCTION public.sync_org_member_app_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.app_role IS NULL AND NEW.role IS NOT NULL THEN
    NEW.app_role := CASE
      WHEN NEW.role IN ('platform_admin','lender_admin','servicer','asset_manager','investor','borrower') THEN NEW.role
      WHEN NEW.role = 'admin'  THEN 'lender_admin'
      WHEN NEW.role = 'member' THEN 'servicer'
      ELSE 'lender_admin'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_app_role_on_upsert ON public.organization_members;
CREATE TRIGGER sync_app_role_on_upsert
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_member_app_role();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_org_idx  ON public.organization_members(organization_id);


-- ---------------------------------------------------------------------------
-- 4. LOAN_PARTICIPANTS — new table, FK → loans.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loan_participants (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           BIGINT  NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  organization_id   BIGINT  NOT NULL REFERENCES public.organizations(id),
  user_id           UUID    REFERENCES auth.users(id),
  role              TEXT    NOT NULL
                            CHECK (role IN ('senior_lender','mezzanine','equity_investor','note_buyer','servicer')),
  share_pct         NUMERIC(8,4),
  commitment_amount NUMERIC(18,2),
  status            TEXT    DEFAULT 'active'
                            CHECK (status IN ('active','pending','exited')),
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.loan_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS loan_participants_loan_idx ON public.loan_participants(loan_id);
CREATE INDEX IF NOT EXISTS loan_participants_user_idx ON public.loan_participants(user_id);


-- ---------------------------------------------------------------------------
-- 5. INVESTOR_HOLDINGS — new table, FK → loans.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investor_holdings (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id         BIGINT  NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  organization_id BIGINT  NOT NULL REFERENCES public.organizations(id),
  token_symbol    TEXT,
  token_balance   NUMERIC(18,6) DEFAULT 0,
  share_pct       NUMERIC(8,4),
  share_usd       NUMERIC(18,2),
  yield_pct       NUMERIC(8,4),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, loan_id)
);
ALTER TABLE public.investor_holdings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS investor_holdings_user_idx ON public.investor_holdings(user_id);
CREATE INDEX IF NOT EXISTS investor_holdings_loan_idx ON public.investor_holdings(loan_id);
CREATE INDEX IF NOT EXISTS investor_holdings_org_idx  ON public.investor_holdings(organization_id);


-- ---------------------------------------------------------------------------
-- 6. BORROWER_ENTITIES — new table, FK → organizations.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.borrower_entities (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id),
  user_id         UUID  NOT NULL REFERENCES auth.users(id),
  legal_name      TEXT  NOT NULL,
  entity_type     TEXT,
  tax_id          TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  address         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.borrower_entities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS borrower_entities_user_idx ON public.borrower_entities(user_id);
CREATE INDEX IF NOT EXISTS borrower_entities_org_idx  ON public.borrower_entities(organization_id);


-- ---------------------------------------------------------------------------
-- 7. BORROWER_LOAN_ASSIGNMENTS — new table, FK → loans.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.borrower_loan_assignments (
  id                  UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_entity_id  UUID   NOT NULL REFERENCES public.borrower_entities(id) ON DELETE CASCADE,
  loan_id             BIGINT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id             UUID   NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (borrower_entity_id, loan_id)
);
ALTER TABLE public.borrower_loan_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS borrower_assignments_user_idx ON public.borrower_loan_assignments(user_id);
CREATE INDEX IF NOT EXISTS borrower_assignments_loan_idx ON public.borrower_loan_assignments(loan_id);


-- ---------------------------------------------------------------------------
-- 8. DOCUMENTS — new table, FK → loans.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  BIGINT NOT NULL REFERENCES public.organizations(id),
  loan_id          BIGINT REFERENCES public.loans(id),
  uploaded_by      UUID   NOT NULL REFERENCES auth.users(id),
  document_type    TEXT   NOT NULL,
  storage_bucket   TEXT   NOT NULL,
  storage_path     TEXT   NOT NULL,
  file_name        TEXT,
  file_size_bytes  BIGINT,
  status           TEXT   DEFAULT 'pending'
                          CHECK (status IN ('pending','under_review','approved','rejected')),
  reviewed_by      UUID   REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,
  metadata         JSONB  DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS documents_org_idx    ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS documents_loan_idx   ON public.documents(loan_id);
CREATE INDEX IF NOT EXISTS documents_user_idx   ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents(status);


-- ---------------------------------------------------------------------------
-- 9. GOVERNANCE_PROPOSALS — new table, FK → loans.id (BIGINT)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    BIGINT  NOT NULL REFERENCES public.organizations(id),
  loan_id            BIGINT  REFERENCES public.loans(id),
  proposal_number    TEXT    NOT NULL,
  title              TEXT    NOT NULL,
  proposal_type      TEXT    NOT NULL,
  description        TEXT,
  vote_threshold_pct NUMERIC(5,2) DEFAULT 66.67,
  quorum_pct         NUMERIC(5,2) DEFAULT 50.00,
  voting_deadline    TIMESTAMPTZ,
  status             TEXT    DEFAULT 'active'
                             CHECK (status IN ('draft','active','approved','rejected','expired')),
  created_by         UUID    NOT NULL REFERENCES auth.users(id),
  executed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gov_proposals_org_idx    ON public.governance_proposals(organization_id);
CREATE INDEX IF NOT EXISTS gov_proposals_loan_idx   ON public.governance_proposals(loan_id);
CREATE INDEX IF NOT EXISTS gov_proposals_status_idx ON public.governance_proposals(status);


-- ---------------------------------------------------------------------------
-- 10. GOVERNANCE_VOTES — new table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_votes (
  id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID   NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  voter_id        UUID   NOT NULL REFERENCES auth.users(id),
  organization_id BIGINT NOT NULL,
  vote            TEXT   NOT NULL CHECK (vote IN ('for','against','abstain')),
  vote_weight     NUMERIC(8,4) DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (proposal_id, voter_id)
);
ALTER TABLE public.governance_votes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gov_votes_proposal_idx ON public.governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS gov_votes_voter_idx    ON public.governance_votes(voter_id);


-- ---------------------------------------------------------------------------
-- 11. AUDIT_LOGS — new table (existing audit_log table has different schema)
--     We create audit_logs (plural) to avoid collisions with the existing audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id BIGINT NOT NULL,
  actor_id        UUID   REFERENCES auth.users(id),
  actor_role      TEXT,
  entity_type     TEXT   NOT NULL,
  entity_id       TEXT,
  action          TEXT   NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  metadata        JSONB  DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_logs_org_idx    ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx  ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);


-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_app_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'app_role'),
    (auth.jwt() -> 'user_metadata' ->> 'app_role'),
    'member'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NULLIF(
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id'),
      (auth.jwt() -> 'user_metadata' ->> 'org_id')
    ), ''
  )::BIGINT
$$;

CREATE OR REPLACE FUNCTION public.is_lender_user()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.get_my_app_role() IN ('platform_admin','lender_admin','servicer','asset_manager')
$$;

CREATE OR REPLACE FUNCTION public.has_investor_access_to_loan(p_loan_id BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.investor_holdings h
    WHERE h.user_id = auth.uid() AND h.loan_id = p_loan_id
  ) OR EXISTS (
    SELECT 1 FROM public.loan_participants lp
    WHERE lp.user_id = auth.uid() AND lp.loan_id = p_loan_id AND lp.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_borrower_access_to_loan(p_loan_id BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.borrower_loan_assignments bla
    WHERE bla.user_id = auth.uid() AND bla.loan_id = p_loan_id
  )
$$;


-- =============================================================================
-- CUSTOM ACCESS TOKEN HOOK
-- organizations.id = BIGINT → cast to TEXT for the JWT claim
-- organization_members.app_role (new column, backfilled from role)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  claims     JSONB;
  v_user_id  UUID;
  v_role     TEXT;
  v_org_id   TEXT;
  v_portal   TEXT;
BEGIN
  v_user_id := (event->>'user_id')::UUID;
  claims    := event->'claims';

  -- Read from organization_members using app_role (new column)
  -- Fall back to the legacy role column if app_role is still NULL
  SELECT
    COALESCE(om.app_role, om.role),
    om.organization_id::TEXT
  INTO v_role, v_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user_id
    AND om.status = 'active'
  ORDER BY
    CASE COALESCE(om.app_role, om.role)
      WHEN 'platform_admin' THEN 0
      WHEN 'lender_admin'   THEN 1
      WHEN 'servicer'       THEN 2
      WHEN 'asset_manager'  THEN 3
      WHEN 'investor'       THEN 4
      WHEN 'borrower'       THEN 5
      ELSE 6
    END
  LIMIT 1;

  IF v_role IS NOT NULL THEN
    v_portal := CASE
      WHEN v_role IN ('platform_admin','lender_admin','servicer','asset_manager') THEN 'lender'
      WHEN v_role = 'investor' THEN 'investor'
      WHEN v_role = 'borrower' THEN 'borrower'
      ELSE 'lender'
    END;

    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object(
        'app_role', v_role,
        'org_id',   v_org_id,
        'portal',   v_portal
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.organization_members TO supabase_auth_admin;


-- =============================================================================
-- RLS POLICIES
-- Drop existing (if any) then recreate — safe for re-runs
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: own read"            ON public.profiles;
DROP POLICY IF EXISTS "profiles: own update"          ON public.profiles;
DROP POLICY IF EXISTS "profiles: lender view members" ON public.profiles;

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: lender view members"
  ON public.profiles FOR SELECT
  USING (
    public.is_lender_user() AND
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = public.get_my_org_id()
        AND om.status = 'active'
    )
  );


-- ── organizations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizations: member read"        ON public.organizations;
DROP POLICY IF EXISTS "organizations: lender admin update" ON public.organizations;

CREATE POLICY "organizations: member read"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "organizations: lender admin update"
  ON public.organizations FOR UPDATE
  USING (
    public.get_my_app_role() IN ('platform_admin','lender_admin')
    AND id = public.get_my_org_id()
  );


-- ── organization_members ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_members: same-org read"      ON public.organization_members;
DROP POLICY IF EXISTS "org_members: lender admin insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members: lender admin update" ON public.organization_members;

CREATE POLICY "org_members: same-org read"
  ON public.organization_members FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "org_members: lender admin insert"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.get_my_app_role() IN ('platform_admin','lender_admin')
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "org_members: lender admin update"
  ON public.organization_members FOR UPDATE
  USING (
    public.get_my_app_role() IN ('platform_admin','lender_admin')
    AND organization_id = public.get_my_org_id()
  );


-- ── loans ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans: lender read"   ON public.loans;
DROP POLICY IF EXISTS "loans: investor read" ON public.loans;
DROP POLICY IF EXISTS "loans: borrower read" ON public.loans;
DROP POLICY IF EXISTS "loans: lender write"  ON public.loans;
DROP POLICY IF EXISTS "loans: lender update" ON public.loans;

CREATE POLICY "loans: lender read"
  ON public.loans FOR SELECT
  USING (
    public.is_lender_user()
    AND organization_id::BIGINT = public.get_my_org_id()
  );

CREATE POLICY "loans: investor read"
  ON public.loans FOR SELECT
  USING (
    public.get_my_app_role() = 'investor'
    AND public.has_investor_access_to_loan(id)
  );

CREATE POLICY "loans: borrower read"
  ON public.loans FOR SELECT
  USING (
    public.get_my_app_role() = 'borrower'
    AND public.has_borrower_access_to_loan(id)
  );

CREATE POLICY "loans: lender write"
  ON public.loans FOR INSERT
  WITH CHECK (
    public.get_my_app_role() IN ('platform_admin','lender_admin','servicer','asset_manager')
    AND organization_id::BIGINT = public.get_my_org_id()
  );

CREATE POLICY "loans: lender update"
  ON public.loans FOR UPDATE
  USING (
    public.get_my_app_role() IN ('platform_admin','lender_admin','servicer','asset_manager')
    AND organization_id::BIGINT = public.get_my_org_id()
  );


-- ── loan_participants ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loan_participants: lender read"     ON public.loan_participants;
DROP POLICY IF EXISTS "loan_participants: investor read"   ON public.loan_participants;
DROP POLICY IF EXISTS "loan_participants: lender write"    ON public.loan_participants;

CREATE POLICY "loan_participants: lender read"
  ON public.loan_participants FOR SELECT
  USING (public.is_lender_user() AND organization_id = public.get_my_org_id());

CREATE POLICY "loan_participants: investor read"
  ON public.loan_participants FOR SELECT
  USING (
    public.get_my_app_role() = 'investor' AND user_id = auth.uid()
  );

CREATE POLICY "loan_participants: lender write"
  ON public.loan_participants FOR INSERT
  WITH CHECK (public.is_lender_user() AND organization_id = public.get_my_org_id());


-- ── investor_holdings ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_holdings: own read"    ON public.investor_holdings;
DROP POLICY IF EXISTS "investor_holdings: lender read" ON public.investor_holdings;

CREATE POLICY "investor_holdings: own read"
  ON public.investor_holdings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "investor_holdings: lender read"
  ON public.investor_holdings FOR SELECT
  USING (
    public.is_lender_user() AND organization_id = public.get_my_org_id()
  );


-- ── borrower_entities ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "borrower_entities: own read"    ON public.borrower_entities;
DROP POLICY IF EXISTS "borrower_entities: lender read" ON public.borrower_entities;
DROP POLICY IF EXISTS "borrower_entities: own insert"  ON public.borrower_entities;
DROP POLICY IF EXISTS "borrower_entities: own update"  ON public.borrower_entities;

CREATE POLICY "borrower_entities: own read"
  ON public.borrower_entities FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "borrower_entities: lender read"
  ON public.borrower_entities FOR SELECT
  USING (public.is_lender_user() AND organization_id = public.get_my_org_id());

CREATE POLICY "borrower_entities: own insert"
  ON public.borrower_entities FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "borrower_entities: own update"
  ON public.borrower_entities FOR UPDATE USING (user_id = auth.uid());


-- ── borrower_loan_assignments ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "borrower_assignments: own read"    ON public.borrower_loan_assignments;
DROP POLICY IF EXISTS "borrower_assignments: lender read" ON public.borrower_loan_assignments;
DROP POLICY IF EXISTS "borrower_assignments: lender write" ON public.borrower_loan_assignments;

CREATE POLICY "borrower_assignments: own read"
  ON public.borrower_loan_assignments FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "borrower_assignments: lender read"
  ON public.borrower_loan_assignments FOR SELECT
  USING (public.is_lender_user());

CREATE POLICY "borrower_assignments: lender write"
  ON public.borrower_loan_assignments FOR INSERT
  WITH CHECK (public.is_lender_user());


-- ── documents ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents: uploader read"        ON public.documents;
DROP POLICY IF EXISTS "documents: lender read"          ON public.documents;
DROP POLICY IF EXISTS "documents: investor read"        ON public.documents;
DROP POLICY IF EXISTS "documents: authenticated insert" ON public.documents;
DROP POLICY IF EXISTS "documents: lender update"        ON public.documents;

CREATE POLICY "documents: uploader read"
  ON public.documents FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "documents: lender read"
  ON public.documents FOR SELECT
  USING (public.is_lender_user() AND organization_id = public.get_my_org_id());

CREATE POLICY "documents: investor read"
  ON public.documents FOR SELECT
  USING (
    public.get_my_app_role() = 'investor'
    AND storage_bucket = 'investor-reports'
    AND public.has_investor_access_to_loan(loan_id)
  );

CREATE POLICY "documents: authenticated insert"
  ON public.documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "documents: lender update"
  ON public.documents FOR UPDATE
  USING (public.is_lender_user() AND organization_id = public.get_my_org_id());


-- ── governance_proposals ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gov_proposals: lender read"    ON public.governance_proposals;
DROP POLICY IF EXISTS "gov_proposals: lender write"   ON public.governance_proposals;
DROP POLICY IF EXISTS "gov_proposals: lender update"  ON public.governance_proposals;
DROP POLICY IF EXISTS "gov_proposals: investor read"  ON public.governance_proposals;

CREATE POLICY "gov_proposals: lender read"
  ON public.governance_proposals FOR SELECT
  USING (public.is_lender_user() AND organization_id = public.get_my_org_id());

CREATE POLICY "gov_proposals: lender write"
  ON public.governance_proposals FOR INSERT
  WITH CHECK (
    public.get_my_app_role() IN ('platform_admin','lender_admin','servicer','asset_manager')
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "gov_proposals: lender update"
  ON public.governance_proposals FOR UPDATE
  USING (
    public.get_my_app_role() IN ('platform_admin','lender_admin','servicer')
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "gov_proposals: investor read"
  ON public.governance_proposals FOR SELECT
  USING (
    public.get_my_app_role() = 'investor'
    AND (loan_id IS NULL OR public.has_investor_access_to_loan(loan_id))
  );


-- ── governance_votes ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gov_votes: lender read all"  ON public.governance_votes;
DROP POLICY IF EXISTS "gov_votes: investor own read" ON public.governance_votes;
DROP POLICY IF EXISTS "gov_votes: cast vote"         ON public.governance_votes;

CREATE POLICY "gov_votes: lender read all"
  ON public.governance_votes FOR SELECT USING (public.is_lender_user());

CREATE POLICY "gov_votes: investor own read"
  ON public.governance_votes FOR SELECT USING (voter_id = auth.uid());

CREATE POLICY "gov_votes: cast vote"
  ON public.governance_votes FOR INSERT
  WITH CHECK (
    voter_id = auth.uid()
    AND public.get_my_app_role() IN ('investor','borrower','lender_admin','servicer')
  );


-- ── audit_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs: lender read"          ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: authenticated insert"  ON public.audit_logs;

CREATE POLICY "audit_logs: lender read"
  ON public.audit_logs FOR SELECT
  USING (
    public.get_my_app_role() IN ('platform_admin','lender_admin')
    AND organization_id = public.get_my_org_id()
  );

CREATE POLICY "audit_logs: authenticated insert"
  ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- =============================================================================
-- ONBOARDING HELPER — Backend service role calls this
-- org_id is BIGINT to match organizations.id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.onboard_user(
  p_user_id    UUID,
  p_org_id     BIGINT,
  p_app_role   TEXT,
  p_full_name  TEXT DEFAULT NULL,
  p_email      TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (p_user_id, COALESCE(p_email,''), p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email      = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();

  INSERT INTO public.organization_members (user_id, organization_id, role, app_role, status)
  VALUES (p_user_id, p_org_id, p_app_role, p_app_role, 'active')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    role       = EXCLUDED.role,
    app_role   = EXCLUDED.app_role,
    status     = 'active',
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_user TO service_role;


-- =============================================================================
-- DONE
-- Next step: Dashboard → Authentication → Hooks → Custom Access Token
--            → Add hook → Postgres Function → public.custom_access_token_hook
-- =============================================================================
