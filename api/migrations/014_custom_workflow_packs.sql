-- Custom workflow packs generated for an individual workspace.
-- Run this against the Supabase project used by the Kontra API before
-- creating new AI-generated workspaces.

CREATE TABLE IF NOT EXISTS custom_workflow_packs (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_workflow_packs_created_at_idx
  ON custom_workflow_packs (created_at DESC);

ALTER TABLE custom_workflow_packs ENABLE ROW LEVEL SECURITY;

-- The API uses the Supabase service role, which bypasses RLS. This policy
-- keeps the table usable if an authenticated admin client accesses it later.
CREATE POLICY "Service role full access" ON custom_workflow_packs
  FOR ALL USING (true) WITH CHECK (true);