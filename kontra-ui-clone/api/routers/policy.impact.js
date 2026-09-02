const express = require('express');
const { supabase } = require('../db');
const { evaluateConditions, computeDueDate } = require('../services/policyEvaluator');

const router = express.Router();

router.post('/impact/run', async (req, res) => {
  const { rule_version_id } = req.body || {};
  if (!rule_version_id) return res.status(400).json({ error: 'rule_version_id is required' });

  const { data: version, error: vErr } = await supabase
    .from('policy_rule_versions')
    .select('*, policy_rules!inner(pack_id,applies_to,name)')
    .eq('org_id', req.orgId)
    .eq('id', rule_version_id)
    .single();

  if (vErr || !version) return res.status(404).json({ error: 'Rule version not found' });

  const { data: run, error: runErr } = await supabase
    .from('policy_impact_runs')
    .insert({
      org_id: req.orgId,
      pack_id: version?.policy_rules?.pack_id || null,
      rule_version_id,
      status: 'running',
      created_by: req.user?.id || req.userId || null,
    })
    .select('*')
    .single();

  if (runErr) return res.status(400).json({ error: runErr.message });

  const { data: loans, error: loanErr } = await supabase.from('loans').select('*').eq('org_id', req.orgId);
  if (loanErr) {
    await supabase.from('policy_impact_runs').update({ status: 'failed' }).eq('id', run.id);
    return res.status(400).json({ error: loanErr.message });
  }

  const rows = [];
  let triggerCount = 0;
  for (const loan of loans || []) {
    const would_trigger = evaluateConditions({ loan }, version.conditions || {});
    if (would_trigger) triggerCount += 1;
    const dueAction = (version.actions || []).find((a) => a.type === 'set_due_date');
    rows.push({
      org_id: req.orgId,
      impact_run_id: run.id,
      entity_type: 'loan',
      entity_id: loan.id,
      would_trigger,
      severity: version.severity,
      due_date: computeDueDate(dueAction),
      details: {
        rule_name: version?.policy_rules?.name,
        inputs_snapshot: {
          risk_rating: loan.risk_rating,
          special_product: loan.special_product,
        },
      },
    });
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from('policy_impact_results').insert(rows);
    if (insErr) {
      await supabase.from('policy_impact_runs').update({ status: 'failed' }).eq('id', run.id);
      return res.status(400).json({ error: insErr.message });
    }
  }

  const summary = {
    total_entities: rows.length,
    would_trigger: triggerCount,
    no_trigger: rows.length - triggerCount,
    severity: version.severity,
  };

  await supabase.from('policy_impact_runs').update({ status: 'complete', summary }).eq('id', run.id);
  return res.status(201).json({ run_id: run.id, summary });
});

router.get('/impact/:runId', async (req, res) => {
  const { data: run, error: runErr } = await supabase
    .from('policy_impact_runs')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('id', req.params.runId)
    .single();

  if (runErr) return res.status(404).json({ error: runErr.message });

  const { data: results, error: resultErr } = await supabase
    .from('policy_impact_results')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('impact_run_id', req.params.runId)
    .order('would_trigger', { ascending: false })
    .limit(50);

  if (resultErr) return res.status(400).json({ error: resultErr.message });

  return res.json({ run, results: results || [] });
});

module.exports = router;
