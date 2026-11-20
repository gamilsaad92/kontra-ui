const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const authenticate = require('../../middlewares/authenticate');
const { supabase: supabaseAdmin } = require('../../db');
const { resolveCanonicalIdentity } = require('../../middlewares/resolveCanonicalIdentity');
const supabase = supabaseAdmin;

/**
 * Query org memberships directly from the database.
 * Used as a fallback when the local PostgreSQL isn't available or has no records.
 */
async function getOrgsFromSupabase(supabaseUserId) {
  if (!supabase) throw new Error('Supabase is unavailable');
  const { data, error } = await supabase
      .from('org_memberships')
      .select('org_id, role, id, created_at, organizations!inner(id, name, status, created_at)')
      .eq('user_id', supabaseUserId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .eq('organizations.status', 'active')
      .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => ({
      id: String(m.org_id),
      name: m.organizations?.name || 'Organization',
      role: m.role || 'member',
      membership_id: String(m.id),
      created_at: m.organizations?.created_at || m.created_at,
      membership_created_at: m.created_at,
    }));
}

const router = express.Router();
router.use(authenticate);
router.use(async (req, res, next) => {
  try {
    const identity = await resolveCanonicalIdentity(req, supabase);
    if (identity.error) return res.status(503).json({ code: 'IDENTITY_LOOKUP_UNAVAILABLE' });
    if (!identity.userId) return res.status(403).json({ code: 'IDENTITY_LINK_REQUIRED' });
    return next();
  } catch (error) {
    console.error('[OrgDiscovery] identity resolution failed', error.message);
    return res.status(503).json({ code: 'IDENTITY_LOOKUP_UNAVAILABLE' });
  }
});

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const selectOrgSchema = z.object({
  org_id: z.string().uuid(),
});

function getCorrelationId(req) {
  const headerValue = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  if (Array.isArray(headerValue)) return headerValue[0] || crypto.randomUUID();
  return headerValue || crypto.randomUUID();
}

function logOrgError(req, message, error) {
  const correlationId = getCorrelationId(req);
  console.error(`[OrgDiscovery][${correlationId}] ${message}`, {
    route: req.originalUrl,
    method: req.method,
    error: error?.message || error,
    stack: error?.stack,
  });
  return correlationId;
}

function getAuthIdentity(req) {
  const supabaseUserId = req.authUserId || null;
  const email = req.user?.email || null;

  if (!supabaseUserId) {
    return null;
  }

  return {
    supabaseUserId: String(supabaseUserId),
    email,
  };
}

async function upsertLocalUser(identity) {
  return queryOne(
    `INSERT INTO users (supabase_user_id, email)
     VALUES ($1::uuid, COALESCE($2, 'unknown@example.com'))
     ON CONFLICT (supabase_user_id)
     DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
     RETURNING id, supabase_user_id, email, name, created_at`,
    [identity.supabaseUserId, identity.email]
  );
}

async function getOrgRowsBySupabaseUserId(supabaseUserId) {
  return queryRows(
    `SELECT
       o.id,
       o.name,
       o.created_at,
       om.id AS membership_id,
       om.role,
       om.created_at AS membership_created_at
     FROM users u
     INNER JOIN org_memberships om ON om.user_id = u.id
     INNER JOIN organizations o ON o.id = om.org_id
     WHERE u.supabase_user_id = $1::uuid
     ORDER BY om.created_at ASC`,
    [supabaseUserId]
  );
}

function normalizeOrgId(orgId) {
  if (!orgId) return null;
  return String(orgId);
}

function getRequestedOrgId(req) {
  const fromHeader = req.headers['x-organization-id'] || req.headers['x-org-id'];
  const normalizedHeader = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
  return normalizeOrgId(normalizedHeader || req.orgId || null);
}

function requestedOrgIsUnauthorized(orgRows, requestedOrgId) {
  return Boolean(requestedOrgId) &&
    !orgRows.some((org) => String(org.id) === String(requestedOrgId));
}

