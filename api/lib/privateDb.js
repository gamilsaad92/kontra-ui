/**
 * privateDb.js — Direct PostgreSQL connection for private schema calls.
 *
 * The private schema is NOT exposed via PostgREST (Supabase REST API).
 * All private.* functions must be called through this direct connection
 * using the database URL (not the Supabase service role REST client).
 *
 * Required env var: SUPABASE_DB_URL
 *   Supabase Dashboard → Project Settings → Database
 *   → Connection string → Transaction mode (port 6543)
 *   Format: postgresql://postgres.PROJECT_REF:PASSWORD@HOST:6543/postgres
 *
 * This module is used exclusively by the dealRoomSecurityV2 router.
 * Never import this from browser-accessible code.
 */

const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL is not set. ' +
      'Add it in Render environment settings (Supabase → Project Settings → Database → ' +
      'Connection string → Transaction mode). ' +
      'Participant security v2 endpoints will not function without it.'
    );
  }

  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _pool.on('error', (err) => {
    console.error('[privateDb] Pool error:', err.message);
  });

  return _pool;
}

/**
 * Call a private schema function and return the result.
 * All private functions return jsonb.
 *
 * @param {string} fnName  — function name (without schema prefix)
 * @param {any[]}  args    — positional arguments matching the function signature
 * @returns {Promise<any>} — parsed JSON result
 */
async function callPrivate(fnName, args = []) {
  const pool = getPool();
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT private.${fnName}(${placeholders}) AS result`;

  const { rows } = await pool.query(sql, args);
  return rows[0]?.result ?? null;
}

/**
 * Run an arbitrary query in a transaction via direct pg connection.
 * The callback receives a pg client; it must NOT commit or rollback —
 * the wrapper handles that.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTransaction(fn) {
  const pool   = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { callPrivate, withTransaction };
