const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

router.get('/packs', async (req, res) => {
  const { data, error } = await supabase
    .from('policy_packs')
    .select('*')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ packs: data || [] });
});

router.post('/packs', async (req, res) => {
  const payload = {
    org_id: req.orgId,
    name: req.body?.name,
    authority: req.body?.authority,
    description: req.body?.description || null,
    status: req.body?.status || 'active',
  };

  const { data, error } = await supabase.from('policy_packs').insert(payload).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ pack: data });
});

router.patch('/packs/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('policy_packs')
    .update({
      name: req.body?.name,
      authority: req.body?.authority,
      description: req.body?.description,
      status: req.body?.status,
    })
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ pack: data });
});

module.exports = router;
