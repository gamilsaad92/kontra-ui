const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const authenticate = require('../../middlewares/authenticate');
const { queryOne, queryRows } = require('../lib/appDb');

const router = express.Router();
router.use(authenticate);

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
  const supabaseUserId = req.user?.supabaseUserId || req.user?.id || null;
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
    const user = await upsertLocalUser(identity);
    const orgRows = await getOrgRowsBySupabaseUserId(identity.supabaseUserId);
    const response = toOrgListResponse(orgRows, getRequestedOrgId(req));
    return res.status(200).json({ user, ...response });
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
    const user = await upsertLocalUser(identity);
    const orgRows = await getOrgRowsBySupabaseUserId(identity.supabaseUserId);
    const response = toOrgListResponse(orgRows, getRequestedOrgId(req));
    return res.status(200).json({ user, ...response });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to bootstrap organization context', error);
    return res.status(500).json({
      code: 'BOOTSTRAP_LOAD_FAILED',
      message: 'Unable to bootstrap organization context',
      correlationId,
      orgs: [],
      activeOrgId: null,
      active_org_id: null,
      default_org_id: null,
    });
  }
});

router.get('/active', async (req, res) => {
  const identity = getAuthIdentity(req);
  if (!identity) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });

  try {
    await upsertLocalUser(identity);
    const orgRows = await getOrgRowsBySupabaseUserId(identity.supabaseUserId);
    const response = toOrgListResponse(orgRows, getRequestedOrgId(req));
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
    const user = await upsertLocalUser(identity);

    const created = await queryOne(
      `WITH org AS (
         INSERT INTO organizations (name)
         VALUES ($1)
         RETURNING id, name, created_at
       ), membership AS (
         INSERT INTO org_memberships (org_id, user_id, role)
         SELECT org.id, $2::uuid, 'owner'
         FROM org
         RETURNING id, org_id, user_id, role, created_at
       )
       SELECT
         org.id,
         org.name,
         org.created_at,
         membership.id AS membership_id,
         membership.role,
         membership.user_id
       FROM org
       CROSS JOIN membership`,
      [payload.name, user.id]
    );

    return res.status(201).json({
      org: {
        id: String(created.id),
        name: created.name,
        title: created.name,
        role: created.role,
        membership: {
          id: String(created.membership_id),
          role: created.role,
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
    const orgRows = await getOrgRowsBySupabaseUserId(identity.supabaseUserId);
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
   const { data: organization, error: orgError } = await withTimeout(
    supabase
      .from('organizations')
      .insert({
        name,
        created_by: userId,
        data: {},
        status: 'active',
      })
      .select(selectFor('organizations'))
      .single(),
    'Organization creation'
  );

  if (orgError) {
    throw orgError;
  }

  const { error: membershipError } = await withTimeout(
    supabase
      .from('org_memberships')
      .insert({
        org_id: organization.id,
        user_id: userId,
        role: 'admin',
        data: {},
      }),
    'Membership creation'
  );

  if (membershipError) {
    throw membershipError;
  }

  return {
    org: {
      id: String(organization.id),
      name: organization.name || name,
       title: organization.title ?? (organization.name || name),
    },
  };
}

function logOrgError(req, message, error) {
  const correlationId = getCorrelationId(req);
  console.error(`[OrgDiscovery][${correlationId}] ${message}`, {
    userId: getAuthUserId(req),
    route: req.originalUrl,
    method: req.method,
    error: error?.message || error,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  });
  return correlationId;
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
