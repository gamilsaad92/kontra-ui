const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { runKycCheck } = require('../compliance');
const { logAuditEntry } = require('../auditLogger');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// List organizations
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ organizations: data });
});

// Create organization
router.post('/', async (req, res) => {
  const { name, branding, parent_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { data, error } = await supabase
    .from('organizations')
    .insert([{ name, branding, parent_id, kyc_approved: false }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to create organization' });

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
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to fetch organization' });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ organization: data });
});

// Update branding
router.put('/:id', async (req, res) => {
  const { id } = req.params;
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

// List organization accounts
router.get('/:id/accounts', authenticate, async (req, res) => {
  const { id } = req.params;
  if (req.organizationId && String(req.organizationId) !== String(id) && req.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, role, account_type')
    .eq('organization_id', id);
  if (error) return res.status(500).json({ error: 'Failed to fetch accounts' });
  res.json({ accounts: data });
});

// Add or update an organization account
router.post('/:id/accounts', authenticate, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { user_id, role, account_type } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const { data, error } = await supabase
    .from('organization_members')
    .upsert({
      user_id,
      organization_id: id,
      role: role || 'borrower',
      account_type: account_type || 'borrower'
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to save account' });
  res.status(201).json({ account: data });
});

module.exports = router;
