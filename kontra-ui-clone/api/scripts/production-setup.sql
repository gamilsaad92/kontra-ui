-- ============================================================
-- Kontra Platform — Production Setup SQL
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/sql
--
-- This is safe to run multiple times (idempotent).
-- ============================================================

-- ── 1. CORE TABLES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  status      text DEFAULT 'active',
  data        jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,
  role          text DEFAULT 'lender_admin',
  portal        text,
  org_id        uuid REFERENCES public.organizations(id),
  first_name    text,
  last_name     text,
  data          jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id),
  user_id    text NOT NULL,
  role       text DEFAULT 'member',
  status     text DEFAULT 'active',
  title      text,
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES public.organizations(id),
  organization_id uuid,
  title           text,
  borrower_name   text DEFAULT '',
  property_address text DEFAULT '',
  property_type   text,
  loan_number     text,
  amount          numeric DEFAULT 0,
  loan_amount     numeric DEFAULT 0,
  interest_rate   numeric DEFAULT 0,
  term_months     int,
  start_date      date,
  status          text DEFAULT 'active',
  risk_score      numeric,
  data            jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked      boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.draw_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES public.organizations(id),
  loan_id     uuid REFERENCES public.loans(id),
  amount      numeric NOT NULL,
  status      text DEFAULT 'pending',
  data        jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES public.organizations(id),
  loan_id    uuid REFERENCES public.loans(id),
  amount     numeric DEFAULT 0,
  status     text DEFAULT 'pending',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investor_holdings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid REFERENCES public.organizations(id),
  loan_id           uuid REFERENCES public.loans(id),
  investor_user_id  text NOT NULL,
  share_pct         numeric DEFAULT 0,
  token_balance     numeric DEFAULT 0,
  token_symbol      text,
  status            text DEFAULT 'active',
  data              jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distributions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid REFERENCES public.organizations(id),
  loan_id           uuid REFERENCES public.loans(id),
  investor_user_id  text,
  period            text,
  gross_amount      numeric DEFAULT 0,
  net_amount        numeric DEFAULT 0,
  type              text DEFAULT 'Interest',
  status            text DEFAULT 'paid',
  data              jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inspections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  loan_id    uuid,
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escrows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  loan_id    uuid,
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  loan_id    uuid,
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  name       text DEFAULT '',
  address    text DEFAULT '',
  asset_type text DEFAULT '',
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  title      text,
  status     text DEFAULT 'active',
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  user_id    text,
  action     text,
  entity     text,
  entity_id  text,
  data       jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ── 2. INDEXES ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_loans_org_id       ON public.loans(org_id);
CREATE INDEX IF NOT EXISTS idx_loans_status        ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_draw_requests_loan  ON public.draw_requests(loan_id);
CREATE INDEX IF NOT EXISTS idx_investor_holdings_user ON public.investor_holdings(investor_user_id);
CREATE INDEX IF NOT EXISTS idx_distributions_user  ON public.distributions(investor_user_id);

-- ── 3. DEMO ORGANIZATION ─────────────────────────────────────

