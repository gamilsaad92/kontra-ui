const { supabase } = require('../db');
const { computeDueDate } = require('./policyEvaluator');

async function applyActions(args) {
  const { org_id, pack_id, rule_id, rule_version_id, entity_type, entity_id, actions, details, severityDefault } = args;

  let dueDate = null;
  let findingTitle = 'Compliance requirement triggered';
  let findingSeverity = severityDefault || 'medium';
  const tasks = [];
  const requiredArtifacts = [];
  const blocks = [];

  for (const a of actions || []) {
    if (a.type === 'set_due_date') dueDate = computeDueDate(a) || dueDate;
    if (a.type === 'create_finding') {
      if (a.title) findingTitle = a.title;
      if (a.severity) findingSeverity = a.severity;
    }
    if (a.type === 'create_task') tasks.push(a);
    if (a.type === 'require_artifact') requiredArtifacts.push(...(a.items || []));
    if (a.type === 'block_action') blocks.push(a);
  }

  const { data: finding, error: fErr } = await supabase
    .from('compliance_findings')
    .insert({
      org_id,
      entity_type,
      entity_id,
      pack_id,
      rule_id,
      rule_version_id,
      status: 'open',
      severity: findingSeverity,
      title: findingTitle,
      details: { ...details, required_artifacts: requiredArtifacts, blocks },
      due_date: dueDate,
    })
    .select('*')
    .single();

  if (fErr) throw fErr;

  for (const t of tasks) {
    const taskDue = t.sla_days
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + Number(t.sla_days));
          return d.toISOString().slice(0, 10);
        })()
      : dueDate;

    await supabase.from('compliance_tasks').insert({
      org_id,
      finding_id: finding.id,
      title: t.title || 'Compliance task',
      status: 'open',
      due_date: taskDue,
      required_artifacts: t.required_artifacts || requiredArtifacts || [],
      notes: t.notes || null,
    });
  }

  return finding;
}

module.exports = {
  applyActions,
};
