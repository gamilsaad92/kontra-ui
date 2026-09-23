-- The pilot API writes is_pilot=true and treats an absent/false value as
-- non-pilot. No earlier repository migration defines this application field.
-- Keep the repair additive and preserve existing room values.

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;