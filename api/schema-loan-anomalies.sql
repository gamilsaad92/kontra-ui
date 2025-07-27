-- Tables for loan anomaly detection
CREATE TABLE IF NOT EXISTS loan_address_history (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_anomalies (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  details TEXT,
  reference_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