function toOrgListResponse(orgRows, requestedOrgId = null) {
  const orgs = orgRows.map((row) => ({
    id: String(row.id),
    name: row.name || 'Organization',
    title: row.name || 'Organization',
    role: row.role || 'member',
    membership: {
      id: String(row.membership_id),
      role: row.role || 'member',
      created_at: row.membership_created_at || null,
    },
    created_at: row.created_at || null,
  }));

  const defaultOrgId = orgs[0]?.id ?? null;
  const activeOrgId = requestedOrgId && orgs.some((org) => org.id === requestedOrgId)
    ? requestedOrgId
    : defaultOrgId;

  return {
    orgs,
    items: orgs,
    organizations: orgs,
    total: orgs.length,
    activeOrgId: activeOrgId,
    active_org_id: activeOrgId,
    default_org_id: defaultOrgId,
  };
}

router.get('/', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    const orgRows = await getOrgsFromSupabase(identity.supabaseUserId);
    const requestedOrgId = getRequestedOrgId(req);
    if (requestedOrgIsUnauthorized(orgRows, requestedOrgId)) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }
    const response = toOrgListResponse(orgRows, requestedOrgId);
    return res.status(200).json({ user: { id: identity.supabaseUserId, email: identity.email }, ...response });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to load current user organization context', error);
    return res.status(500).json({
      code: 'ME_LOAD_FAILED',
      message: 'Failed to load user organization context',
      correlationId,
    });
  }
});

router.get('/bootstrap', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    const orgRows = await getOrgsFromSupabase(identity.supabaseUserId);
    const requestedOrgId = getRequestedOrgId(req);
    if (requestedOrgIsUnauthorized(orgRows, requestedOrgId)) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }
    const response = toOrgListResponse(orgRows, requestedOrgId);
    return res.status(200).json({ user: { id: identity.supabaseUserId }, ...response });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to bootstrap organizations', error);
    return res.status(503).json({ code: 'ORG_LOOKUP_UNAVAILABLE', correlationId });
  }
});

router.get('/active', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    const orgRows = await getOrgsFromSupabase(identity.supabaseUserId);
    const requestedOrgId = getRequestedOrgId(req);
    if (requestedOrgIsUnauthorized(orgRows, requestedOrgId)) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }
    const response = toOrgListResponse(orgRows, requestedOrgId);
    const activeOrg = response.orgs.find((org) => org.id === response.active_org_id) || null;

    return res.status(200).json({
      org: activeOrg,
      active_org_id: response.active_org_id,
      activeOrgId: response.activeOrgId,
    });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to load active organization', error);
    return res.status(500).json({
      code: 'ACTIVE_ORG_LOAD_FAILED',
      message: 'Failed to load active organization',
      correlationId,
    });
  }
});

router.post('/', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    const payload = createOrgSchema.parse(req.body || {});
    const { data: created, error } = await supabase.rpc('create_organization_with_owner', {
      p_name: payload.name,
      p_owner_user_id: identity.supabaseUserId,
    });
    if (error || !created) throw error || new Error('Organization creation returned no result');

    return res.status(201).json({
      org: {
        id: String(created.id),
        name: created.name,
        title: created.title || created.name,
        role: 'owner',
        membership: {
          id: String(created.membership_id),
          role: 'owner',
          created_at: created.created_at,
        },
      },
    });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to create organization', error);
    return res.status(500).json({
      code: 'ORG_CREATE_FAILED',
      message: 'Failed to create organization',
      correlationId,
    });
  }
});

router.post('/select', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    const payload = selectOrgSchema.parse(req.body || {});
    const orgRows = await getOrgsFromSupabase(identity.supabaseUserId);
    const hasOrgAccess = orgRows.some((org) => String(org.id) === payload.org_id);

    if (!hasOrgAccess) {
      return res.status(403).json({
        code: 'ORG_FORBIDDEN',
        message: 'Organization access denied',
      });
    }

    return res.status(200).json({
      ok: true,
      active_org_id: payload.org_id,
      activeOrgId: payload.org_id,
    });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to select organization', error);
    return res.status(500).json({
      code: 'ORG_SELECT_FAILED',
      message: 'Failed to select organization',
      correlationId,
    });
  }
});

