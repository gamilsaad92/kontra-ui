const express = require('express');
const { runKycCheck } = require('../compliance');
const { logAuditEntry } = require('../auditLogger');
const { supabase, replica } = require('../db');
const authenticate = require('../middlewares/authenticate');
const { resolveCanonicalIdentity } = require('../middlewares/resolveCanonicalIdentity');
const requireMembershipRole = require('../middlewares/requireMembershipRole');

const router = express.Router();
router.use(authenticate);
router.use(async (req, res, next) => {
  try {
    const identity = await resolveCanonicalIdentity(req, supabase);
    if (identity.error) return res.status(503).json({ code: 'IDENTITY_LOOKUP_UNAVAILABLE' });
    if (!identity.userId) return res.status(403).json({ code: 'IDENTITY_LINK_REQUIRED' });
    req.authUserId = identity.userId;
    return next();
  } catch {
    return res.status(503).json({ code: 'IDENTITY_LOOKUP_UNAVAILABLE' });
  }
});

// List organizations
router.get('/', async (req, res) => {
  const { data, error } = await replica
    .from('org_memberships')
    .select('role, organizations!inner(*)')
    .eq('user_id', req.authUserId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .eq('organizations.status', 'active')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ organizations: (data || []).map((membership) => ({
    ...membership.organizations,
    membership_role: membership.role,
  })) });
});

// Create organization
router.post('/', async (req, res) => {
  const { name, branding, parent_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    p_name: name,
    p_owner_user_id: req.authUserId,
    p_branding: branding || {},
    p_parent_id: parent_id || null,
    p_data: req.body?.data || {},
  });
  if (error) return res.status(500).json({ error: 'Failed to create organization' });
  if (!data?.id) return res.status(500).json({ error: 'Failed to create organization' });

  let approved = false;
  try {
    const result = await runKycCheck(data.id);
    approved = !!result.passed;
    logAuditEntry({ type: 'kyc', organization_id: data.id, result: approved ? 'passed' : 'failed' });
  } catch (err) {
    console.error('KYC check failed:', err);
  }
  await supabase
    .from('organizations')
    .update({ kyc_approved: approved })
    .eq('id', data.id);

  res.status(201).json({ organization: { ...data, kyc_approved: approved } });
});

// Get single organization
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (String(req.orgId) !== String(id)) return res.status(403).json({ code: 'ORG_FORBIDDEN' });
 const { data, error } = await replica
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to fetch organization' });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ organization: data });
});

// Update branding
router.put('/:id', requireMembershipRole('owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  if (String(req.orgId) !== String(id)) return res.status(403).json({ code: 'ORG_FORBIDDEN' });
  const { name, branding } = req.body || {};
  const { data, error } = await supabase
    .from('organizations')
    .update({ name, branding })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to update organization' });
  res.json({ organization: data });
});

module.exports = router;
