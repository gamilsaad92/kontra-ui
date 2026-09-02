'use strict';

function remediationSourceId(fieldKey, stateVersion = 'schema') {
  return `transaction-record-required:${fieldKey}:${stateVersion}`;
}

function buildRecordRemediationTask(field) {
  const label = field.label || field.key;
  return {
    taskType: 'missing_required_record_field',
    title: `Provide ${label}`,
    description: `The required Transaction Record field "${label}" is missing. Add the value from an authoritative source, then confirm it.`,
    ownerType: 'human',
    ownerRole: 'owner',
    evidence: [`Transaction Record field "${field.key}" is required and currently missing.`],
    sourceType: 'transaction_record',
    sourceId: remediationSourceId(field.key, field.updatedAt || field.updated_at || 'schema'),
    category: 'transaction_record',
    severity: 'high',
    blocking: true,
  };
}

function getRecordRemediationPlan(recordState, existingTasks = []) {
  const requiredMissing = (recordState?.requiredFields || []).filter(field => field.status === 'missing');
  const expected = new Map(requiredMissing.map(field => [
    remediationSourceId(field.key),
    buildRecordRemediationTask(field),
  ]));
  const recordTasks = existingTasks.filter(task =>
    task.task_type === 'missing_required_record_field'
  );
  const upsert = [];
  for (const task of expected.values()) {
    const existing = recordTasks.find(candidate => candidate.source_id === task.sourceId);
    upsert.push({ task, existing: existing || null });
  }
  const dismiss = recordTasks.filter(task =>
    !expected.has(task.source_id) && !['dismissed', 'completed'].includes(task.status)
  );
  return { upsert, dismiss };
}

module.exports = {
  buildRecordRemediationTask,
  getRecordRemediationPlan,
  remediationSourceId,
};