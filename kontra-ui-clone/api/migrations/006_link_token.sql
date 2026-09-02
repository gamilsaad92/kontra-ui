-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor
--
-- Pre-existing gap found while testing the Workflow Pack engine: index.js has
-- written to deal_rooms.link_token since before this migration existed, but
-- the column was never added. The write is wrapped in .catch(() => {}) so it
-- failed silently — this just makes it actually work.

ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS link_token text;
