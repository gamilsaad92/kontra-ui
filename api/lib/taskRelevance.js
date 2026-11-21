'use strict';

const { getChecklistItemAssignedRoles } = require('./documentAssignmentAccess');
const {
  documentRequirementMatchesAnalysis,
  projectDocumentChecklist,
} = require('./documentStatus');

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

function checklistSourceId(identity) {
  return `workflow-checklist:${identity}`;
}

function checklistTaskBaseSourceId(task) {
  if (task?.task_type !== 'missing_document' || task?.source_type !== 'workflow_checklist') {
    return null;
  }
  const sourceId = String(task.source_id || '');
  const match = sourceId.match(/^(workflow-checklist:.+?)(?::(?:cycle|evidence):.*)?$/);
  return match?.[1] || null;
}

function taskTimestamp(task) {
  const timestamp = Date.parse(task?.updated_at || task?.resolved_at || task?.created_at || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function analysisTimestamp(analysis) {
  const timestamp = Date.parse(analysis?.created_at || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestByTimestamp(rows = []) {
  return [...rows].sort((a, b) => taskTimestamp(b) - taskTimestamp(a))[0] || null;
}

function latestAnalysisByTimestamp(rows = []) {
  return [...rows].sort((a, b) => analysisTimestamp(b) - analysisTimestamp(a))[0] || null;
}

function evidenceTaskToken(analysis) {
  const token = String(analysis?.id || analysis?.created_at || '').trim();
  return token.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function latestRequirementCandidate(item, documentAnalyses) {
  const candidates = (Array.isArray(documentAnalyses) ? documentAnalyses : [])
    .filter(analysis => documentRequirementMatchesAnalysis(item, analysis));
  return latestAnalysisByTimestamp(candidates);
}

function hasNewEvidenceSinceDismissal(candidate, dismissedTask) {
  const candidateAt = analysisTimestamp(candidate);
  return Boolean(candidate?.id && candidateAt > taskTimestamp(dismissedTask));
}

function checklistCompletionEvidence(item) {
  const label = item.label || item.name || item.section || item.id || 'required document';
  if (item.documentEvidenceType === 'upload_receipt') {
    return `Required document "${label}" was stored and processed in its checklist section. Receipt satisfies this item; its contents were not AI-validated.`;
  }
  if (item.documentEvidenceType === 'ai_classification_match'
    && item.documentAiClassificationValidated === true) {
    return `Required document "${label}" matched the checklist classification and passed classification validation; this does not assert substantive content verification.`;
  }
  if (item.documentEvidenceType === 'legacy_classification') {
    return `Required document "${label}" matched using legacy classification evidence; AI validation is not asserted.`;
  }
  return `Required document "${label}" was recorded as received by the checklist projection; AI validation is not asserted.`;
}

function buildChecklistRequirementPlan({
  room = {},
  checklist = room.checklist_items || [],
  activeAnalyses = [],
  documentAnalyses = activeAnalyses,
  existingTasks = [],
  roleConfig = { roles: [] },
} = {}) {
  const projectedItems = projectDocumentChecklist(checklist, documentAnalyses).items;
  const currentStage = room.deal_stage || null;
  const missing = new Map();
  const satisfied = new Map();

  for (const item of projectedItems) {
    if (!isRequired(item.required)) continue;
    const stage = item.workflow_stage || item.stage_key || item.stageKey || null;
    if (stage && currentStage && normalizedStage(stage) !== normalizedStage(currentStage)) continue;

    const identity = stableChecklistIdentity(item);
    if (!identity) continue;
    const sourceId = checklistSourceId(identity);
    if (item.documentState === 'missing'
      || (item.documentState === 'needs_review' && item.documentReceived !== true)) {
      missing.set(sourceId, {
        item,
        sourceId,
        stage: stage || currentStage,
        candidate: latestRequirementCandidate(item, documentAnalyses),
      });
    } else if (item.documentReceived) {
      satisfied.set(sourceId, {
        documentEvidenceType: item.documentEvidenceType || null,
        documentAiClassificationValidated: item.documentAiClassificationValidated === true,
        completionEvidence: checklistCompletionEvidence(item),
      });
    }
  }

  const generatedTasks = [];
  for (const { item, sourceId, stage, candidate } of missing.values()) {
    if (existingTasks.some(task =>
      task.task_type === 'readiness_document'
        && item.id
        && task.source_document_id === item.id
    )) continue;
    const relatedTasks = existingTasks.filter(task =>
      checklistTaskBaseSourceId(task) === sourceId
    );
    if (relatedTasks.some(task => !['dismissed', 'completed'].includes(task.status))) continue;

    const terminal = latestByTimestamp(
      relatedTasks.filter(task => ['dismissed', 'completed'].includes(task.status)),
    );
    let taskSourceId = sourceId;
    if (terminal?.status === 'dismissed') {
      // Keep a dismissal intact unless a new document version arrived after it.
      // A new invalid version is a new evidence event and deserves a new task.
      if (!hasNewEvidenceSinceDismissal(candidate, terminal)) continue;
      const token = evidenceTaskToken(candidate);
      if (!token) continue;
      taskSourceId = `${sourceId}:evidence:${token}`;
    } else if (terminal?.status === 'completed') {
      // Preserve the historical completed row; use a new idempotent source key
      // for the next actionable cycle if its evidence is no longer valid.
      taskSourceId = `${sourceId}:cycle:${evidenceTaskToken({ id: terminal.id })}`;
    }

    const label = item.label || item.name || item.section || item.id || 'required document';
    const needsReview = item.documentState === 'needs_review';
    const evidence = [needsReview
      ? item.ai === false
        ? `The current upload for "${label}" has not been confirmed as a stored, successfully processed receipt in its required checklist section.`
        : `Current upload for "${label}" is not validated as the required document.`
      : `Active workflow checklist item "${label}" is required but missing.`];
    if (stage) evidence.push(`Workflow stage: ${stage}.`);
    generatedTasks.push({
      taskType: 'missing_document',
      title: needsReview
        ? item.ai === false ? `Complete upload: ${label}` : `Review or replace ${label}`
        : `Upload ${label}`,
      description: needsReview
        ? item.ai === false
          ? `The current upload for "${label}" has not been confirmed as a stored, successfully processed receipt in its required checklist section. Retry or replace the upload.${stage ? ` It is assigned to the ${stage} stage.` : ''}`
          : `The current upload for "${label}" has not passed document validation or its classification does not match. Review it or upload a correctly classified document.${stage ? ` It is assigned to the ${stage} stage.` : ''}`
        : `The active workflow checklist marks "${label}" as required.${stage ? ` It is assigned to the ${stage} stage.` : ''} Upload it in the Documents tab.`,
      ownerType: 'human',
      ownerRole: assignedOwnerRole(item, roleConfig),
      evidence,
      sourceType: 'workflow_checklist',
      sourceId: taskSourceId,
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
    .filter(task => checklistTaskBaseSourceId(task))
    .filter(task => !['dismissed', 'completed'].includes(task.status))
    .filter(task => !missingIds.has(checklistTaskBaseSourceId(task)))
    .map(task => {
      const evidence = satisfied.get(checklistTaskBaseSourceId(task));
      return {
        task,
        status: evidence ? 'completed' : 'dismissed',
        ...(evidence || {}),
      };
    });

  return { create: generatedTasks, resolve, missingSourceIds: [...missingIds] };
}

module.exports = {
  buildChecklistRequirementPlan,
  explicitDigitalAssetChoice,
  filterTasksForRoom,
  isDigitalAssetReadinessApplicable,
  isDigitalAssetReadinessTask,
};