INSERT INTO public.organizations (id, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Kontra Platform Demo', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── 4. DEMO USERS (password = "12345678" bcrypt hash) ────────
-- Hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAd1J/RG4L.T0cYS

INSERT INTO public.users (id, email, password_hash, role, portal, org_id) VALUES
  ('3c8e1ffe-03d7-4b4e-80b3-3ed2555357e2', 'replit@kontraplatform.com',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAd1J/RG4L.T0cYS',
   'lender_admin', 'lender', 'a0000000-0000-0000-0000-000000000001'),
  ('45a3a49f-c24a-421c-b22a-dc5ca6bc8673', 'servicer@kontraplatform.com',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAd1J/RG4L.T0cYS',
   'servicer', 'servicer', 'a0000000-0000-0000-0000-000000000001'),
  ('9bde42ed-0b2d-4475-ba37-777933e4629b', 'investor@kontraplatform.com',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAd1J/RG4L.T0cYS',
   'investor', 'investor', 'a0000000-0000-0000-0000-000000000001'),
  ('e7bd29bd-6266-4cb9-8de0-2a0657710359', 'borrower@kontraplatform.com',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAd1J/RG4L.T0cYS',
   'borrower', 'borrower', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO NOTHING;

-- ── 5. ORG MEMBERSHIPS ───────────────────────────────────────

INSERT INTO public.org_memberships (org_id, user_id, role, status, data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'replit@kontraplatform.com',   'lender_admin', 'active', '{"portal":"lender"}'),
  ('a0000000-0000-0000-0000-000000000001', 'servicer@kontraplatform.com', 'servicer',     'active', '{"portal":"servicer"}'),
  ('a0000000-0000-0000-0000-000000000001', 'investor@kontraplatform.com', 'investor',     'active', '{"portal":"investor"}'),
  ('a0000000-0000-0000-0000-000000000001', 'borrower@kontraplatform.com', 'borrower',     'active', '{"portal":"borrower"}')
ON CONFLICT DO NOTHING;

-- ── 6. DEMO LOANS ────────────────────────────────────────────

INSERT INTO public.loans (id, org_id, title, borrower_name, property_type, amount, interest_rate, risk_score, status, data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'LN-2847 — Cedar Grove Partners', 'Cedar Grove Partners', 'Multifamily',
   4200000, 8.75, 0.25, 'active',
   '{"loan_ref":"LN-2847","property_name":"The Meridian Apartments","property_type":"Multifamily","location":"Austin, TX","current_balance":4200000,"maturity_date":"2026-09-01","dscr":1.42,"ltv":68.2}'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'LN-3201 — Metro Development LLC', 'Metro Development LLC', 'Industrial',
   5520000, 7.90, 0.35, 'active',
   '{"loan_ref":"LN-3201","property_name":"Westgate Industrial Park","property_type":"Industrial","location":"Phoenix, AZ","current_balance":5520000,"maturity_date":"2027-03-01","dscr":1.68,"ltv":52.1}'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'LN-4108 — Oakfield Group', 'Oakfield Group', 'Retail',
   2800000, 11.50, 0.85, 'special_servicing',
   '{"loan_ref":"LN-4108","property_name":"Harbor Blvd Retail","property_type":"Retail","location":"San Diego, CA","current_balance":2800000,"maturity_date":"2025-12-01","dscr":0.94,"ltv":88.5,"delinquency_days":45}'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'LN-5593 — Westridge Capital', 'Westridge Capital', 'Office',
   6800000, 9.10, 0.45, 'active',
   '{"loan_ref":"LN-5593","property_name":"Summit Office Complex","property_type":"Office","location":"Denver, CO","current_balance":6800000,"maturity_date":"2026-06-01","dscr":1.21,"ltv":74.8}'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
   'LN-1120 — Sunrise Holdings', 'Sunrise Holdings', 'Multifamily',
   3200000, 8.25, 0.30, 'active',
   '{"loan_ref":"LN-1120","property_name":"Sunrise Residences","property_type":"Multifamily","location":"Dallas, TX","current_balance":3200000,"maturity_date":"2027-01-01","dscr":1.55,"ltv":62.0}'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
   'LN-0728 — Crestwood Logistics', 'Crestwood Logistics', 'Industrial',
   7100000, 7.60, 0.20, 'active',
   '{"loan_ref":"LN-0728","property_name":"Crestwood Distribution Center","property_type":"Industrial","location":"Chicago, IL","current_balance":7100000,"maturity_date":"2028-06-01","dscr":1.82,"ltv":48.5}')
ON CONFLICT (id) DO NOTHING;

-- ── 7. INVESTOR HOLDINGS ─────────────────────────────────────

INSERT INTO public.investor_holdings (org_id, loan_id, investor_user_id, share_pct, token_balance, token_symbol, status, data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 24.5, 10290, 'KTRA-2847', 'active', '{"yield_pct":8.75}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 24.5, 14945, 'KTRA-2741', 'active', '{"yield_pct":7.90}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 24.5, 8575,  'KTRA-3204', 'active', '{"yield_pct":9.10}')
ON CONFLICT DO NOTHING;

-- ── 8. DISTRIBUTIONS ─────────────────────────────────────────

INSERT INTO public.distributions (org_id, loan_id, investor_user_id, period, gross_amount, net_amount, type, status, data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'April 2026', 8920.63, 8027.00, 'Interest', 'paid', '{"paid_at":"2026-04-01"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'April 2026', 12150.00, 10935.00, 'Interest', 'paid', '{"paid_at":"2026-04-01"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'April 2026', 7987.50, 7188.75, 'Interest', 'paid', '{"paid_at":"2026-04-01"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'March 2026', 8920.63, 8027.00, 'Interest', 'paid', '{"paid_at":"2026-03-01"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'March 2026', 12150.00, 10935.00, 'Interest', 'paid', '{"paid_at":"2026-03-01"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   '9bde42ed-0b2d-4475-ba37-777933e4629b', 'May 2026', 8920.63, 8027.00, 'Interest', 'scheduled', '{"paid_at":"2026-05-01"}')
ON CONFLICT DO NOTHING;

-- ── 9. DRAW REQUESTS ─────────────────────────────────────────

INSERT INTO public.draw_requests (org_id, loan_id, amount, status, data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   285000, 'pending', '{"description":"Construction draw #4 of 6","inspector":"John Smith"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   142000, 'approved', '{"description":"Renovation phase 2","inspector":"Maria Garcia"}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003',
   95000,  'funded',   '{"description":"Equipment installation","inspector":"Robert Lee"}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Done! Verify with:
-- SELECT count(*) FROM loans;          -- should be 6
-- SELECT count(*) FROM investor_holdings; -- should be 3
-- SELECT count(*) FROM users;          -- should be 4
-- ============================================================
