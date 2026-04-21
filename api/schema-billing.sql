-- ─────────────────────────────────────────────────────────────────────────────
-- Kontra Hybrid Billing Schema
-- Pricing: per_loan_price (fixed monthly per active loan) +
--           transaction_fee_pct (% of every platform transaction)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add pricing columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS per_loan_price        NUMERIC(10,2)  DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS transaction_fee_pct   NUMERIC(7,6)   DEFAULT 0.002500,
  ADD COLUMN IF NOT EXISTS billing_email         TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT;

-- 2. Platform transactions (every fee-generating event)
CREATE TABLE IF NOT EXISTS billing_transactions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT         NOT NULL,
  loan_id           TEXT,
  transaction_amount NUMERIC(14,2) NOT NULL,
  fee_amount         NUMERIC(14,2) NOT NULL,
  type               TEXT         NOT NULL,   -- 'loan_payment','draw','escrow','payoff','other'
  description        TEXT,
  reference_id       TEXT,                    -- external ref (Stripe charge id, etc.)
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_org ON billing_transactions (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_loan ON billing_transactions (loan_id);

-- 3. Billing records (one per org per billing period)
CREATE TABLE IF NOT EXISTS billing_records (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT         NOT NULL,
  period_start      DATE         NOT NULL,
  period_end        DATE         NOT NULL,
  loan_count        INTEGER      NOT NULL DEFAULT 0,
  loan_charges      NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_volume NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_fees  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  status            TEXT         NOT NULL DEFAULT 'draft',  -- draft | finalized | paid | overdue
  stripe_invoice_id TEXT,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (org_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_billing_records_org ON billing_records (org_id, period_start DESC);
