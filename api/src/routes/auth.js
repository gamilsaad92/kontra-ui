/**
 * auth.js — Authentication routes for Kontra API.
 *
 * Uses localAuth (JWT + bcrypt + PostgreSQL) as primary.
 * Supabase is used only if SUPABASE_URL is a real configured URL.
 */

const express = require('express');
const localAuth = require('../../lib/localAuth');

const router = express.Router();

// Check if real Supabase is configured (not a placeholder)
const isRealSupabase =
  Boolean(process.env.SUPABASE_URL) &&
  !process.env.SUPABASE_URL.includes('placeholder') &&
  process.env.SUPABASE_URL.startsWith('https://') &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Lazy-load Supabase only if needed
let supabaseAdmin = null;
if (isRealSupabase) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  } catch (e) {
    console.warn('[auth] Could not load Supabase client:', e.message);
  }
}

// ── POST /api/auth/signin ─────────────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Primary: local PostgreSQL auth
  let localSession = null;
  let localErr = null;
  try {
    localSession = await localAuth.signIn(email, password);
  } catch (err) {
    localErr = err;
  }

  if (localSession) {
    return res.status(200).json(localSession);
  }

  // Supabase fallback — used when local DB is unavailable or user doesn't exist locally
  if (supabaseAdmin && localErr?.code !== 'INVALID_CREDENTIALS') {
    // DB-level error (connection issue, missing table, etc.) — try Supabase
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        return res.status(200).json({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type || 'bearer',
          user: { id: data.user.id, email: data.user.email },
        });
      }
    } catch (_) {}
  } else if (supabaseAdmin && localErr?.code === 'INVALID_CREDENTIALS') {
    // User not found locally — try Supabase as well
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        return res.status(200).json({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type || 'bearer',
          user: { id: data.user.id, email: data.user.email },
        });
      }
    } catch (_) {}
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (localErr) {
    console.error('[auth] signin error:', localErr.message);
  }
  return res.status(401).json({ error: 'Invalid email or password' });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const session = await localAuth.refreshSession(refresh_token);
    return res.status(200).json(session);
  } catch (err) {
    // Fallback: try Supabase refresh if configured
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
        if (!error && data?.session) {
          return res.status(200).json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type || 'bearer',
            user: { id: data.user.id, email: data.user.email },
          });
        }
      } catch (_) {}
    }

    const status = err.code === 'REFRESH_INVALID' ? 401 : 500;
    return res.status(status).json({ error: err.message || 'Token refresh failed' });
  }
});

// ── POST /api/auth/signout ────────────────────────────────────────────────────
router.post('/signout', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  // Revoke local refresh tokens for this user (best-effort)
  if (token) {
    try {
      const payload = localAuth.verifyAccessToken(token);
      if (payload?.sub) {
        await localAuth.revokeAllUserTokens(payload.sub);
      }
    } catch (_) {}
  }

  // Also sign out of Supabase if configured
  if (supabaseAdmin && token) {
    try { await supabaseAdmin.auth.admin.signOut(token); } catch (_) {}
  }

  return res.status(200).json({ success: true });
});

// ── POST /api/auth/bootstrap ──────────────────────────────────────────────────
// Returns user profile + orgs after sign-in. Called by the UI auth context.
router.post('/bootstrap', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Missing access token' });

  try {
    // Verify local JWT first
    let userId, userEmail;
    try {
      const payload = localAuth.verifyAccessToken(token);
      userId = payload.sub;
      userEmail = payload.email;
    } catch (_) {
      // If it's a Supabase token, try that
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
        userId = data.user.id;
        userEmail = data.user.email;
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const { getPool } = require('../../lib/pgAdapter');
    const pool = getPool();

    // Get user's org memberships
    const { rows: orgs } = await pool.query(
      `SELECT o.id, o.name, om.role
         FROM users u
         JOIN org_memberships om ON om.user_id = u.id
         JOIN organizations o ON o.id = om.org_id
        WHERE u.id = $1 OR u.email = $2
        ORDER BY o.created_at ASC`,
      [userId, userEmail]
    );

    const normalizedOrgs = orgs.map(o => ({ id: String(o.id), name: o.name, role: o.role }));
    const activeOrgId = normalizedOrgs[0]?.id || null;

    return res.status(200).json({
      user: { id: userId, email: userEmail },
      orgs: normalizedOrgs,
      active_org_id: activeOrgId,
      default_org_id: activeOrgId,
    });
  } catch (err) {
    console.error('[auth] bootstrap error:', err.message);
    return res.status(500).json({ error: 'Bootstrap failed' });
  }
});

module.exports = router;
