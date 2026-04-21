/**
 * authenticate.js — Request authentication middleware for Kontra API.
 *
 * Verification priority:
 *   1. Local JWT (signed by JWT_SECRET via localAuth) — always attempted first
 *   2. Supabase token validation — fallback if JWT_SECRET not set or token isn't ours
 *   3. DEV_ACCESS_TOKEN — development bypass (non-production only)
 *
 * Sets on req: user, role, portal, orgId, organizationId, tenant_id
 */

const localAuth = require('../lib/localAuth');

const isProduction = process.env.NODE_ENV === 'production';
const devAccessToken = isProduction ? null : (process.env.DEV_ACCESS_TOKEN?.trim() || null);
const devUserId = process.env.DEV_USER_ID?.trim() || 'dev-user';
const devOrgId = process.env.DEV_ORG_ID?.trim() || 'a0000000-0000-0000-0000-000000000001';
const devRole = process.env.DEV_USER_ROLE?.trim() || 'lender_admin';

// Lazy-load Supabase only when needed (and only if real credentials exist)
const isRealSupabase =
  Boolean(process.env.SUPABASE_URL) &&
  !process.env.SUPABASE_URL.includes('placeholder') &&
  process.env.SUPABASE_URL.startsWith('https://') &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

let _supabase = null;
function getSupabase() {
  if (!isRealSupabase) return null;
  if (!_supabase) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch (e) {
      console.warn('[Auth] Could not load Supabase client:', e.message);
    }
  }
  return _supabase;
}

function getAccessToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  // Cookie fallback
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(p => {
      const [k, ...v] = p.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  return cookies['sb-access-token'] || cookies['access_token'] || null;
}

function portalFromRole(role) {
  if (['platform_admin', 'lender_admin', 'asset_manager'].includes(role)) return 'lender';
  if (role === 'servicer') return 'servicer';
  if (role === 'investor') return 'investor';
  if (role === 'borrower') return 'borrower';
  return 'lender';
}

function applyUser(req, { id, email, role, portal, org_id }) {
  req.user = { id, email, supabaseUserId: id };
  req.role = role || 'member';
  req.appRole = req.role;
  req.portal = portal || portalFromRole(req.role);
  req.orgId = org_id || null;
  req.organizationId = req.orgId;
  req.tenant_id = req.orgId;
}

module.exports = async function authenticate(req, res, next) {
  // Reset
  req.user = null;
  req.role = 'member';
  req.appRole = 'member';
  req.portal = 'lender';
  req.orgId = null;
  req.organizationId = null;
  req.tenant_id = null;

  const token = getAccessToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing access token' });
  }

  // ── 1. Dev bypass token ───────────────────────────────────────────────────
  if (devAccessToken && token === devAccessToken) {
    const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'] || devOrgId;
    applyUser(req, {
      id: devUserId,
      email: 'dev@local.test',
      role: devRole,
      portal: portalFromRole(devRole),
      org_id: Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId,
    });
    return next();
  }

  // ── 2. Local JWT verification (primary path) ──────────────────────────────
  try {
    const payload = localAuth.verifyAccessToken(token);
    // Allow X-Org-Id header to override the token's org (multi-org users)
    const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'] || null;
    const orgId = (Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId) || payload.org_id;
    applyUser(req, {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      portal: payload.portal,
      org_id: orgId,
    });
    return next();
  } catch (jwtErr) {
    // Token is not a local JWT — try Supabase fallback
    if (jwtErr.name !== 'JsonWebTokenError' && jwtErr.name !== 'TokenExpiredError' && jwtErr.name !== 'NotBeforeError') {
      console.warn('[Auth] Unexpected JWT error:', jwtErr.message);
    }
  }

  // ── 3. Supabase token fallback ────────────────────────────────────────────
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
      if (error || !authUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
      const jwtClaims = authUser.app_metadata ?? authUser.user_metadata ?? {};
      const role = jwtClaims.app_role || jwtClaims.role || 'member';
      const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
      const orgId = (Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId)
        || jwtClaims.org_id
        || authUser.app_metadata?.organization_id
        || authUser.user_metadata?.organization_id
        || null;
      applyUser(req, { id: authUser.id, email: authUser.email, role, portal: jwtClaims.portal, org_id: orgId });
      return next();
    } catch (err) {
      console.error('[Auth] Supabase validation error:', err.message);
      return res.status(401).json({ error: 'Unauthorized: Token validation failed' });
    }
  }

  // ── 4. No valid auth method available ────────────────────────────────────
  return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
};
