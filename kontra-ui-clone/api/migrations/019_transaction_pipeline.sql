-- Sprint 1: durable document processing, correlated deal-room tasks, and
-- product-level activity metadata. All changes are additive and safe to rerun.

ALTER TABLE deal_analyses
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'extracted',
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS extraction_version TEXT,
  ADD COLUMN IF NOT EXISTS processing_attempt INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deal_analyses_processing
  ON deal_analyses (property_id, processing_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_analyses_correlation
  ON deal_analyses (correlation_id);

ALTER TABLE deal_room_tasks
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS blocking BOOLEAN,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS source_document_id TEXT,
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS source_agent TEXT,
  ADD COLUMN IF NOT EXISTS source_run_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS required_approver_role TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS send_back_reason TEXT,
  ADD COLUMN IF NOT EXISTS decision TEXT,
  ADD COLUMN IF NOT EXISTS decision_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS decision_actor_role TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS execution_status TEXT,
  ADD COLUMN IF NOT EXISTS execution_result JSONB,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deal_room_tasks_correlation
  ON deal_room_tasks (correlation_id);
CREATE INDEX IF NOT EXISTS idx_deal_room_tasks_execution
  ON deal_room_tasks (property_id, execution_status, status);

-- Existing data is retained. The unique index makes future generated tasks
-- idempotent; application code handles pre-existing duplicate rows gracefully.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_room_tasks_generated
  ON deal_room_tasks (property_id, task_type, source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE deal_events
  ADD COLUMN IF NOT EXISTS org_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB,
  ADD COLUMN IF NOT EXISTS outcome JSONB;

CREATE INDEX IF NOT EXISTS idx_deal_events_correlation
  ON deal_events (correlation_id);