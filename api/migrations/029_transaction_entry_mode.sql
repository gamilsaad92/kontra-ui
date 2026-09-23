-- Explicitly records whether a room is an active transaction or a previously
-- completed transaction being entered for evidence-backed verification.
-- NULL is intentionally preserved as the legacy/active behavior.

ALTER TABLE deal_rooms
  ADD COLUMN IF NOT EXISTS transaction_entry_mode TEXT;

ALTER TABLE deal_rooms
  DROP CONSTRAINT IF EXISTS deal_rooms_transaction_entry_mode_check;

ALTER TABLE deal_rooms
  ADD CONSTRAINT deal_rooms_transaction_entry_mode_check
  CHECK (
    transaction_entry_mode IS NULL
    OR transaction_entry_mode IN ('active', 'previously_completed')
  );