module.exports = router;
function toOrgItem(row) {
  const organization = row.organizations || {};
  const name = organization.name || 'Organization';
  return {
    id: String(organization.id),
    name,
    title: organization.title ?? name,
    role: row.role || 'admin',
    data: organization.data ?? {},
    membership: {
      role: row.role || 'admin',
      created_at: row.created_at || null,
      deleted_at: row.deleted_at || null,
      data: row.data ?? {},
    },
  };
}

async function getOrgsForUser(userId) {
  const { data: rows, error } = await withTimeout(
    supabase
      .from('org_memberships')
      .select(`role, created_at, deleted_at, data, organizations!inner(${selectFor('organizations')})`)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('organizations.status', 'active')
      .is('deleted_at', null),
    'Organization membership query'
  );

  if (error) {
    throw error;
  }

  const items = (rows || []).map(toOrgItem);
  return { items, total: items.length };
}

function toOrgsResponse(orgsResult, activeOrgId = null) {
  const orgs = orgsResult.items;
  const resolvedActiveOrgId = activeOrgId ?? orgs[0]?.id ?? null;
  return {
    orgs,
    items: orgs,
    organizations: orgs,
    total: orgs.length,
    activeOrgId: resolvedActiveOrgId,
    active_org_id: resolvedActiveOrgId,
    default_org_id: orgs[0]?.id ?? null,
  };
}

async function createOrgForUser(userId, name) {
  const { data: organization, error } = await supabase.rpc('create_organization_with_owner', {
    p_name: name,
    p_owner_user_id: userId,
  });
  if (error || !organization) throw error || new Error('Organization creation returned no result');
  return {
    org: {
      id: String(organization.id),
      name: organization.name || name,
      title: organization.title ?? (organization.name || name),
      role: 'owner',
      membership: {
        id: String(organization.membership_id),
        role: 'owner',
        created_at: organization.created_at,
      },
    },
  };
}

router.get('/', async (req, res) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
  }

  try {
    const orgs = await getOrgsForUser(authUserId);
    return res.status(200).json(toOrgsResponse(orgs, req.orgId ? String(req.orgId) : null));
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to list organizations', error);
    return res.status(500).json({
      message: 'Failed to load organizations',
      correlationId,
    });
  }
});

router.post('/', async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
  }

   try {
    const payload = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body || {});
    const created = await createOrgForUser(userId, payload.name);
     return res.status(201).json(created);
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to create organization', error);
    return res.status(500).json({
      message: 'Failed to create organization',
      correlationId,
    });
  }
});

router.post('/select', async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
  }

   try {
    const payload = z.object({ org_id: z.string().min(1) }).parse(req.body || {});
    const orgs = await getOrgsForUser(userId);
    const selected = orgs.items.find((org) => org.id === payload.org_id);

    if (!selected) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }

      const { error } = await withTimeout(
      supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...(req.user?.user_metadata || {}),
          organization_id: payload.org_id,
        },
      }),
      'Organization selection update'
    );

    if (error) {
      return res.status(400).json({ message: error.message });
    }

  return res.json({ ok: true, active_org_id: payload.org_id, activeOrgId: payload.org_id });
  } catch (error) {
   const correlationId = logOrgError(req, 'Failed to select organization', error);
    return res.status(500).json({
      message: 'Failed to select organization',
      correlationId,
    });
  }
});

router.get('/bootstrap', async (req, res) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
  }

    try {
    const orgs = await getOrgsForUser(authUserId);
    return res.status(200).json({
      user: { id: authUserId },
     ...toOrgsResponse(orgs, req.orgId ? String(req.orgId) : null),
    });
  } catch (error) {
     const correlationId = logOrgError(req, 'Failed to bootstrap organizations', error);
    return res.status(500).json({
      message: 'Unable to bootstrap organization context',
      correlationId,
      orgs: [],
      activeOrgId: null,
      active_org_id: null,
      default_org_id: null,
    });
  }
});

module.exports = router;
