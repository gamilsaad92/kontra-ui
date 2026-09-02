-- Deal notification audit log
-- Run in Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS deal_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  type        TEXT NOT NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_notif_property ON deal_notifications(property_id);
CREATE INDEX IF NOT EXISTS idx_deal_notif_sent_at  ON deal_notifications(sent_at DESC);

ALTER TABLE deal_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deal_notifications' AND policyname = 'public_read_notifications'
  ) THEN
    CREATE POLICY "public_read_notifications"
      ON deal_notifications FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deal_notifications' AND policyname = 'service_role_write_notifications'
  ) THEN
    CREATE POLICY "service_role_write_notifications"
      ON deal_notifications FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
