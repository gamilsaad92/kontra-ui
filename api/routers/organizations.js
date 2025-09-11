const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { runKycCheck } = require('../compliance');
const { logAuditEntry } = require('../auditLogger');

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

module.exports = router;
