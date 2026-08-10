-- ── 017_settlement_capability.sql ────────────────────────────────────────────
--
-- Adds Settlement Readiness capability to deal_rooms and deal_analyses.
-- Safe to re-run (all statements are IF NOT EXISTS / conditional).
--
-- This migration NEVER implies that settlement_readiness_pct = 1.0 means
-- deterministic conditions are satisfied. all_conditions_met is ALWAYS
-- computed server-side from verified fields and approvals at completion time.
-- No computed/generated column is used for that purpose.
--
-- Terminology note: New settlement code uses "transactionId" / "workspaceId"
-- concepts; the underlying column remains property_id for backward compat.

-- ── deal_rooms additions ──────────────────────────────────────────────────────

-- Which settlement mode the coordinator has chosen for this workspace.
-- NULL = capability not yet activated or mode not yet chosen.
ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS settlement_mode TEXT
    CHECK (settlement_mode IN ('traditional', 'digital', 'tokenized'));

-- When the coordinator locked the settlement mode (prevents further changes).
ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS settlement_mode_locked_at TIMESTAMPTZ;

-- Informational/cache score (0.0000–1.0000) computed from verified conditions
-- using: verified=1.0, needs_review=0.5, missing=0.
-- This is a display metric ONLY. It NEVER gates completion.
-- Completion is gated by a deterministic server-side check (all mandatory
-- settlement.* fields must have status='verified' and all required approval
-- rows must have action='approved').
ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS settlement_readiness_pct NUMERIC(5,4);

-- Set simultaneously with completed_at when the Transaction Seal is created.
-- Once set, transaction_record_fields for this workspace become immutable.
ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

-- The timestamp the workspace reached the 'complete' stage and was sealed.
ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index on completed rooms for reporting queries.
CREATE INDEX IF NOT EXISTS idx_deal_rooms_completed
  ON deal_rooms (completed_at)
  WHERE completed_at IS NOT NULL;

-- Index on sealed rooms (guards write access to transaction_record_fields).
CREATE INDEX IF NOT EXISTS idx_deal_rooms_sealed
  ON deal_rooms (property_id, sealed_at)
  WHERE sealed_at IS NOT NULL;

-- ── deal_analyses additions ───────────────────────────────────────────────────

-- Marks documents added after the Transaction Seal was created.
-- These are excluded from the sealed snapshot and displayed separately in the
-- Post-Completion Records section.
ALTER TABLE deal_analyses
  ADD COLUMN IF NOT EXISTS post_completion BOOLEAN NOT NULL DEFAULT false;

-- Timestamp of when the post-completion document was added (for display).
ALTER TABLE deal_analyses
  ADD COLUMN IF NOT EXISTS post_completion_added_at TIMESTAMPTZ;

-- Index for efficiently fetching post-completion documents separately.
CREATE INDEX IF NOT EXISTS idx_deal_analyses_post_completion
  ON deal_analyses (property_id, post_completion, post_completion_added_at)
  WHERE post_completion = true;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After running this migration, verify with:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'deal_rooms'
--     AND column_name IN ('settlement_mode','settlement_mode_locked_at',
--                         'settlement_readiness_pct','sealed_at','completed_at');
--
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'deal_analyses'
--     AND column_name IN ('post_completion','post_completion_added_at');
