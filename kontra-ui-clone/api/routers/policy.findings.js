const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

router.get('/findings', async (req, res) => {
  const { data: findings, error } = await supabase
    .from('compliance_findings')
    .select('*')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(400).json({ error: error.message });

  const findingIds = (findings || []).map((f) => f.id);
  let tasks = [];
  if (findingIds.length) {
    const { data } = await supabase.from('compliance_tasks').select('*').eq('org_id', req.orgId).in('finding_id', findingIds);
    tasks = data || [];
  }

  return res.json({
    findings: (findings || []).map((f) => ({
      ...f,
      tasks: tasks.filter((t) => t.finding_id === f.id),
    })),
  });
});

router.patch('/findings/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('compliance_findings')
    .update({ status: req.body?.status })
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ finding: data });
});

router.post('/findings/:findingId/override', async (req, res) => {
  const payload = {
    org_id: req.orgId,
    finding_id: req.params.findingId,
    action: req.body?.action,
    reason_code: req.body?.reason_code,
    reason: req.body?.reason || null,
    approved_by: req.user?.id || req.userId || null,
    approved_at: new Date().toISOString(),
    expires_at: req.body?.expires_at || null,
  };

  const { data, error } = await supabase.from('compliance_overrides').insert(payload).select('*').single();
  if (error) return res.status(400).json({ error: error.message });

  const nextStatus = payload.action === 'dismiss' ? 'dismissed' : payload.action === 'waive' ? 'waived' : 'in_progress';
  await supabase.from('compliance_findings').update({ status: nextStatus }).eq('org_id', req.orgId).eq('id', req.params.findingId);

  return res.status(201).json({ override: data });
});

module.exports = router;
