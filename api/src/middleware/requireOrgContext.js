const { createClient } = require('@supabase/supabase-js');
const { queryOne } = require('../lib/appDb');

const hasSupabaseCredentials =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabaseCredentials
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function getOrgHeader(req) {
  return req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id') || null;
}

async function userHasOrgMembership(userId, organizationId) {
  if (!userId || !organizationId) return false;

  try {
    const row = await queryOne(
      `select org_id
         from org_memberships
        where user_id = $1
          and org_id::text = $2
          and coalesce(status, 'active') = 'active'
          and deleted_at is null
        limit 1`,
      [userId, organizationId],
    );
    if (row?.org_id) {
      return true;
    }
  } catch (error) {
    if (error?.code !== 'APP_DB_URL_MISSING') {
      console.debug('[OrgContext] local membership lookup failed', error?.message);
    }
  }

  if (!supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', organizationId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.debug('[OrgContext] Supabase membership lookup failed', error.message);
      return false;
    }

    return Boolean(data?.org_id);
  } catch (error) {
    console.debug('[OrgContext] Supabase membership lookup threw', error?.message || error);
    return false;
  }
}

async function requireOrgContext(req, res, next) {
  const path = (req.originalUrl || '').split('?')[0];

  if (path === '/api/health' || path.startsWith('/api/dev/')) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  const headerOrgId = getOrgHeader(req);
  if (!headerOrgId) {
    return res.status(400).json({
            error: 'Missing X-Org-Id header',
      code: 'ORG_CONTEXT_MISSING',
    });
  }

   const organizationId = String(headerOrgId);
  const hasMembership = await userHasOrgMembership(req.user.supabaseUserId || req.user.id, organizationId);
  if (!hasMembership) {
    return res.status(403).json({
      error: 'Organization access denied',
      code: 'ORG_FORBIDDEN',
      organizationId,
    });
  }

  req.orgId = organizationId;
  req.organizationId = organizationId;
  req.tenant_id = organizationId;
  return next();
}

module.exports = { requireOrgContext };
