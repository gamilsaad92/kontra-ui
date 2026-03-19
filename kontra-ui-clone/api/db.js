const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

if (!process.env.SUPABASE_URL) {
  console.warn('[db] SUPABASE_URL is not set — database queries will fail. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const replica = process.env.SUPABASE_REPLICA_URL
  ? createClient(process.env.SUPABASE_REPLICA_URL, SUPABASE_KEY)
  : supabase;

module.exports = { supabase, replica };
