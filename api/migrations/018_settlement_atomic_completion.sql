-- ── 018_settlement_atomic_completion.sql ─────────────────────────────────────
--
-- Two additions for production-safe Transaction Seal integrity:
--
-- 1. UNIQUE INDEX: at most one active Transaction Seal per workspace.
--    deal_analyses uses `section` as the record-type discriminator and
--    `analysis` (JSONB) as the content store.
--
-- 2. RPC FUNCTION: complete_settlement_transaction() — executes the full
--    seal-creation + room-update sequence inside a single PostgreSQL
--    transaction with a FOR UPDATE row lock.
--
-- Depends on: 017_settlement_capability.sql
-- Safe to re-run: CREATE ... IF NOT EXISTS / CREATE OR REPLACE FUNCTION.

-- ── 1. Uniqueness constraint ──────────────────────────────────────────────────
-- At most one non-post-completion transaction_seal row per workspace.
-- Prevents duplicate seals from concurrent or retried completion calls.

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_analyses_one_seal_per_room
  ON deal_analyses (property_id)
  WHERE section = 'transaction_seal' AND post_completion = false;

-- ── 2. Atomic completion RPC ──────────────────────────────────────────────────
-- Stores the seal in deal_analyses.analysis (JSONB) and seals the room in
-- a single database transaction.
--
-- Return value (JSONB):
--   { "ok": true, "seal_id": "<uuid>", "sealed_at": "<timestamptz>" }
--   { "error": "ALREADY_SEALED", "sealed_at": "<existing timestamptz>" }
--   { "error": "ROOM_NOT_FOUND" }

CREATE OR REPLACE FUNCTION complete_settlement_transaction(
  p_property_id  TEXT,
  p_seal_content JSONB,       -- sealContent object → stored in analysis column
  p_score        NUMERIC,     -- settlement_readiness_pct to cache on deal_rooms
  p_now          TIMESTAMPTZ  -- caller-supplied timestamp (sealed_at = completed_at)
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sealed_at TIMESTAMPTZ;
  v_seal_id   UUID;
BEGIN
  -- Lock the deal_room row to prevent concurrent completion races.
  SELECT sealed_at
    INTO v_sealed_at
    FROM deal_rooms
   WHERE property_id = p_property_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ROOM_NOT_FOUND');
  END IF;

  -- Idempotency: already sealed → return existing timestamp.
  IF v_sealed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error',     'ALREADY_SEALED',
      'sealed_at', v_sealed_at
    );
  END IF;

  -- Insert the Transaction Seal.
  -- The unique index will raise a constraint violation (rolling back the whole
  -- transaction) if a concurrent call races past the FOR UPDATE lock.
  INSERT INTO deal_analyses (
    property_id,
    section,
    analysis,
    post_completion
  ) VALUES (
    p_property_id,
    'transaction_seal',
    p_seal_content,
    false
  )
  RETURNING id INTO v_seal_id;

  -- Atomically seal the room and advance the lifecycle stage.
  UPDATE deal_rooms
     SET sealed_at                = p_now,
         completed_at             = p_now,
         deal_stage               = 'complete',
         settlement_readiness_pct = p_score
   WHERE property_id = p_property_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'seal_id',   v_seal_id,
    'sealed_at', p_now
  );
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────────
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'deal_analyses'
--     AND indexname = 'idx_deal_analyses_one_seal_per_room';
--
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_name = 'complete_settlement_transaction';
