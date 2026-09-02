const express = require('express');
const { supabase } = require('../db');
const { evaluateLoanPolicies } = require('../services/policyRun');

const router = express.Router();

router.post('/evaluate', async (req, res) => {
  const { entity_type, entity_id } = req.body || {};
  if (entity_type !== 'loan') {
    return res.status(400).json({ error: 'MVP currently supports entity_type=loan only' });
  }

  const { data: loan, error } = await supabase
    .from('loans')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('id', entity_id)
    .single();

  if (error || !loan) return res.status(404).json({ error: 'Loan not found' });

  const findings = await evaluateLoanPolicies(req.orgId, loan);
  return res.json({ created_count: findings.length, findings });
});

module.exports = router;
