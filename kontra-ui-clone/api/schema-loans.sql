- Core loan tables for servicing and reporting
CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,
  loan_number TEXT UNIQUE,
  borrower_name TEXT NOT NULL,
  borrower_user_id UUID,
  organization_id UUID,
  property_id TEXT,
  collateral_type TEXT,
  state TEXT,
  amount NUMERIC,
  orig_balance NUMERIC,
  curr_balance NUMERIC,
  note_rate NUMERIC,
  interest_rate NUMERIC,
  "index" TEXT,
  spread NUMERIC,
  term_months INTEGER,
  start_date DATE,
  status TEXT CHECK (status IN ('current', 'delinquent', 'default', 'foreclosure', 'paid_off', 'watchlist')),
  maturity_date DATE,
  io_end_date DATE,
  amort_type TEXT,
  risk_score NUMERIC,
  servicer_status_flags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_state ON loans(state);
CREATE INDEX IF NOT EXISTS idx_loans_org ON loans(organization_id);

CREATE TABLE IF NOT EXISTS loan_cashflows (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  scheduled_prin NUMERIC DEFAULT 0,
  scheduled_int NUMERIC DEFAULT 0,
  actual_prin NUMERIC DEFAULT 0,
  actual_int NUMERIC DEFAULT 0,
  fees NUMERIC DEFAULT 0,
  advances NUMERIC DEFAULT 0,
  recoveries NUMERIC DEFAULT 0,
  net_to_investors NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_cashflows_unique_period ON loan_cashflows(loan_id, period_date);

CREATE TABLE IF NOT EXISTS loan_docs (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_docs_loan_id ON loan_docs(loan_id);

CREATE TABLE IF NOT EXISTS drafts (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_loan_id ON drafts(loan_id);
