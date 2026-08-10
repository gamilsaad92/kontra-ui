-- ── 018_settlement_atomic_completion.sql ─────────────────────────────────────
--
-- Two additions for production-safe Transaction Seal integrity:
--
-- 1. UNIQUE INDEX: at most one active Transaction Seal per workspace.
--    Prevents duplicate seals from concurrent or retried /settlement/complete
--    calls even if the Supabase REST client retries on transient errors.
--
-- 2. RPC FUNCTION: complete_settlement_transaction() — executes the full
--    seal-creation + room-update sequence inside a single PostgreSQL
--    transaction. The server-side condition validation (computeSettlementReadiness)
--    still runs in the API before calling this RPC; the RPC itself adds a
--    FOR UPDATE row lock so concurrent calls cannot both proceed.
--
-- Depends on: 017_settlement_capability.sql (deal_rooms.sealed_at column,
--             deal_analyses.post_completion column).
--
-- Safe to re-run: all statements are CREATE ... IF NOT EXISTS or
--                 CREATE OR REPLACE FUNCTION.

-- ── 1. Uniqueness constraint ──────────────────────────────────────────────────
--
-- A workspace can have at most one non-post-completion transaction_seal row.
-- (Post-completion = false is the seal itself; the index partial predicate
--  excludes any hypothetical future post-completion seal variants.)
--
-- If a concurrent INSERT races past the FOR UPDATE lock in the RPC, this
-- constraint ensures one of them rolls back with a unique-violation error,
-- preventing duplicate seal records entirely.

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_analyses_one_seal_per_room
  ON deal_analyses (property_id)
  WHERE doc_type = 'transaction_seal' AND post_completion = false;

-- ── 2. Atomic completion RPC ──────────────────────────────────────────────────
--
-- Called by the API's POST /settlement/complete handler after the server-side
-- deterministic condition gate passes. The RPC:
--   a. Acquires a FOR UPDATE lock on the deal_rooms row to prevent races.
--   b. Re-checks sealed_at (idempotency guard — second call returns ALREADY_SEALED).
--   c. Inserts the Transaction Seal into deal_analyses.
--   d. Updates deal_rooms (sealed_at, completed_at, deal_stage='complete',
--      settlement_readiness_pct) in the same transaction.
--
-- If any step raises an error (e.g. the unique index fires on a concurrent
-- call), the entire transaction rolls back — no partial state is possible.
--
-- Return value (JSONB):
--   { "ok": true, "seal_id": "<uuid>", "sealed_at": "<timestamptz>" }
--   { "error": "ALREADY_SEALED", "sealed_at": "<existing timestamptz>" }
--   { "error": "ROOM_NOT_FOUND" }

CREATE OR REPLACE FUNCTION complete_settlement_transaction(
  p_property_id  TEXT,
  p_seal_summary TEXT,       -- JSON string — the sealContent object
  p_seal_text    TEXT,       -- Human-readable seal text (for extracted_text column)
  p_score        NUMERIC,    -- settlement_readiness_pct to cache on deal_rooms
  p_now          TIMESTAMPTZ -- Caller-supplied timestamp so sealed_at = completed_at
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sealed_at TIMESTAMPTZ;
  v_seal_id   UUID;
BEGIN
  -- Lock the deal_room row. Any concurrent call on the same property_id will
  -- block here until this transaction commits or rolls back.
  SELECT sealed_at
    INTO v_sealed_at
    FROM deal_rooms
   WHERE property_id = p_property_id
     FOR UPDATE;

  -- Room does not exist.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ROOM_NOT_FOUND');
  END IF;

  -- Already sealed — return idempotent success so the caller can surface the
  -- existing seal rather than surfacing a confusing error to the coordinator.
  IF v_sealed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error',     'ALREADY_SEALED',
      'sealed_at', v_sealed_at
    );
  END IF;

  -- Insert the Transaction Seal record.
  -- The unique index idx_deal_analyses_one_seal_per_room will raise a
  -- constraint violation (rolling back this entire transaction) if a race
  -- somehow slipped past the FOR UPDATE lock above.
  INSERT INTO deal_analyses (
    property_id,
    doc_type,
    status,
    summary,
    extracted_text,
    post_completion,
    source_doc_id
  ) VALUES (
    p_property_id,
    'transaction_seal',
    'ai_complete',
    p_seal_summary,
    p_seal_text,
    false,
    NULL
  )
  RETURNING id INTO v_seal_id;

  -- Atomically seal the room and advance the lifecycle stage.
  UPDATE deal_rooms
     SET sealed_at                = p_now,
         completed_at             = p_now,
         deal_stage               = 'complete',
         settlement_readiness_pct = p_score
   WHERE property_id = p_property_id;

  -- Both writes succeeded in the same transaction.
  RETURN jsonb_build_object(
    'ok',        true,
    'seal_id',   v_seal_id,
    'sealed_at', p_now
  );
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After applying this migration, verify with:
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'deal_analyses'
--     AND indexname = 'idx_deal_analyses_one_seal_per_room';
--
--   SELECT routine_name, routine_type
--   FROM information_schema.routines
--   WHERE routine_name = 'complete_settlement_transaction';
