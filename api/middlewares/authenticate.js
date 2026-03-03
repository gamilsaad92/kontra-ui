const { createClient } = require('@supabase/supabase-js');
const { queryOne } = require('../src/lib/appDb');

const hasSupabaseCredentials =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabaseCredentials
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const devAccessToken = process.env.DEV_ACCESS_TOKEN?.trim() || null;
const devUserId = process.env.DEV_USER_ID?.trim() || 'dev-user';
const devOrgId = process.env.DEV_ORG_ID?.trim() || null;
const devRole = process.env.DEV_USER_ROLE?.trim() || 'admin';

const expectedIssuer = process.env.SUPABASE_JWT_ISSUER?.trim() || null;
const expectedAudience = process.env.SUPABASE_JWT_AUDIENCE?.trim() || 'authenticated';

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
}

function isSupabaseTokenPayloadValid(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const issuer = typeof payload.iss === 'string' ? payload.iss : null;
  const audience = payload.aud;

  if (expectedIssuer && issuer !== expectedIssuer) {
    return false;
  }

  if (!expectedAudience) {
    return true;
  }

  if (typeof audience === 'string') {
    return audience === expectedAudience;
  }

  if (Array.isArray(audience)) {
    return audience.includes(expectedAudience);
  }

  return false;
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

module.exports = async function requireAuth(req, res, next) {
  req.user = null;
  req.orgId = null;
  req.organizationId = null;
 req.tenant_id = null;
  req.role = 'member';

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
  if (!isSupabaseTokenPayloadValid(tokenPayload)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token issuer or audience' });
  }

  const {
   data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token);

 if (error || !authUser) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  const localMembership = await queryOne(
    `SELECT om.role, o.id AS org_id
       FROM users u
       LEFT JOIN org_memberships om ON om.user_id = u.id
       LEFT JOIN organizations o ON o.id = om.org_id
      WHERE u.supabase_user_id = $1
      ORDER BY om.created_at ASC`,
    [authUser.id]
  );

  const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
  const normalizedOrgId = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;

  req.user = {
    ...authUser,
    supabaseUserId: authUser.id,
    email: authUser.email || null,
  };
  req.role = localMembership?.role || 'member';
  req.orgId = normalizedOrgId || localMembership?.org_id || null;
  req.organizationId = req.orgId;
   req.tenant_id = req.orgId;

  next();
};
