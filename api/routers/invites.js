const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const { supabase } = require('../db');
const requireMembershipRole = require('../middlewares/requireMembershipRole');

// Create an invite for an email to join an organization
router.post('/', requireMembershipRole('owner', 'admin'), async (req, res) => {
  const { email, organization_id, role } = req.body || {};
  if (!email || !organization_id) {
    return res.status(400).json({ error: 'email and organization_id required' });
  }
  if (String(organization_id) !== String(req.orgId)) {
    return res.status(403).json({ code: 'ORG_FORBIDDEN' });
  }
  const inviteRole = role || 'member';
  if (inviteRole !== 'member') {
    return res.status(400).json({ code: 'ORG_ROLE_INVALID' });
  }
  const token = uuidv4();
  const { error } = await supabase
    .from('organization_invites')
    .insert([{ email, organization_id: req.orgId, role: inviteRole, token }]);
  if (error) return res.status(500).json({ error: 'Failed to create invite' });
  // In a real implementation you'd email the invite link
  console.log('Invite token for', email, token);
  res.status(201).json({ token });
});

// Fetch invite details by token
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  const { data, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error || !data || data.accepted) {
    return res.status(404).json({ error: 'Invalid invite' });
  }
  res.json({ invite: { email: data.email, organization_id: data.organization_id, role: data.role } });
});

// Accept invite and create user
router.post('/accept', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password required' });
  }
  const { data: invite, error: inviteError } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (inviteError || !invite || invite.accepted) {
    return res.status(400).json({ error: 'Invalid invite' });
  }
  if (invite.role !== 'member') {
    return res.status(400).json({ error: 'Invalid invite role' });
  }
  const { data: activeOrganization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, status')
    .eq('id', invite.organization_id)
    .eq('status', 'active')
    .maybeSingle();
  if (organizationError || !activeOrganization) return res.status(400).json({ error: 'Organization is unavailable' });
  const { data, error } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { organization_id: invite.organization_id }
  });
  if (error) return res.status(500).json({ error: error.message });

  const { error: membershipError } = await supabase
    .from('org_memberships')
    .insert({
      org_id: invite.organization_id,
      user_id: data.user.id,
      role: 'member',
      status: 'active',
      created_by: invite.created_by || data.user.id,
    });
  if (membershipError) return res.status(500).json({ error: 'Failed to add organization membership' });

  await supabase.from('organization_members').insert({
    user_id: data.user.id,
    organization_id: invite.organization_id,
    role: invite.role
  });
  await supabase.from('organization_invites').update({ accepted: true }).eq('id', invite.id);

  res.json({ user: data.user });
});

module.exports = router;
