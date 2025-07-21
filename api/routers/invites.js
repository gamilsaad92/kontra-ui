const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create an invite for an email to join an organization
router.post('/', async (req, res) => {
  const { email, organization_id, role } = req.body || {};
  if (!email || !organization_id) {
    return res.status(400).json({ error: 'email and organization_id required' });
  }
  const token = uuidv4();
  const { error } = await supabase
    .from('organization_invites')
    .insert([{ email, organization_id, role: role || 'member', token }]);
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
  const { data, error } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { organization_id: invite.organization_id }
  });
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('organization_members').insert({
    user_id: data.user.id,
    organization_id: invite.organization_id,
    role: invite.role
  });
  await supabase.from('organization_invites').update({ accepted: true }).eq('id', invite.id);

  res.json({ user: data.user });
});

module.exports = router;
