const express = require('express');
const { z } = require('zod');
const authenticate = require('../../middlewares/authenticate');
const { supabase, replica } = require('../../db');

const router = express.Router();

router.use(authenticate);

async function getMembershipOrgs(userId) {
  const membershipQueries = [
    async () => replica.from('org_memberships').select('org_id, role').eq('user_id', userId),
    async () => replica.from('organization_members').select('organization_id, role').eq('user_id', userId),
  ];

  for (const query of membershipQueries) {
    const { data, error } = await query();
    if (!error) {
      const items = (data || [])
        .map((row) => ({
          id: String(row.org_id ?? row.organization_id ?? ''),
          role: row.role ?? null,
        }))
        .filter((row) => row.id);
      if (items.length > 0) return items;
    }
  }

  return [];
}

async function getOrgsForUser(userId) {
  const membershipItems = await getMembershipOrgs(userId);
  if (membershipItems.length === 0) {
    return [];
  }

  const orgIds = [...new Set(membershipItems.map((item) => item.id))];
  const { data, error } = await replica
    .from('organizations')
    .select('id, name, title')
    .in('id', orgIds);

  if (error) {
    throw error;
  }

  const orgById = new Map((data || []).map((org) => [String(org.id), org]));

  return membershipItems
    .map((membership) => {
      const org = orgById.get(membership.id);
      if (!org) return null;
      return {
        id: String(org.id),
        name: org.name || org.title || 'Organization',
        role: membership.role || undefined,
      };
    })
    .filter(Boolean);
}

router.get('/', async (req, res, next) => {
  try {
    const items = await getOrgsForUser(req.user.id);
    res.json({ items, total: items.length });
  } catch (error) {
    next(error);
  }
});

router.post('/select', async (req, res, next) => {
  try {
    const payload = z.object({ org_id: z.string().min(1) }).parse(req.body || {});
    const items = await getOrgsForUser(req.user.id);
    const selected = items.find((org) => org.id === payload.org_id);

    if (!selected) {
      return res.status(403).json({ code: 'ORG_FORBIDDEN', message: 'Organization access denied' });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.id, {
      user_metadata: {
        ...(req.user.user_metadata || {}),
        organization_id: payload.org_id,
      },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({ ok: true, org_id: payload.org_id });
  } catch (error) {
    next(error);
  }
});

router.get('/bootstrap', async (req, res, next) => {
  try {
    const orgs = await getOrgsForUser(req.user.id);
    const metadataOrgId = req.user?.user_metadata?.organization_id
      ? String(req.user.user_metadata.organization_id)
      : null;

    const defaultOrgId = orgs.some((org) => org.id === metadataOrgId)
      ? metadataOrgId
      : orgs.length === 1
        ? orgs[0].id
        : null;

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      orgs,
      default_org_id: defaultOrgId,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
