-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/jfhojgtnmcfqretrrxam/editor

CREATE TABLE IF NOT EXISTS deal_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id text UNIQUE,
  plan text,
  property_id text UNIQUE NOT NULL,
  property_name text,
  role text,
  customer_email text,
  amount_paid numeric,
  status text DEFAULT 'active',
  address text,
  property_type text,
  property_size text,
  deal_type text,
  deal_amount text,
  closing_date text,
  first_name text,
  last_name text,
  created_at timestamptz DEFAULT now(),
  activated_at timestamptz
);

-- Enable row-level security (optional but recommended)
ALTER TABLE deal_rooms ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON deal_rooms
  FOR ALL USING (true);
