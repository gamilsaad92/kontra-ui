/**
 * localAuth.js — Self-contained JWT auth for Kontra API.
 *
 * Strategy (in order):
 * 1. Demo users map — hardcoded, zero DB dependency (always works for pitch)
 * 2. PostgreSQL users table — for real production users (APP_DATABASE_URL / DATABASE_URL)
 *
 * Access tokens:  15 min (short-lived, verified on every request)
 * Refresh tokens: stored in DB if available; in-memory UUID fallback otherwise
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

if (!JWT_SECRET) {
  console.warn('[localAuth] JWT_SECRET is not set — auth will fail.');
}

// ── Demo users (hardcoded, pitch-safe) ───────────────────────────────────────
// bcrypt hash of '12345678' with cost 12
const DEMO_HASH = '$2b$12$YWreYFhsaLO1Kfa6sAe7T.RFz2Tfx97mWPgRBsqfMy5KWPRgLZaq6';
const ORG_ID = 'a0000000-0000-0000-0000-000000000001';

// User IDs aligned with Supabase `users` table — foreign keys in investor_holdings,
// distributions, and loans.data.borrower_user_id all reference these exact UUIDs.
const DEMO_USERS = {
  'replit@kontraplatform.com': {
    id: '3c8e1ffe-03d7-4b4e-80b3-3ed2555357e2',
    email: 'replit@kontraplatform.com',
    password_hash: DEMO_HASH,
    first_name: 'Alex',
    last_name: 'Lender',
    role: 'lender_admin',
    portal: 'lender',
    org_id: ORG_ID,
  },
  'servicer@kontraplatform.com': {
    id: '45a3a49f-c24a-421c-b22a-dc5ca6bc8673',
    email: 'servicer@kontraplatform.com',
    password_hash: DEMO_HASH,
    first_name: 'Sam',
    last_name: 'Servicer',
    role: 'servicer',
    portal: 'servicer',
    org_id: ORG_ID,
  },
  'investor@kontraplatform.com': {
    id: '9bde42ed-0b2d-4475-ba37-777933e4629b',
    email: 'investor@kontraplatform.com',
    password_hash: DEMO_HASH,
    first_name: 'Ivy',
    last_name: 'Investor',
    role: 'investor',
    portal: 'investor',
    org_id: ORG_ID,
  },
  'borrower@kontraplatform.com': {
    id: 'e7bd29bd-6266-4cb9-8de0-2a0657710359',
    email: 'borrower@kontraplatform.com',
    password_hash: DEMO_HASH,
    first_name: 'Ben',
    last_name: 'Borrower',
    role: 'borrower',
    portal: 'borrower',
    org_id: ORG_ID,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function makeRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// ── Token signing/verification ────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      portal: user.portal,
      org_id: user.org_id || null,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL, algorithm: 'HS256' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// ── Password helpers ──────────────────────────────────────────────────────────

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ── User lookup ───────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
  // 1. Check demo map first (zero DB dependency)
  const key = (email || '').toLowerCase();
  if (DEMO_USERS[key]) return DEMO_USERS[key];

  // 2. Fallback: real DB lookup
  try {
    const { getPool } = require('./pgAdapter');
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, portal, org_id, first_name, last_name
         FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  } catch (err) {
    console.warn('[localAuth] DB lookup failed, no matching demo user either:', err.message);
    return null;
  }
}

async function findUserById(id) {
  // Check demo map
  const demo = Object.values(DEMO_USERS).find(u => u.id === id);
  if (demo) return demo;

  // DB fallback
  try {
    const { getPool } = require('./pgAdapter');
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, email, role, portal, org_id, first_name, last_name
         FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.warn('[localAuth] findUserById DB error:', err.message);
    return null;
  }
}

// ── Refresh token management ──────────────────────────────────────────────────

async function createRefreshToken(userId) {
  const raw = makeRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

  try {
    const { getPool } = require('./pgAdapter');
    const pool = getPool();
    const hash = hashToken(raw);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, hash, expiresAt]
    );
  } catch (_) {
    // Non-fatal — access tokens still work; refresh won't be storable
  }

  return { raw, expiresAt };
}

async function consumeRefreshToken(rawToken) {
  try {
    const { getPool } = require('./pgAdapter');
    const pool = getPool();
    const hash = hashToken(rawToken);
    const { rows } = await pool.query(
      `UPDATE refresh_tokens
          SET revoked_at = now()
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        RETURNING user_id, expires_at`,
      [hash]
    );
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

async function revokeAllUserTokens(userId) {
  try {
    const { getPool } = require('./pgAdapter');
    const pool = getPool();
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  } catch (_) { /* non-fatal */ }
}

// ── Full session builder ──────────────────────────────────────────────────────

async function buildSession(user) {
  const access_token = signAccessToken(user);
  const { raw: refresh_token, expiresAt } = await createRefreshToken(user.id);
  const now = Math.floor(Date.now() / 1000);

  return {
    access_token,
    refresh_token,
    expires_at: now + ACCESS_TTL,
    expires_in: ACCESS_TTL,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      portal: user.portal,
      org_id: user.org_id,
      first_name: user.first_name,
      last_name: user.last_name,
    },
  };
}

// ── Sign in ───────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const user = await findUserByEmail(email);
  if (!user) throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });

  return buildSession(user);
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refreshSession(rawRefreshToken) {
  const record = await consumeRefreshToken(rawRefreshToken);
  if (!record) throw Object.assign(new Error('Refresh token invalid or expired'), { code: 'REFRESH_INVALID' });

  const user = await findUserById(record.user_id);
  if (!user) throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });

  return buildSession(user);
}

module.exports = {
  signIn,
  refreshSession,
  verifyAccessToken,
  revokeAllUserTokens,
  hashPassword,
  findUserByEmail,
  findUserById,
  buildSession,
};
