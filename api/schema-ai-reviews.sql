CREATE TABLE IF NOT EXISTS ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID,
  loan_id UUID,
  type TEXT NOT NULL CHECK (type IN ('payment', 'inspection')),
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'needs_review', 'fail')),
  confidence NUMERIC,
  title TEXT,
  summary TEXT,
  reasons JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  proposed_updates JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES ai_reviews(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL,
  notes TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_reviews_org_policy ON ai_reviews
  USING (org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', org_id::text))
  WITH CHECK (org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', org_id::text));

CREATE POLICY ai_review_actions_org_policy ON ai_review_actions
  USING (
    EXISTS (
      SELECT 1 FROM ai_reviews
      WHERE ai_reviews.id = ai_review_actions.review_id
        AND ai_reviews.org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', ai_reviews.org_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_reviews
      WHERE ai_reviews.id = ai_review_actions.review_id
        AND ai_reviews.org_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', ai_reviews.org_id::text)
    )
  );
