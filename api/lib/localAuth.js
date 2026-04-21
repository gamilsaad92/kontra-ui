/**
 * localAuth.js — Self-contained JWT auth for Kontra API.
 *
 * No Supabase dependency. Signs and verifies JWTs using JWT_SECRET,
 * stores refresh tokens (hashed) in the PostgreSQL refresh_tokens table.
 *
 * Access tokens:  15 min  (short-lived, verified on every request)
 * Refresh tokens: 30 days (hashed in DB, single-use rotation)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('./pgAdapter');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = 15 * 60;           // 15 minutes in seconds
const REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

if (!JWT_SECRET) {
  console.warn('[localAuth] JWT_SECRET is not set — auth will fail. Set JWT_SECRET in environment.');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function makeRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// ── Token signing/verification ────────────────────────────────────────────────

/**
 * Issue a short-lived access token.
 * Claims: sub, email, role, portal, org_id, iat, exp
 */
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

/**
 * Verify an access token. Returns decoded payload or throws.
 */
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
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, role, portal, org_id, first_name, last_name
       FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, role, portal, org_id, first_name, last_name
       FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// ── Refresh token management ──────────────────────────────────────────────────

async function createRefreshToken(userId) {
  const raw = makeRefreshToken();
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
  const pool = getPool();
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
  return { raw, expiresAt };
}

async function consumeRefreshToken(rawToken) {
  const hash = hashToken(rawToken);
  const pool = getPool();
  // Atomically find and revoke the token in one query
  const { rows } = await pool.query(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING user_id, expires_at`,
    [hash]
  );
  return rows[0] || null; // null = invalid/expired/already used
}

async function revokeAllUserTokens(userId) {
  const pool = getPool();
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

// ── Full session builder ──────────────────────────────────────────────────────

/**
 * Build a complete session object from a user row.
 * Returns { access_token, refresh_token, expires_at, expires_in, token_type, user }
 */
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
