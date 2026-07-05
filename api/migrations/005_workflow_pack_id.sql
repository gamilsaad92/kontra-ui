-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor
--
-- Adds the Workflow Pack identifier to deal_rooms so the frontend knows
-- which pack (cre_acquisition, business_acquisition, ...) powers a given
-- deal room. Defaults to 'cre_acquisition' so existing rows keep working
-- unchanged.

ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS workflow_pack_id text DEFAULT 'cre_acquisition';
