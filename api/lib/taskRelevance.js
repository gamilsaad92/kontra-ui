'use strict';

const { getChecklistItemAssignedRoles } = require('./documentAssignmentAccess');
const { projectDocumentChecklist } = require('./documentStatus');

const TOKENIZATION_TYPES = new Set([
  'tokenization',
  'token_issuance',
  'security_token',
  'sto',
  'digital_asset',
]);

function normalizedType(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function explicitDigitalAssetChoice(metadata = {}) {
  const value = metadata.digital_asset_enabled;
  if (value === true || String(value || '').trim().toLowerCase() === 'true') return true;
  if (value === false || String(value || '').trim().toLowerCase() === 'false') return false;
  return null;
}

function isDigitalAssetReadinessApplicable(room, customPackConfig = null) {
  const metadata = room?.metadata_values || {};
  const explicitChoice = explicitDigitalAssetChoice(metadata);
  if (explicitChoice !== null) return explicitChoice;

  return [
    room?.workflow_pack_id,
    room?.deal_type,
    room?.transaction_type,
    customPackConfig?.transactionType,
  ].some(value => TOKENIZATION_TYPES.has(normalizedType(value)));
}

function isDigitalAssetReadinessTask(task) {
  return task?.source_type === 'readiness'
    || task?.category === 'readiness'
    || ['readiness_setup', 'readiness_document'].includes(task?.task_type);
}

function filterTasksForRoom(tasks, room, customPackConfig = null) {
  const rows = Array.isArray(tasks) ? tasks : [];
  if (isDigitalAssetReadinessApplicable(room, customPackConfig)) return rows;
  return rows.filter(task => !isDigitalAssetReadinessTask(task));
}

function isRequired(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function stableChecklistIdentity(item) {
  const value = item?.id || item?.document_id || item?.documentId || item?.section || item?.label || item?.name;
  return String(value || '').trim().slice(0, 180);
}

function normalizedStage(value) {
  return normalizedType(value);
}

function assignedOwnerRole(item, roleConfig) {
  const validRoles = new Set((roleConfig?.roles || []).map(role => String(role.key || '').trim()));
  const assigned = getChecklistItemAssignedRoles(item, null, null);
  return assigned
    .filter(role => typeof role === 'string')
    .map(role => role.trim())
    .find(role => role === 'owner' || validRoles.has(role)) || 'owner';
}

function buildChecklistRequirementPlan({
  room = {},
  checklist = room.checklist_items || [],
  activeAnalyses = [],
  existingTasks = [],
  roleConfig = { roles: [] },
} = {}) {
  const projectedItems = projectDocumentChecklist(checklist, activeAnalyses).items;
  const currentStage = room.deal_stage || null;
  const missing = new Map();
  const satisfied = new Set();

  for (const item of projectedItems) {
    if (!isRequired(item.required)) continue;
    const stage = item.workflow_stage || item.stage_key || item.stageKey || null;
    if (stage && currentStage && normalizedStage(stage) !== normalizedStage(currentStage)) continue;

    const identity = stableChecklistIdentity(item);
    if (!identity) continue;
    const sourceId = `workflow-checklist:${identity}`;
    if (item.documentState === 'missing') {
      missing.set(sourceId, { item, sourceId, stage: stage || currentStage });
    } else if (item.documentReceived) {
      satisfied.add(sourceId);
    }
  }

  const generatedTasks = [];
  for (const { item, sourceId, stage } of missing.values()) {
    const alreadyExists = existingTasks.some(task =>
      (task.task_type === 'missing_document'
        && task.source_type === 'workflow_checklist'
        && task.source_id === sourceId)
        || (task.task_type === 'readiness_document'
          && item.id
          && task.source_document_id === item.id)
    );
    if (alreadyExists) continue;

    const label = item.label || item.name || item.section || item.id || 'required document';
    const evidence = [`Active workflow checklist item "${label}" is required but missing.`];
    if (stage) evidence.push(`Workflow stage: ${stage}.`);
    generatedTasks.push({
      taskType: 'missing_document',
      title: `Upload ${label}`,
      description: `The active workflow checklist marks "${label}" as required.${stage ? ` It is assigned to the ${stage} stage.` : ''} Upload it in the Documents tab.`,
      ownerType: 'human',
      ownerRole: assignedOwnerRole(item, roleConfig),
      evidence,
      sourceType: 'workflow_checklist',
      sourceId,
      sourceDocumentId: item.id || item.document_id || item.documentId || null,
      category: 'document',
      blocking: item.blocking === true,
      severity: ['critical', 'high', 'medium', 'low'].includes(String(item.priority || '').toLowerCase())
        ? String(item.priority).toLowerCase()
        : item.blocking === true ? 'high' : 'medium',
    });
  }

  const missingIds = new Set(missing.keys());
  const resolve = existingTasks
    .filter(task => task.task_type === 'missing_document' && task.source_type === 'workflow_checklist')
    .filter(task => !['dismissed', 'completed'].includes(task.status))
    .filter(task => !missingIds.has(task.source_id))
    .map(task => ({
      task,
      status: satisfied.has(task.source_id) ? 'completed' : 'dismissed',
    }));

  return { create: generatedTasks, resolve, missingSourceIds: [...missingIds] };
}

module.exports = {
  buildChecklistRequirementPlan,
  explicitDigitalAssetChoice,
  filterTasksForRoom,
  isDigitalAssetReadinessApplicable,
  isDigitalAssetReadinessTask,
};
