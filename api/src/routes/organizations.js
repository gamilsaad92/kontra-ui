const express = require('express');
const { z } = require('zod');
const { getEntity } = require('../lib/crud');
const { supabase } = require('../../db');

const router = express.Router();
const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', run(async (req, res) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', req.orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json({ items: data || [], total: data?.length || 0 });
}));

router.post('/', run(async (req, res) => {
 const payload = z.object({ name: z.string().trim().min(1).max(120), data: z.record(z.any()).optional() }).parse(req.body);
  const { data, error } = await supabase
    .from('organizations')
   .insert({ name: payload.name, created_by: req.user?.id || null, data: payload.data || {} })
    .select('id, name')
    .single();
  if (error) return res.status(400).json({ message: error.message });
  
  const { error: membershipError } = await supabase
    .from('org_memberships')
    .insert({
      org_id: data.id,
      user_id: req.user?.id,
      role: 'admin',
    });

  if (membershipError) return res.status(400).json({ message: membershipError.message });
  res.status(201).json(data);
}));

router.get('/:id', run(async (req, res) => {
 const id = z.string().min(1).parse(req.params.id);
  const org = await getEntity('organizations', req.orgId, id);
  if (!org) return res.status(404).json({ message: 'Not found' });
  res.json(org);
}));

router.get('/:id/members', run(async (req, res) => {
 const id = z.string().min(1).parse(req.params.id);
  const { data, error } = await supabase
    .from('org_memberships')
    .select('*', { count: 'exact' })
    .eq('org_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ items: data || [], total: data?.length || 0 });
}));

router.post('/:id/members', run(async (req, res) => {
 const id = z.string().min(1).parse(req.params.id);
  const payload = z.object({ user_id: z.string(), role: z.string().optional(), data: z.record(z.any()).optional() }).parse(req.body);

  if (id !== req.orgId) {
    return res.status(404).json({ message: 'Not found' });
  }

  const { data, error } = await supabase
    .from('org_memberships')
    .insert({
      org_id: id,
      user_id: payload.user_id,
      role: payload.role || 'member',
      status: 'active',
      title: null,
      data: payload.data || {},
    })
    .select('*')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json(data);
}));

module.exports = router;
