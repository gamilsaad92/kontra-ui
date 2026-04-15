const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { queryOne, queryRows } = require('../lib/appDb');

const router = express.Router();

const hasSupabaseCredentials =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseAdmin = hasSupabaseCredentials
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  if (typeof h !== 'string') return null;
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

async function verifyAccessToken(bearerToken) {
  if (!supabaseAdmin) {
    throw Object.assign(new Error('Supabase admin client not configured'), { code: 'SUPABASE_ADMIN_MISSING' });
  }
  if (!bearerToken) {
    throw Object.assign(new Error('Missing access token'), { code: 'TOKEN_MISSING' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
  if (error || !data?.user) {
    const e = new Error(error?.message || 'Invalid token');
    e.code = 'TOKEN_INVALID';
    throw e;
  }

  return data.user;
}

async function upsertLocalUser(user) {
  return queryOne(
    `INSERT INTO users (supabase_user_id, email)
     VALUES ($1::uuid, COALESCE($2, 'unknown@example.com'))
     ON CONFLICT (supabase_user_id)
     DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
     RETURNING id, supabase_user_id, email`,
    [user.id, user.email || null]
  );
}

async function queryMemberships(localUserId) {
  try {
    return await queryRows(
      `SELECT o.id, o.name, m.role,
              (u.default_org_id IS NOT NULL AND o.id = u.default_org_id) AS is_default
         FROM users u
         JOIN org_memberships m ON m.user_id = u.id
         JOIN organizations o ON o.id = m.org_id
        WHERE u.id = $1::uuid
        ORDER BY (u.default_org_id IS NOT NULL AND o.id = u.default_org_id) DESC,
                 o.created_at ASC`,
      [localUserId]
    );
  } catch (error) {
    if (error?.code !== '42703') {
      throw error;
    }

    return queryRows(
      `SELECT o.id, o.name, m.role, FALSE AS is_default
         FROM org_memberships m
         JOIN organizations o ON o.id = m.org_id
        WHERE m.user_id = $1::uuid
        ORDER BY o.created_at ASC`,
      [localUserId]
    );
  }
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(Object.assign(new Error('Request timed out'), { code: 'TIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Auth not configured on server' });
  }
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
    });
  } catch (err) {
    console.error('[Auth] signin error:', err);
    return res.status(500).json({ error: 'Sign in failed' });
  }
});

// POST /api/auth/refresh  ← ADDED: was missing, authContext.jsx needs this
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Auth not configured on server' });
  }
  try {
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
    if (error || !data?.session) {
      console.warn('[Auth] refresh failed:', error?.message);
      return res.status(401).json({ error: error?.message || 'Refresh failed' });
    }
    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
    });
  } catch (err) {
    console.error('[Auth] refresh error:', err);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/signout
router.post('/signout', async (req, res) => {
  const token = getBearerToken(req);
  if (supabaseAdmin && token) {
    try {
      await supabaseAdmin.auth.admin.signOut(token);
    } catch (_) {}
  }
  return res.status(200).json({ success: true });
});

// POST /api/auth/bootstrap
// Bootstraps the user's local DB record and org memberships.
// Gracefully falls back to Supabase-only when local DB is unavailable (e.g. Render).
router.post('/bootstrap', async (req, res) => {
  try {
    const response = await withTimeout((async () => {
      const token = getBearerToken(req);
      const user = await withTimeout(verifyAccessToken(token), 8000);
      const requestedOrgId = req.body?.org_id ? String(req.body.org_id) : null;

      // Try local DB — gracefully degrade if unavailable
      let localUser = null;
      let orgs = [];
      try {
        localUser = await withTimeout(upsertLocalUser(user), 8000);
        orgs = localUser ? await withTimeout(queryMemberships(localUser.id), 8000) : [];
      } catch (dbErr) {
        // Local DB not available (APP_DB_URL_MISSING or connection error) — skip local lookups
        if (dbErr?.code !== 'APP_DB_URL_MISSING') {
          console.debug('[AuthBootstrap] local DB unavailable, skipping', dbErr?.message);
        }
        orgs = [];
      }

      const normalizedOrgs = Array.isArray(orgs) ? orgs.map((org) => ({
        id: String(org.id),
        name: org.name,
        role: org.role,
      })) : [];

      const defaultOrg = Array.isArray(orgs) ? orgs.find((org) => Boolean(org.is_default)) : null;

      let activeOrgId = null;
      if (requestedOrgId && normalizedOrgs.some((org) => String(org.id) === requestedOrgId)) {
        activeOrgId = requestedOrgId;
      } else if (defaultOrg?.id) {
        activeOrgId = String(defaultOrg.id);
      } else if (normalizedOrgs.length > 0) {
        activeOrgId = String(normalizedOrgs[0].id);
      }

      return {
        user: { id: user.id, email: user.email || null },
        orgs: normalizedOrgs,
        active_org_id: activeOrgId,
        default_org_id: defaultOrg?.id ? String(defaultOrg.id) : (normalizedOrgs[0]?.id || null),
      };
    })(), 20000);

    return res.status(200).json(response);
  } catch (error) {
    if (error?.code === 'TIMEOUT') {
      return res.status(504).json({ message: error.message, code: error.code });
    }
    if (error?.code === 'TOKEN_MISSING' || error?.code === 'TOKEN_INVALID' || error?.code === 'SUPABASE_ADMIN_MISSING') {
      const statusCode = error.code === 'SUPABASE_ADMIN_MISSING' ? 503 : 401;
      return res.status(statusCode).json({ message: error.message || 'Unauthorized', code: error.code || 'UNAUTHORIZED' });
    }

    console.error('[AuthBootstrap] Failed to bootstrap user', error);
    return res.status(500).json({ code: 'BOOTSTRAP_FAILED', message: 'Unable to bootstrap account' });
  }
});

module.exports = router;
