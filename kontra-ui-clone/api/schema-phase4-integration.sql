-- =============================================================================
-- Phase 4: Integration Hub Schema
--
-- Tables for document intelligence and legacy system integration layer.
-- =============================================================================

-- ── Integration Jobs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_integration_jobs (
  id            TEXT         PRIMARY KEY,              -- JOB-XXXX
  status        TEXT         NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','staged','ingested')),
  source        TEXT         NOT NULL                  -- 'file_upload', 'email', 'api_ingest', 'scheduled'
    CHECK (source IN ('file_upload','email','api_ingest','scheduled','ftp','webhook')),
  doc_type      TEXT,                                  -- matches documentIntelligence doc types
  filename      TEXT,
  adapter_id    TEXT,                                  -- which legacyAdapter ran
  org_id        UUID,
  actor_id      UUID,                                  -- who triggered the job
  result_data   JSONB,                                 -- full extraction result
  normalized_data JSONB,                               -- adapter-normalized object
  confidence    NUMERIC(4,3),                          -- 0.000 to 1.000
  error_msg     TEXT,
  processing_ms INTEGER,
  model_used    TEXT,                                  -- gpt-4o-mini, demo, etc.
  ingested_at   TIMESTAMPTZ,                           -- when staged to live tables
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_integration_jobs_status_idx   ON kontra_integration_jobs(status);
CREATE INDEX IF NOT EXISTS kontra_integration_jobs_doc_type_idx ON kontra_integration_jobs(doc_type);
CREATE INDEX IF NOT EXISTS kontra_integration_jobs_org_idx      ON kontra_integration_jobs(org_id);
CREATE INDEX IF NOT EXISTS kontra_integration_jobs_created_idx  ON kontra_integration_jobs(created_at DESC);

-- ── Integration Sources (registered adapters + connections) ───────────────────

CREATE TABLE IF NOT EXISTS kontra_integration_sources (
  id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id      TEXT   NOT NULL UNIQUE,
  display_name    TEXT   NOT NULL,
  category        TEXT   NOT NULL
    CHECK (category IN ('servicing_platform','property_management','surveillance','inspection','insurance','reserve','correspondence','general')),
  description     TEXT,
  formats         TEXT[],
  connection_type TEXT
    CHECK (connection_type IN ('sftp','api','file_upload','email','webhook','manual')),
  connection_config JSONB,                             -- encrypted or redacted in prod
  org_id          UUID,                                -- NULL = platform-wide
  last_sync_at    TIMESTAMPTZ,
  sync_frequency  TEXT,                                -- 'daily', 'weekly', 'monthly', 'on_demand'
  status          TEXT   DEFAULT 'active'
    CHECK (status IN ('active','paused','error','not_configured')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed registered adapters
INSERT INTO kontra_integration_sources (adapter_id, display_name, category, description, formats, connection_type, status) VALUES
  ('fics_export',        'FICS Loan Servicing',         'servicing_platform',   'Financial Industry Computer Systems export', ARRAY['xml','fixed_width','csv'], 'sftp',       'active'),
  ('situs_csv',          'Situs / CRES (AMC)',           'servicing_platform',   'Situs and AMC servicing platform CSV',       ARRAY['csv'],                     'sftp',       'active'),
  ('yardi_json',         'Yardi Voyager',                'property_management',  'Yardi API or export JSON',                   ARRAY['json','xml'],               'api',        'active'),
  ('mri_csv',            'MRI Software',                 'property_management',  'MRI commercial property management export',  ARRAY['csv','excel'],              'sftp',       'active'),
  ('riskmetrics_csv',    'Trepp / RiskMetrics CMBS',     'surveillance',         'Trepp CMBS surveillance loan tape',          ARRAY['csv'],                     'sftp',       'active'),
  ('spreadsheet_csv',    'Generic Spreadsheet',          'general',              'Auto-mapping CSV/Excel adapter',             ARRAY['csv','excel','tsv'],        'file_upload','active'),
  ('email_text',         'Email / Fax Parsing',          'correspondence',       'Email, fax, and letter servicing requests',  ARRAY['text','eml','msg'],         'email',      'active'),
  ('inspection_vendor',  'Inspection Vendor Reports',    'inspection',           'Field vendor inspection data ingestion',     ARRAY['json','csv','xml'],         'api',        'active'),
  ('insurance_acord',    'Insurance ACORD / Certificate','insurance',            'ACORD 25/27/28 and binder ingestion',        ARRAY['xml','json','csv'],         'email',      'active'),
  ('reserve_xml',        'Reserve System Export',        'reserve',              'Capital reserve account statement export',   ARRAY['xml','json','csv'],         'sftp',       'active')
ON CONFLICT (adapter_id) DO NOTHING;

-- ── Document Extractions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_document_extractions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          TEXT         REFERENCES kontra_integration_jobs(id) ON DELETE CASCADE,
  org_id          UUID,
  loan_id         UUID,
  doc_type        TEXT         NOT NULL,
  filename        TEXT,
  extracted_data  JSONB        NOT NULL,
  confidence      NUMERIC(4,3),
  model_used      TEXT,
  review_status   TEXT         DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','ingested')),
  reviewed_by     UUID,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_doc_extractions_org_idx      ON kontra_document_extractions(org_id);
CREATE INDEX IF NOT EXISTS kontra_doc_extractions_doc_type_idx ON kontra_document_extractions(doc_type);
CREATE INDEX IF NOT EXISTS kontra_doc_extractions_review_idx   ON kontra_document_extractions(review_status);

-- ── Email/Fax Request Queue ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_email_requests (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID,
  loan_id         UUID,
  job_id          TEXT         REFERENCES kontra_integration_jobs(id) ON DELETE SET NULL,
  request_type    TEXT,
  urgency         TEXT         DEFAULT 'normal',
  sender_name     TEXT,
  sender_email    TEXT,
  sender_company  TEXT,
  subject_line    TEXT,
  raw_text        TEXT,
  extracted_data  JSONB,
  action_required TEXT,
  assigned_to     UUID,
  status          TEXT         DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kontra_email_requests_status_idx ON kontra_email_requests(status);
CREATE INDEX IF NOT EXISTS kontra_email_requests_org_idx    ON kontra_email_requests(org_id);

-- Done.
