const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const authenticate = require('../../middlewares/authenticate');
const { supabase } = require('../../db');
const { getAuthUserId } = require('../lib/auth');
const { selectFor } = require('../lib/selectColumns');

const router = express.Router();

router.use(authenticate);

const QUERY_TIMEOUT_MS = Number(process.env.ORG_BOOTSTRAP_TIMEOUT_MS || 8000);

function getCorrelationId(req) {
  const headerValue = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  if (Array.isArray(headerValue)) {
    return headerValue[0] || crypto.randomUUID();
  }
  return headerValue || crypto.randomUUID();
}

async function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS}ms`));
    }, QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

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
