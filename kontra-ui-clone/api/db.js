const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const replica = process.env.SUPABASE_REPLICA_URL
  ? createClient(process.env.SUPABASE_REPLICA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

module.exports = { supabase, replica };
