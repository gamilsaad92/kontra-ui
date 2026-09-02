-- Table for logging AI-extracted document metadata
CREATE TABLE IF NOT EXISTS document_review_logs (
  id BIGSERIAL PRIMARY KEY,
  doc_type TEXT NOT NULL,
  vendor_name TEXT,
  amount NUMERIC,
  document_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
