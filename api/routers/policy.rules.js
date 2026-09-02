const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

const nextVersion = async (ruleId) => {
  const { data, error } = await supabase
    .from('policy_rule_versions')
    .select('version')
    .eq('rule_id', ruleId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version || 0) + 1;
};

router.get('/rules', async (req, res) => {
  let query = supabase
    .from('policy_rules')
    .select('*, regulations(id,title,citation), policy_rule_versions(*)')
    .eq('org_id', req.orgId)
    .order('updated_at', { ascending: false });

  if (req.query.pack_id) query = query.eq('pack_id', req.query.pack_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ rules: data || [] });
});

router.post('/rules', async (req, res) => {
  const rulePayload = {
    org_id: req.orgId,
    pack_id: req.body?.pack_id,
    regulation_id: req.body?.regulation_id || null,
    name: req.body?.name,
    applies_to: req.body?.applies_to || 'loan',
    status: 'draft',
  };

  const { data: rule, error: ruleErr } = await supabase.from('policy_rules').insert(rulePayload).select('*').single();
  if (ruleErr) return res.status(400).json({ error: ruleErr.message });

  const versionPayload = {
    org_id: req.orgId,
    rule_id: rule.id,
    version: 1,
    status: 'draft',
    conditions: req.body?.conditions || {},
    actions: req.body?.actions || [],
    severity: req.body?.severity || 'medium',
    change_note: req.body?.change_note || 'Initial version',
    created_by: req.user?.id || req.userId || null,
  };

  const { data: version, error: vErr } = await supabase
    .from('policy_rule_versions')
    .insert(versionPayload)
    .select('*')
    .single();
  if (vErr) return res.status(400).json({ error: vErr.message });

  return res.status(201).json({ rule, version });
});

router.post('/rules/:id/versions', async (req, res) => {
  try {
    const version = await nextVersion(req.params.id);
    const payload = {
      org_id: req.orgId,
      rule_id: req.params.id,
      version,
      status: 'draft',
      conditions: req.body?.conditions || {},
      actions: req.body?.actions || [],
      severity: req.body?.severity || 'medium',
      change_note: req.body?.change_note || null,
      effective_date: req.body?.effective_date || null,
      created_by: req.user?.id || req.userId || null,
    };

    const { data, error } = await supabase.from('policy_rule_versions').insert(payload).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ version: data });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create version' });
  }
});

router.post('/rules/:id/submit', async (req, res) => {
  const { data, error } = await supabase
    .from('policy_rules')
    .update({ status: 'in_review' })
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase
    .from('policy_rule_versions')
    .update({ status: 'in_review' })
    .eq('org_id', req.orgId)
    .eq('rule_id', req.params.id)
    .eq('status', 'draft');

  return res.json({ rule: data });
});

router.post('/versions/:versionId/approve', async (req, res) => {
  const approved_by = req.user?.id || req.userId || null;
  const approved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('policy_rule_versions')
    .update({ status: 'approved', approved_by, approved_at })
    .eq('org_id', req.orgId)
    .eq('id', req.params.versionId)
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ version: data });
});

router.post('/versions/:versionId/activate', async (req, res) => {
  const { data: version, error: getErr } = await supabase
    .from('policy_rule_versions')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('id', req.params.versionId)
    .single();

  if (getErr) return res.status(400).json({ error: getErr.message });

  await supabase
    .from('policy_rule_versions')
    .update({ status: 'retired' })
    .eq('org_id', req.orgId)
    .eq('rule_id', version.rule_id)
    .eq('status', 'active');

  const { data: activeVersion, error: activeErr } = await supabase
    .from('policy_rule_versions')
    .update({ status: 'active' })
    .eq('org_id', req.orgId)
    .eq('id', req.params.versionId)
    .select('*')
    .single();

  if (activeErr) return res.status(400).json({ error: activeErr.message });

  const { data: rule, error: rErr } = await supabase
    .from('policy_rules')
    .update({ current_version_id: req.params.versionId, status: 'active' })
    .eq('org_id', req.orgId)
    .eq('id', version.rule_id)
    .select('*')
    .single();

  if (rErr) return res.status(400).json({ error: rErr.message });

  return res.json({ version: activeVersion, rule });
});

module.exports = router;
