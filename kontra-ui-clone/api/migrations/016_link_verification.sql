-- ============================================================
-- 016_link_verification.sql
-- Adds 'link' as a valid verification_method for deal_room_invites.
--
-- Context: The original constraint only allowed 'email_otp' and 'pin'.
-- The product now uses token-link auth (participant clicks a one-time URL,
-- the server validates the hashed token and issues a session — no PIN needed).
-- This migration expands the constraint and updates the column default so all
-- new invites use 'link' without any application-level workaround.
--
-- Safe to re-run (idempotent via DO $$ block).
-- ============================================================

DO $$
BEGIN
  -- 1. Drop the old CHECK constraint (by name from migration 011)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deal_room_invites'
      AND constraint_name = 'deal_room_invites_verification_method_check'
  ) THEN
    ALTER TABLE deal_room_invites
      DROP CONSTRAINT deal_room_invites_verification_method_check;
  END IF;

  -- 2. Add the updated constraint that allows link-based auth
  ALTER TABLE deal_room_invites
    ADD CONSTRAINT deal_room_invites_verification_method_check
      CHECK (verification_method IN ('email_otp', 'pin', 'link'));

  -- 3. Update the column default to 'link' (new invites use link auth by default)
  ALTER TABLE deal_room_invites
    ALTER COLUMN verification_method SET DEFAULT 'link';

  -- 4. Add last_used_at column if not present (used by verify-link endpoint)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_room_invites'
      AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE deal_room_invites ADD COLUMN last_used_at TIMESTAMPTZ;
  END IF;

  -- 5. Add accepted_at column if not present (used by the verify-link endpoint to
  --    record when the participant first clicks their link)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deal_room_invites'
      AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE deal_room_invites ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;

END $$;

-- Verify the constraint was applied correctly
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'deal_room_invites_verification_method_check';
