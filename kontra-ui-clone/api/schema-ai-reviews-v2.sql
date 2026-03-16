ALTER TABLE IF EXISTS ai_reviews
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'ai';

UPDATE ai_reviews
SET entity_type = COALESCE(entity_type, type),
    entity_id = COALESCE(entity_id, CASE WHEN source_id ~* '^[0-9a-f-]{36}$' THEN source_id::uuid ELSE gen_random_uuid() END)
WHERE entity_type IS NULL OR entity_id IS NULL;

ALTER TABLE ai_reviews ALTER COLUMN entity_type SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN confidence SET DEFAULT 0;
ALTER TABLE ai_reviews ALTER COLUMN confidence SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN title SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN summary SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN reasons SET DEFAULT '[]'::jsonb;
ALTER TABLE ai_reviews ALTER COLUMN reasons SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN evidence SET DEFAULT '[]'::jsonb;
ALTER TABLE ai_reviews ALTER COLUMN evidence SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN recommended_actions SET DEFAULT '[]'::jsonb;
ALTER TABLE ai_reviews ALTER COLUMN recommended_actions SET NOT NULL;
ALTER TABLE ai_reviews ALTER COLUMN proposed_updates SET DEFAULT '{}'::jsonb;
ALTER TABLE ai_reviews ALTER COLUMN proposed_updates SET NOT NULL;

CREATE INDEX IF NOT EXISTS ai_reviews_org_status_idx ON ai_reviews(org_id, status);
CREATE INDEX IF NOT EXISTS ai_reviews_org_type_status_idx ON ai_reviews(org_id, type, status);
CREATE INDEX IF NOT EXISTS ai_reviews_org_entity_idx ON ai_reviews(org_id, entity_type, entity_id);

ALTER TABLE IF EXISTS ai_review_actions
  ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  actor_id UUID NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_org_action_idx ON audit_log(org_id, action);
