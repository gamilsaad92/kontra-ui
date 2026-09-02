const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

router.get('/regulations', async (req, res) => {
  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ regulations: data || [] });
});

router.post('/regulations', async (req, res) => {
  const payload = {
    org_id: req.orgId,
    pack_id: req.body?.pack_id || null,
    authority: req.body?.authority,
    title: req.body?.title,
    citation: req.body?.citation || null,
    source_url: req.body?.source_url || null,
    effective_date: req.body?.effective_date || null,
    tags: req.body?.tags || [],
    raw_text: req.body?.raw_text || null,
    summary: req.body?.summary || null,
    status: req.body?.status || 'active',
  };

  const { data, error } = await supabase.from('regulations').insert(payload).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json({ regulation: data });
});

module.exports = router;
