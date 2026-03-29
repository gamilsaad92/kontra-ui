const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');
const authenticate = require('../../middlewares/authenticate');
const { queryOne, queryRows } = require('../lib/appDb');

// Supabase service-role client (always available on Render, unlike local Postgres)
const hasSupabaseCredentials =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabaseCredentials
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Query org memberships directly from the Supabase database.
 * Used as a fallback when the local PostgreSQL isn't available or has no records.
 */
async function getOrgsFromSupabase(supabaseUserId) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('org_memberships')
      .select('org_id, role, id, created_at, organizations(id, name, status, created_at)')
      .eq('user_id', supabaseUserId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map((m) => ({
      id: String(m.org_id),
      name: m.organizations?.name || 'Organization',
      role: m.role || 'member',
      membership_id: String(m.id),
      created_at: m.organizations?.created_at || m.created_at,
      membership_created_at: m.created_at,
    }));
  } catch (err) {
    console.debug('[OrgDiscovery] Supabase org lookup failed', err?.message);
    return [];
  }
}

/**
 * Auto-provision a default organization in Supabase for a user who has none.
 * Mirrors what the handle_new_user trigger does for new signups.
 */
async function provisionOrgInSupabase(identity, authUser) {
  if (!supabase) return null;
  try {
    const orgName = authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      (identity.email ? identity.email.split('@')[0] : null) ||
      'My Organization';

    // Create org
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: orgName, status: 'active', created_by: identity.supabaseUserId })
      .select('id, name, created_at')
      .single();
    if (orgErr || !org) {
      console.warn('[OrgDiscovery] org provision failed', orgErr?.message);
      return null;
    }

    // Create membership
    await supabase
      .from('org_memberships')
      .insert({ org_id: org.id, user_id: identity.supabaseUserId, role: 'admin', status: 'active' });

    // Enrich JWT app_metadata so future logins include organization_id
    await supabase.auth.admin.updateUserById(identity.supabaseUserId, {
      app_metadata: { organization_id: String(org.id) },
    });

    console.info('[OrgDiscovery] provisioned org for existing user', { orgId: org.id, userId: identity.supabaseUserId });
    return { id: String(org.id), name: org.name, role: 'admin', membership_id: null, created_at: org.created_at };
  } catch (err) {
    console.warn('[OrgDiscovery] provisionOrgInSupabase threw', err?.message);
    return null;
  }
}

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

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

function sendStructuredError(res, status, code, message, correlationId, details = null) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      status,
      correlationId,
      ...(details ? { details } : {}),
    },
  });
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
    const token = getBearerToken(req);
  if (!token) {
    const correlationId = getCorrelationId(req);
    return sendStructuredError(
      res,
      401,
      'AUTH_TOKEN_MISSING',
      'Authorization bearer token is required for bootstrap.',
      correlationId
    );
  }

  const identity = getAuthIdentity(req);
  if (!identity) {
    const correlationId = getCorrelationId(req);
    return sendStructuredError(
      res,
      401,
      'AUTH_TOKEN_INVALID',
      'Invalid or expired Supabase access token.',
      correlationId
    );
  }
  
  let user = null;
  let orgRows = [];

  // Step 1: Try local PostgreSQL
  try {
    user = await upsertLocalUser(identity);
    orgRows = await getOrgRowsBySupabaseUserId(identity.supabaseUserId);
  } catch (localErr) {
    if (localErr?.code !== 'APP_DB_URL_MISSING' && localErr?.code !== 'APP_DB_AUTH_FAILED') {
      console.debug('[OrgDiscovery] local DB unavailable in bootstrap, falling back to Supabase', localErr?.message);
    }
  }

  // Step 2: If local DB returned nothing, query Supabase org_memberships directly
  if (!orgRows || orgRows.length === 0) {
    const supabaseOrgs = await getOrgsFromSupabase(identity.supabaseUserId);
    if (supabaseOrgs.length > 0) {
      orgRows = supabaseOrgs;
    }
  }

  // Step 3: Still no org — auto-provision one for this existing user
  if (!orgRows || orgRows.length === 0) {
    const authUser = req.user || {};
    const provisioned = await provisionOrgInSupabase(identity, authUser);
    if (provisioned) {
      orgRows = [provisioned];
    }
  }

  try {
    const response = toOrgListResponse(orgRows, getRequestedOrgId(req));
    return res.status(200).json({
      ok: true,
      user,
      ...response,
    });
  } catch (error) {
    const correlationId = logOrgError(req, 'Failed to build bootstrap response', error);
    return sendStructuredError(
      res,
      500,
      'BOOTSTRAP_RESPONSE_FAILED',
      'Failed to load organization bootstrap data.',
      correlationId
    );
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
