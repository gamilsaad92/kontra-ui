const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/projects', async (req, res) => {
  const { name, number, address, owner_id } = req.body || {};
  if (!name || !number || !address || !owner_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, number, address, owner_id }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create project' });
  res.status(201).json({ project: data });
});

router.get('/projects', async (req, res) => {
  const { owner_id, status } = req.query;
  let q = supabase.from('projects').select('*');
  if (owner_id) q = q.eq('owner_id', owner_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to list projects' });
  res.json({ projects: data });
});

router.get('/projects/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch project' });
  res.json({ project: data });
});

router.get('/projects/export', async (req, res) => {
  const { owner_id, status } = req.query;
  let q = supabase.from('projects').select('id, name, number, status, created_at');
  if (owner_id) q = q.eq('owner_id', owner_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export projects' });
  const header = 'id,name,number,status,created_at';
  const rows = data.map(p => [p.id, p.name, p.number, p.status, p.created_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

router.put('/projects/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .update(req.body || {})
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update project' });
  res.json({ project: data });
});

router.delete('/projects/:id', async (req, res) => {
  const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete project' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
