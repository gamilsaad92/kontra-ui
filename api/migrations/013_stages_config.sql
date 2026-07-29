-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/editor
--
-- Adds a custom stages list to deal_rooms so workspace owners can
-- rename, reorder, add, and delete lifecycle stages.
-- When NULL, the workspace uses its workflow pack's default stage list.
-- When set, this ordered JSONB array of {key, label, icon?, desc?}
-- overrides the pack's static stages on both frontend and backend.

ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stages_config JSONB DEFAULT NULL;
