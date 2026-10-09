-- Apply only after explicit approval and after the release diagnostic confirms
-- the production database target. This enables durable, retry-safe owner access.

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS owner_write_token text;

-- Table-level SELECT grants would include the owner capability column. Remove
-- those grants, then preserve RLS-filtered reads of all other existing columns.
REVOKE SELECT ON TABLE public.deal_rooms FROM anon, authenticated;
REVOKE SELECT (owner_write_token) ON TABLE public.deal_rooms FROM anon, authenticated;
GRANT SELECT (
  id,
  stripe_session_id,
  plan,
  property_id,
  property_name,
  "role",
  customer_email,
  amount_paid,
  status,
  address,
  property_type,
  property_size,
  deal_type,
  deal_amount,
  closing_date,
  first_name,
  last_name,
  created_at,
  activated_at,
  deal_stage,
  link_token,
  auth_v2_enabled,
  workflow_pack_id,
  stages_config,
  checklist_items,
  metadata_values,
  jurisdiction,
  settlement_mode,
  settlement_mode_locked_at,
  settlement_readiness_pct,
  sealed_at,
  completed_at,
  transaction_entry_mode,
  base_pack,
  transaction_type,
  transaction_subtype,
  transaction_context,
  generated_proposal,
  is_pilot
) ON TABLE public.deal_rooms TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.deal_room_checkout_intents (
  property_id text PRIMARY KEY,
  stripe_session_id text UNIQUE,
  owner_write_token text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('deal', 'pro_monthly', 'pro_annual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_room_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.deal_room_checkout_intents FROM anon, authenticated;
GRANT ALL ON TABLE public.deal_room_checkout_intents TO service_role;

COMMENT ON TABLE public.deal_room_checkout_intents IS
  'Private durable bridge between a Stripe Checkout Session and its deal-room owner access token.';
