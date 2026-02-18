const express = require('express');
const { z } = require('zod');
const authenticate = require('../../middlewares/authenticate');
const { supabase, replica } = require('../../db');
const { getAuthUserId } = require('../lib/auth');

const router = express.Router();

router.use(authenticate);

async function getOrgsForUser(userId) {
 const { data, error } = await replica
    .from('org_memberships')
   .select('org_id, role, organizations!inner(id, name, created_by, data, status, created_at)')
    .eq('user_id', userId)
    .order('created_at', { foreignTable: 'organizations', ascending: false });

  if (error) {
    throw error;
  }

   const items = (data || [])
    .map((row) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      if (!org?.id) return null;

      return {
        id: String(org.id),
     name: org.name || 'Organization',
         role: row.role || 'admin',
      };
    })
    .filter(Boolean);
  
  return { items, total: items.length };
}

async function createOrgForUser(userId, name) {
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      created_by: userId,
      data: {},
      status: 'active',
    })
  .select('id, name')
    .single();

  if (orgError) {
    throw orgError;
  }

  const { data: membership, error: membershipError } = await supabase
    .from('org_memberships')
    .insert({
      org_id: organization.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
      data: {},
    })
    .select('id, org_id, user_id, role, created_at')
    .single();

  if (membershipError) {
    throw membershipError;
  }

  return {
    org: {
      id: String(organization.id),
     name: organization.name || name,
    },
    membership,
  };
}

router.get('/', async (req, res, next) => {
  try {
     const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
    }

    const orgs = await getOrgsForUser(userId);
    res.json(orgs);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
    }

    const payload = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body || {});
    const created = await createOrgForUser(userId, payload.name);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post('/select', async (req, res, next) => {
  try {
        const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
    }

    const payload = z.object({ org_id: z.string().min(1) }).parse(req.body || {});
     const orgs = await getOrgsForUser(userId);
    const selected = orgs.items.find((org) => org.id === payload.org_id);

    if (!selected) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }

     const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(req.user?.user_metadata || {}),
        organization_id: payload.org_id,
      },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

  res.json({ ok: true, active_org_id: payload.org_id });
  } catch (error) {
    next(error);
  }
});

router.get('/bootstrap', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
    }

    let orgs = await getOrgsForUser(userId);
    if (orgs.total === 0) {
      await createOrgForUser(userId, 'My Kontra Workspace');
      orgs = await getOrgsForUser(userId);
    }

    const metadataOrgId = req.user?.user_metadata?.organization_id
      ? String(req.user.user_metadata.organization_id)
      : null;

    const defaultOrgId = orgs.items.some((org) => org.id === metadataOrgId)
      ? metadataOrgId
      : orgs.items[0]?.id || null;
    
    res.json({
      user: {
          id: userId,
        email: req.user?.email,
      },
       orgs: orgs.items,
      default_org_id: defaultOrgId,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
