const { createClient } = require('@supabase/supabase-js');
const { queryOne } = require('../src/lib/appDb');

const hasSupabaseCredentials =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabaseCredentials
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const isProduction = process.env.NODE_ENV === 'production';
const devAccessToken = isProduction ? null : (process.env.DEV_ACCESS_TOKEN?.trim() || null);
const devUserId = process.env.DEV_USER_ID?.trim() || 'dev-user';
const devOrgId = process.env.DEV_ORG_ID?.trim() || null;
const devRole = process.env.DEV_USER_ROLE?.trim() || 'admin';


const authDebugEnabled = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.AUTH_DEBUG || '').trim().toLowerCase()
);

function authDebug(...args) {
  if (authDebugEnabled) {
    console.debug(...args);
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
}

function parseCookieHeader(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getAccessToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.split(' ')[1];
  }

  const cookies = parseCookieHeader(req.headers.cookie || '');
  return cookies['sb-access-token'] || cookies['access_token'] || null;
}

/**
 * Resolve the user's active organization using three sources in priority order:
 *  1. X-Org-Id header (explicit client selection)
 *  2. Local PostgreSQL org_memberships (fast, co-located with API)
 *  3. Supabase org_memberships table (source of truth, always available on Render)
 *  4. JWT app_metadata / user_metadata organization_id (set by signup trigger)
 */
async function resolveOrgId(req, authUser, localMembership) {
  const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
  const normalizedHeader = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;

  // Priority 1: explicit header
  if (normalizedHeader) return String(normalizedHeader);

  // Priority 2: local PostgreSQL
  if (localMembership?.org_id) return String(localMembership.org_id);

  // Priority 3: Supabase org_memberships table
  if (supabase) {
    try {
      const { data: supabaseMember } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1)
        .single();
      if (supabaseMember?.org_id) {
       authDebug('[Auth] org resolved from Supabase org_memberships', supabaseMember.org_id);
        return String(supabaseMember.org_id);
      }
    } catch (err) {
       authDebug('[Auth] org resolved from Supabase org_memberships', supabaseMember.org_id);
    }
  }

  // Priority 4: JWT metadata (set by signup bootstrap trigger)
  const metaOrgId =
    authUser.app_metadata?.organization_id ||
    authUser.user_metadata?.organization_id ||
    null;
  if (metaOrgId) {
     authDebug('[Auth] org resolved from JWT app_metadata', metaOrgId);
    return String(metaOrgId);
  }

  return null;
}

module.exports = async function requireAuth(req, res, next) {
  req.user = null;
  req.orgId = null;
  req.organizationId = null;
  req.tenant_id = null;
  req.role = 'member';

  try {
    const token = getAccessToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing access token' });
    }

    if (devAccessToken && token === devAccessToken) {
      const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
      const normalizedOrgId = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
      const fallbackOrgId = devOrgId || normalizedOrgId || '1';

      req.user = {
        id: devUserId,
        email: 'dev@local.test',
        supabaseUserId: devUserId,
        user_metadata: { organization_id: fallbackOrgId },
      };
      req.role = devRole;
      req.orgId = fallbackOrgId;
      req.organizationId = fallbackOrgId;
      req.tenant_id = fallbackOrgId;
      return next();
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Authentication unavailable' });
    }

    const tokenPayload = decodeJwtPayload(token);
    if (tokenPayload) {
      const issuer = typeof tokenPayload.iss === 'string' ? tokenPayload.iss : null;
      const audience = tokenPayload.aud ?? null;
     authDebug('[Auth] token payload decoded', { issuer, audience });
    }

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Try local PostgreSQL first (may throw APP_DB_URL_MISSING if not configured)
    let localMembership = null;
    try {
      localMembership = await queryOne(
        `SELECT om.role, o.id AS org_id
           FROM users u
           LEFT JOIN org_memberships om ON om.user_id = u.id
           LEFT JOIN organizations o ON o.id = om.org_id
          WHERE u.supabase_user_id = $1
          ORDER BY om.created_at ASC`,
        [authUser.id]
      );
    } catch (dbErr) {
      // Local DB not available — fall through to Supabase fallback
      if (dbErr?.code !== 'APP_DB_URL_MISSING') {
      authDebug('[Auth] local DB lookup failed, falling back to Supabase', dbErr?.message);
      }
    }

    const orgId = await resolveOrgId(req, authUser, localMembership);

    req.user = {
      ...authUser,
      supabaseUserId: authUser.id,
      email: authUser.email || null,
    };

    // ── Role resolution: JWT custom claims (from auth hook) take priority ──
    // The Supabase custom_access_token_hook injects app_role, org_id, and portal
    // into app_metadata. Use these first so RLS policies and the API both agree.
    const jwtClaims     = tokenPayload?.app_metadata ?? tokenPayload?.user_metadata ?? {};
    const jwtAppRole    = jwtClaims.app_role   ?? null;
    const jwtOrgId      = jwtClaims.org_id     ?? null;
    const jwtPortal     = jwtClaims.portal      ?? null;

    const resolvedRole  = jwtAppRole || localMembership?.role || 'member';
    const resolvedOrgId = orgId ?? jwtOrgId ?? null;
    const resolvedPortal = jwtPortal ?? (() => {
      if (['platform_admin','lender_admin','servicer','asset_manager'].includes(resolvedRole)) return 'lender';
      if (resolvedRole === 'investor') return 'investor';
      if (resolvedRole === 'borrower') return 'borrower';
      return 'lender';
    })();

    req.role           = resolvedRole;
    req.appRole        = resolvedRole;
    req.portal         = resolvedPortal;
    req.orgId          = resolvedOrgId;
    req.organizationId = resolvedOrgId;
    req.tenant_id      = resolvedOrgId;

    return next();
  } catch (error) {
    // APP_DB_URL_MISSING / bad credentials bubble here only in unexpected paths;
    // fall through rather than surfacing a 503 that blocks the user entirely.
    if (error?.code === 'APP_DB_URL_MISSING') {
      console.warn('[Auth] local DB unavailable in outer handler — continuing Supabase-only');
      req.orgId = null;
      req.organizationId = null;
      req.tenant_id = null;
      return next();
    }

    console.error('[Auth] requireAuth failed', error);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
};
