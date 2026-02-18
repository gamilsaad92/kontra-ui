const { createClient } = require('@supabase/supabase-js');

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


module.exports = async function authenticate(req, res, next) {
    req.user = null;
  req.orgId = null;
  req.organizationId = null;
   req.tenant_id = null;
  req.role = 'member';
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
   return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = auth.split(' ')[1];

  if (devAccessToken && token === devAccessToken) {
     const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
      const normalizedOrgId = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
    const fallbackOrgId = devOrgId || normalizedOrgId || '1';

    req.user = {
      id: devUserId,
      user_metadata: {
        organization_id: fallbackOrgId,
      },
    };
       req.orgId = fallbackOrgId;
    req.organizationId = fallbackOrgId;
        req.tenant_id = fallbackOrgId;
    req.role = devRole;
    return next();
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Authentication unavailable' });
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
   return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  req.user = user;
  const headerOrgId = req.headers['x-organization-id'] || req.headers['x-org-id'];
  const normalizedOrgId = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
  req.orgId = user.user_metadata?.organization_id || normalizedOrgId || null;
  req.organizationId = req.orgId;
 req.tenant_id = req.orgId;
  try {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    req.role = member?.role || 'member';
  } catch (err) {
    console.error('Role fetch failed:', err);
    req.role = 'member';
  }

  next();
};
