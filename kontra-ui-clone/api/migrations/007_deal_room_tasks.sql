-- Task Engine + AI Ownership Layer (Observe Mode)
-- Every action in a workspace has an explicit owner: a human role or "ai".
CREATE TABLE IF NOT EXISTS deal_room_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   TEXT NOT NULL,
  task_type     TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  owner_type    TEXT NOT NULL DEFAULT 'human',
  owner_role    TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  evidence      JSONB DEFAULT '[]'::jsonb,
  draft_action  JSONB,
  source_type   TEXT,
  source_id     TEXT,
  due_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_room_tasks_property ON deal_room_tasks(property_id, status);
