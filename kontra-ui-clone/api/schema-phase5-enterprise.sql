-- ============================================================
-- Kontra Phase 5 — Headless Enterprise Interoperability Schema
-- ============================================================
-- Tables:
--   kontra_webhooks          — registered webhook endpoints
--   kontra_webhook_events    — delivery log (per-attempt)
--   kontra_event_log         — canonical event stream archive
--   kontra_model_routes      — org-level LLM routing configs
--   kontra_api_keys          — API key registry
--   kontra_plugin_installs   — installed connector instances
-- ============================================================

-- ── Webhooks ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID,
  url             TEXT NOT NULL,
  description     TEXT,
  events          TEXT[]     NOT NULL DEFAULT ARRAY['*'],
  secret          TEXT,
  headers         JSONB      NOT NULL DEFAULT '{}',
  active          BOOLEAN    NOT NULL DEFAULT TRUE,
  deliveries      INTEGER    NOT NULL DEFAULT 0,
  failures        INTEGER    NOT NULL DEFAULT 0,
  last_delivered_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_webhooks_org_id ON kontra_webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_kontra_webhooks_active  ON kontra_webhooks(active);

-- ── Webhook delivery log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES kontra_webhooks(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL,
  event_type      TEXT NOT NULL,
  attempt         SMALLINT NOT NULL DEFAULT 1,
  status_code     SMALLINT,
  latency_ms      INTEGER,
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  error           TEXT,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_webhook_events_webhook_id  ON kontra_webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_kontra_webhook_events_event_type  ON kontra_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kontra_webhook_events_success      ON kontra_webhook_events(success);

-- ── Canonical event log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_event_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  org_id      UUID,
  source      TEXT NOT NULL DEFAULT 'kontra-api',
  version     TEXT NOT NULL DEFAULT '1.0',
  data        JSONB NOT NULL DEFAULT '{}',
  emitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_event_log_type     ON kontra_event_log(type);
CREATE INDEX IF NOT EXISTS idx_kontra_event_log_org_id   ON kontra_event_log(org_id);
CREATE INDEX IF NOT EXISTS idx_kontra_event_log_emitted  ON kontra_event_log(emitted_at DESC);

-- Partition hint (use pg_partman in production for time-based partitioning)
COMMENT ON TABLE kontra_event_log IS 'Canonical event archive. Partition by emitted_at month in production. Retain 2 years.';

-- ── Org-level model routing config ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_model_routes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL UNIQUE,
  provider_chain   TEXT[]     NOT NULL DEFAULT ARRAY['openai','anthropic'],
  preferred_model  TEXT,
  openai_api_key   TEXT,       -- encrypted in production (use Vault / KMS)
  azure_endpoint   TEXT,
  azure_deployment TEXT,
  anthropic_api_key TEXT,
  ollama_base_url  TEXT,
  temperature      NUMERIC(3,2) DEFAULT 0.10,
  max_tokens       INTEGER      DEFAULT 1024,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_model_routes_org_id ON kontra_model_routes(org_id);

-- ── API key registry ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the raw key
  key_prefix    TEXT NOT NULL,          -- first 14 chars for display (e.g. kontra_live_ab)
  scopes        TEXT[]  NOT NULL DEFAULT ARRAY['*'],
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_api_keys_org_id   ON kontra_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_kontra_api_keys_key_hash ON kontra_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_kontra_api_keys_active   ON kontra_api_keys(active);

-- ── Plugin / connector installs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kontra_plugin_installs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  connector_id     TEXT NOT NULL,
  label            TEXT NOT NULL,
  credentials_enc  TEXT,          -- AES-256-GCM encrypted JSON in production
  config           JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
  execution_count  INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  installed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kontra_plugin_installs_org_id       ON kontra_plugin_installs(org_id);
CREATE INDEX IF NOT EXISTS idx_kontra_plugin_installs_connector_id ON kontra_plugin_installs(connector_id);

-- ── Seed: demo webhooks ───────────────────────────────────────────────────────

INSERT INTO kontra_webhooks (url, description, events, active) VALUES
  ('https://hooks.slack.com/services/demo/kontra-alerts',  'Slack — Critical Alerts Channel',   ARRAY['agent.escalation','policy.violation','draw.rejected'],  TRUE),
  ('https://api.example-lender.com/kontra/events',         'First National Bank — Loan Events', ARRAY['loan.*','draw.*','token.*'],                             TRUE),
  ('https://servicer-platform.io/webhook/kontra',          'Situs AMC — Full Event Stream',     ARRAY['*'],                                                    TRUE)
ON CONFLICT DO NOTHING;

-- ── Seed: recent event log entries ───────────────────────────────────────────

INSERT INTO kontra_event_log (type, source, data) VALUES
  ('loan.updated',         'kontra-api', '{"loan_id":"LN-0094","field":"dscr","old":1.18,"new":1.22}'),
  ('draw.approved',        'kontra-api', '{"draw_id":"DRW-0047","amount":82000,"loan_id":"LN-0094","approved_by":"agent:draw-approval"}'),
  ('inspection.completed', 'kontra-api', '{"inspection_id":"INS-0012","property":"Harbor View","condition":"fair","deficiencies":2}'),
  ('policy.violation',     'kontra-api', '{"rule":"MIN_DSCR_FREDDIE","loan_id":"LN-3301","value":1.18,"threshold":1.25}'),
  ('agent.action',         'kontra-api', '{"agent":"covenant-monitor","action":"dscr_check","result":"pass","loan_id":"LN-0094"}'),
  ('document.extracted',   'kontra-api', '{"job_id":"JOB-0001","doc_type":"inspection_report","confidence":0.94}'),
  ('token.issued',         'kontra-api', '{"token_id":"TKN-0001","loan_id":"LN-0094","units":1000,"blockchain":"ethereum"}')
ON CONFLICT DO NOTHING;
