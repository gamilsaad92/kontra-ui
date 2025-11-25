-- Core tables for loan asset digitization and token tracking
CREATE TABLE IF NOT EXISTS loan_tokenized_loans (
  id BIGSERIAL PRIMARY KEY,
  property_address TEXT NOT NULL,
  balance NUMERIC,
  rate NUMERIC,
  maturity DATE,
  status TEXT,
  borrower TEXT,
  lien_position TEXT,
  collateral_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_tokenized_loans_status ON loan_tokenized_loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_tokenized_loans_borrower ON loan_tokenized_loans(borrower);

CREATE TABLE IF NOT EXISTS loan_tokens (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loan_tokenized_loans(id) ON DELETE CASCADE,
  token_symbol TEXT NOT NULL,
  total_supply NUMERIC NOT NULL,
  price_per_token NUMERIC,
  chain TEXT,
  owner_wallet TEXT,
  standard TEXT DEFAULT 'ERC-20',
  metadata_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_tokens_loan_id ON loan_tokens(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_tokens_symbol ON loan_tokens(token_symbol);

CREATE TABLE IF NOT EXISTS loan_token_transactions (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT REFERENCES loan_tokens(id) ON DELETE CASCADE,
  buyer TEXT,
  seller TEXT,
  amount NUMERIC,
  tx_hash TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  chain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_token_transactions_token_id ON loan_token_transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_loan_token_transactions_buyer ON loan_token_transactions(buyer);
