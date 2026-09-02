const { supabase } = require('../db');
const { evaluateConditions } = require('./policyEvaluator');
const { applyActions } = require('./policyApply');

async function evaluateLoanPolicies(org_id, loan) {
  const { data: versions, error } = await supabase
    .from('policy_rule_versions')
    .select('*, policy_rules!inner(id, pack_id, name, applies_to)')
    .eq('org_id', org_id)
    .eq('status', 'active');

  if (error) throw error;

  const ctx = { loan };
  const results = [];

  for (const v of versions || []) {
    const appliesTo = v?.policy_rules?.applies_to;
    if (appliesTo && appliesTo !== 'loan') continue;

    const hit = evaluateConditions(ctx, v.conditions || {});
    if (!hit) continue;

    const { data: existing } = await supabase
      .from('compliance_findings')
      .select('id,status')
      .eq('org_id', org_id)
      .eq('entity_type', 'loan')
      .eq('entity_id', loan.id)
      .eq('rule_version_id', v.id)
      .in('status', ['open', 'in_progress'])
      .limit(1);

    if (existing && existing.length > 0) continue;

    const rule = v.policy_rules;
    const details = {
      rule_name: rule?.name,
      inputs_snapshot: {
        risk_rating: loan.risk_rating,
        special_product: loan.special_product,
      },
      conditions: v.conditions,
      actions: v.actions,
    };

    const finding = await applyActions({
      org_id,
      pack_id: rule?.pack_id || null,
      rule_id: rule?.id,
      rule_version_id: v.id,
      entity_type: 'loan',
      entity_id: loan.id,
      severityDefault: v.severity,
      actions: v.actions || [],
      details,
    });

    results.push(finding);
  }

  return results;
}

module.exports = {
  evaluateLoanPolicies,
};
