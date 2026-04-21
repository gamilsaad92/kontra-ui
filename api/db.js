/**
 * db.js — Database client for Kontra API
 *
 * Priority:
 *   1. If DATABASE_URL is set → use Replit PostgreSQL via pgAdapter (fastest, always available)
 *   2. If SUPABASE_URL is a real URL → use Supabase JS client
 *   3. Fallback → Supabase client with placeholder (queries will fail gracefully)
 */

const isRealSupabase = process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes('placeholder') &&
  process.env.SUPABASE_URL.startsWith('https://');

const hasLocalDb = !!process.env.DATABASE_URL;

let supabase, replica;

if (hasLocalDb) {
  // ── Path 1: Replit PostgreSQL (preferred) ──────────────────────────────────
  const { createPgClient } = require('./lib/pgAdapter');
  supabase = createPgClient();
  replica = supabase;
  console.log('[db] Connected to Replit PostgreSQL via pgAdapter');

} else if (isRealSupabase) {
  // ── Path 2: Real Supabase project ──────────────────────────────────────────
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  replica = process.env.SUPABASE_REPLICA_URL
    ? createClient(process.env.SUPABASE_REPLICA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : supabase;
  console.log('[db] Connected to Supabase:', process.env.SUPABASE_URL);

} else {
  // ── Path 3: No credentials at all — stub that returns empty data ───────────
  console.warn('[db] No DATABASE_URL or SUPABASE_URL configured — using in-memory stub. Set DATABASE_URL for persistent storage.');
  const noopBuilder = () => {
    const b = {
      select: () => b, insert: () => b, update: () => b, delete: () => b,
      upsert: () => b, eq: () => b, neq: () => b, in: () => b, gte: () => b,
      lte: () => b, gt: () => b, lt: () => b, is: () => b, or: () => b,
      like: () => b, limit: () => b, order: () => b, single: () => b,
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return b;
  };
  supabase = {
    from: () => noopBuilder(),
    storage: { from: () => ({ getPublicUrl: () => ({ publicURL: '' }) }) },
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: { createUser: async () => ({}) } },
    rpc: async () => ({ data: null, error: null }),
  };
  replica = supabase;
}

module.exports = { supabase, replica };
