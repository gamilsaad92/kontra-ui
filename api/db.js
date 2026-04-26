/**
 * db.js — Database client for Kontra API
 *
 * Priority:
 *   1. If SUPABASE_URL is a real configured URL → use Supabase JS client
 *      (Supabase holds all seeded production data: loans, investors, etc.)
 *   2. If DATABASE_URL is set → use local PostgreSQL via pgAdapter
 *      (used in Replit local dev environment)
 *   3. Fallback → noop stub (returns empty data gracefully)
 */

// Supabase keys may be new-style (sb_publishable / sb_secret, ~40 chars)
// or old-style JWTs (200+ chars). Only exclude obvious placeholders.
const sbKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const isRealSupabase =
  process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes('placeholder') &&
  process.env.SUPABASE_URL.startsWith('https://') &&
  sbKey.length > 10 &&
  !sbKey.toLowerCase().includes('placeholder') &&
  !sbKey.toLowerCase().includes('your-key');

const hasLocalDb = !!process.env.DATABASE_URL && !isRealSupabase;

let supabase, replica;

if (isRealSupabase) {
  // ── Path 1: Real Supabase project (production data lives here) ─────────────
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  replica = process.env.SUPABASE_REPLICA_URL
    ? createClient(process.env.SUPABASE_REPLICA_URL, sbKey)
    : supabase;
  console.log('[db] Connected to Supabase:', process.env.SUPABASE_URL, '| key_len:', sbKey.length);

} else if (hasLocalDb) {
  // ── Path 2: Local PostgreSQL (Replit dev environment) ─────────────────────
  const { createPgClient } = require('./lib/pgAdapter');
  supabase = createPgClient();
  replica = supabase;
  console.log('[db] Connected to local PostgreSQL via pgAdapter');

} else {
  // ── Path 3: No credentials — noop stub ─────────────────────────────────────
  console.warn('[db] No Supabase or DATABASE_URL configured — using in-memory stub.');
  const noopBuilder = () => {
    const b = {
      select: () => b, insert: () => b, update: () => b, delete: () => b,
      upsert: () => b, eq: () => b, neq: () => b, in: () => b, gte: () => b,
      lte: () => b, gt: () => b, lt: () => b, is: () => b, or: () => b,
      ilike: () => b, like: () => b, limit: () => b, order: () => b,
      single: () => b, contains: () => b, textSearch: () => b,
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
