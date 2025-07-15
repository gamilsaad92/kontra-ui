const express = require('express');
const { createClient } = require('@supabase/supabase-js');

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
    .insert([{ name, branding, parent_id }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to create organization' });
  res.status(201).json({ organization: data });
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
