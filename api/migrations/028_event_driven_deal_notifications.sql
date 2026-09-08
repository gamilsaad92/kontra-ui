-- Event-driven participant email delivery metadata.
-- Safe to re-run after 009_deal_notifications.sql.

ALTER TABLE deal_notifications
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_notifications_idempotency
  ON deal_notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_notifications_event
  ON deal_notifications(event_id, event_type);