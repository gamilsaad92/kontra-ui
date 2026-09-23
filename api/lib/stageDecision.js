'use strict';

const RESOLVED_RECORD_STATUSES = new Set(['confirmed', 'verified', 'approved']);
const FINAL_STAGE_PATTERN = /closing|close|funded|fund|settlement|complete|completed/i;
const DIGITAL_ASSET_READINESS_VALUES = new Set([
  'readiness',
  'readiness_setup',
  'readiness_document',
  'digital_asset',
  'digital_asset_preparation',
  'digital_asset_readiness',
  'token_preparation',
  'tokenization_readiness',
]);
const PARTICIPANT_SUBMISSION_TASK_TYPES = new Set([
  'missing_participant',
  'pending_submission',
  'party_role',
  'party_submission',
]);

function normalizedStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function itemIdentityValues(item) {
  return [
    item?.id,
    item?.section,
    item?.category,
    item?.label,
    item?.name,
  ].filter(Boolean).map(value => String(value).trim().toLowerCase());
}

function requiredStageItems(stage) {
  return [
    ...(Array.isArray(stage?.requiredDocuments) ? stage.requiredDocuments : []),
    ...(Array.isArray(stage?.requiredDocumentSections) ? stage.requiredDocumentSections : []),
    ...(Array.isArray(stage?.requiredDocumentIds) ? stage.requiredDocumentIds : []),
  ];
}

function findChecklistItem(checklist, requirement) {
  const target = String(requirement?.id || requirement?.section || requirement?.label || requirement || '')
    .trim()
    .toLowerCase();
  if (!target) return null;
  return (Array.isArray(checklist) ? checklist : []).find(item =>
    itemIdentityValues(item).includes(target)
  ) || null;
}

function isChecklistItemReceived(item) {
  return item?.documentReceived === true
    || item?.uploaded === true
    || ['uploaded', 'processing', 'retrying', 'analyzing', 'analyzed', 'complete', 'completed', 'approved', 'received']
      .includes(normalizedStatus(item?.status));
}

function isDigitalAssetReadinessBlocker(blocker) {
  return [
    blocker?.taskSourceType,
    blocker?.taskCategory,
    blocker?.taskType,
    blocker?.taskApplicability,
  ].some(value => DIGITAL_ASSET_READINESS_VALUES.has(normalizedStatus(value)));
}

function participantSubmissionIdentity(blocker) {
  if (blocker?.sourceType === 'required_participant' && blocker?.role) {
    return `participant_submission:${normalizedStatus(blocker.role)}`;
  }
  if (blocker?.sourceType !== 'explicit_blocking_task' || !blocker?.participantRole) {
    return null;
  }
  const taskType = normalizedStatus(blocker.taskType);
  const taskSourceType = normalizedStatus(blocker.taskSourceType);
  if (!PARTICIPANT_SUBMISSION_TASK_TYPES.has(taskType)
    && !PARTICIPANT_SUBMISSION_TASK_TYPES.has(taskSourceType)) {
    return null;
  }
  return `participant_submission:${normalizedStatus(blocker.participantRole)}`;
}

function buildStageDecision({
  lifecycle = {},
  checklist = [],
  recordState = {},
  readiness = {},
  groundedBlockers = [],
  packId = null,
}) {
  const stages = Array.isArray(lifecycle.stages) ? lifecycle.stages : [];
  const currentStageKey = lifecycle.currentStageKey || null;
  const currentIndex = stages.findIndex(stage => stage?.key === currentStageKey);
  const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] || null : null;

  if (lifecycle.entryMode === 'previously_completed' || lifecycle.historical === true) {
    return {
      currentStage: stages[currentIndex] || { key: 'historical_verification', label: 'Historical verification' },
      currentStageKey: currentStageKey || 'historical_verification',
      nextStage: null,
      recommendationAllowed: false,
      status: 'historical_verification',
      blockers: [],
      reason: 'This previously completed room is in historical verification. Review and confirm evidence-backed facts; it cannot advance through the active transaction lifecycle.',
      basis: {},
    };
  }

  const blockers = [];
  const semanticBlockerIdentities = new Set();
  const addBlocker = (key, label, detail, sourceType, extra = {}) => {
    if (!key || blockers.some(blocker => blocker.key === key)) return;
    const semanticIdentity = extra.semanticIdentity || null;
    if (semanticIdentity && semanticBlockerIdentities.has(semanticIdentity)) return;
    if (semanticIdentity) semanticBlockerIdentities.add(semanticIdentity);
    const { semanticIdentity: _ignored, ...publicExtra } = extra;
    blockers.push({ key, label, detail, sourceType, ...publicExtra });
  };

  if (!nextStage) {
    return {
      currentStage: stages[currentIndex] || null,
      currentStageKey,
      nextStage: null,
      recommendationAllowed: false,
      status: 'no_next_stage',
      blockers: [],
      reason: 'The current workflow stage has no later stage configured.',
      basis: {},
    };
  }

  const requiredDocuments = (Array.isArray(checklist) ? checklist : [])
    .filter(item => item?.required && normalizedStatus(item?.status) !== 'not_applicable'
      && item?.notApplicable !== true);
  const missingDocuments = requiredDocuments.filter(item =>
    item?.documentState === 'missing' || !isChecklistItemReceived(item)
  );
  const reviewDocuments = requiredDocuments.filter(item =>
    item?.documentState === 'needs_review' || item?.documentNeedsReview === true
  );

  missingDocuments.forEach(item => addBlocker(
    `required-document:${item.id || item.section || item.label}`,
    item.label || item.name || item.section || 'Required document',
    'A required room document has not been received.',
    'required_document',
    { documentId: item.id || null, section: item.section || null },
  ));
  reviewDocuments.forEach(item => addBlocker(
    `document-review:${item.id || item.section || item.label}`,
    item.label || item.name || item.section || 'Required document',
    'A required room document is received but still needs coordinator review.',
    'document_review',
    { documentId: item.id || null, section: item.section || null },
  ));

  requiredStageItems(nextStage).forEach(requirement => {
    const item = findChecklistItem(checklist, requirement);
    if (!item || !isChecklistItemReceived(item)) {
      const label = item?.label || item?.name || requirement?.label || requirement?.id
        || requirement?.section || requirement;
      addBlocker(
        `stage-document:${String(requirement?.id || requirement?.section || label).toLowerCase()}`,
        label,
        `This workflow-specific document condition is required before ${nextStage.label || nextStage.key}.`,
        'stage_condition',
      );
    }
  });

  const requiredFields = Array.isArray(recordState.requiredFields)
    ? recordState.requiredFields
    : [];
  const unresolvedRequiredFields = requiredFields.filter(field =>
    !RESOLVED_RECORD_STATUSES.has(normalizedStatus(field?.status))
    && normalizedStatus(field?.status) !== 'not_applicable'
  );
  unresolvedRequiredFields.forEach(field => addBlocker(
    `record-field:${field.key || field.fieldKey || field.label}`,
    field.label || field.key || 'Required Transaction Record field',
    field.attention === 'source_changed'
      ? 'A newer source changed this required recorded fact and it needs coordinator review.'
      : `The required recorded fact is ${normalizedStatus(field.status) || 'incomplete'}.`,
    'transaction_record',
    { fieldKey: field.key || field.fieldKey || null, status: field.status || null },
  ));

  if (Number(recordState.conflictRequiredCount || 0) > 0 && unresolvedRequiredFields.length === 0) {
    addBlocker(
      'required-record-conflicts',
      'Required Transaction Record conflicts',
      'Resolve the remaining required Transaction Record conflicts before advancing.',
      'transaction_record_conflict',
    );
  }

  (Array.isArray(groundedBlockers) ? groundedBlockers : [])
    .filter(blocker => ['required_participant', 'explicit_blocking_task'].includes(blocker?.sourceType))
    .filter(blocker => !isDigitalAssetReadinessBlocker(blocker))
    .forEach(blocker => {
      const participantIdentity = participantSubmissionIdentity(blocker);
      addBlocker(
        `${blocker.sourceType}:${blocker.role || blocker.taskId || blocker.key || blocker.label}`,
        blocker.label || blocker.key || 'Workflow blocker',
        Array.isArray(blocker.evidence) && blocker.evidence.length > 0
          ? blocker.evidence[0]
          : 'This live workflow blocker must be resolved before advancing.',
        blocker.sourceType,
        {
          role: blocker.role || blocker.participantRole || null,
          taskId: blocker.taskId || null,
          semanticIdentity: participantIdentity,
        },
      );
    });

  if (readiness?.approvalReady === false && Number(recordState.conflictRequiredCount || 0) === 0) {
    addBlocker(
      'approval-readiness',
      'Approval readiness',
      readiness.approvalBlockedReason || 'Approval readiness has not been reached.',
      'readiness',
    );
  }

  const nextStageText = `${nextStage.key || ''} ${nextStage.label || ''}`;
  const tokenizationWorkflow = String(packId || '').toLowerCase() === 'tokenization';
  if (tokenizationWorkflow
    && /issuance|secondary|distribution|launch/i.test(nextStageText)
    && readiness?.digitalAssetSufficient === false) {
    addBlocker(
      'digital-asset-readiness',
      'Digital asset preparation',
      'The applicable digital-asset preparation conditions are not complete for this workflow stage.',
      'readiness',
    );
  }

  if (FINAL_STAGE_PATTERN.test(nextStageText) && readiness?.fundReleaseReady === false) {
    addBlocker(
      'fund-release-readiness',
      'Closing readiness',
      readiness.fundReleaseBlockedReason || 'Closing readiness conditions are not complete.',
      'readiness',
    );
  }

  const recommendationAllowed = blockers.length === 0;
  const blockerLabels = blockers.slice(0, 5).map(blocker => blocker.label);
  return {
    currentStage: stages[currentIndex] || null,
    currentStageKey,
    nextStage,
    recommendationAllowed,
    status: recommendationAllowed ? 'ready' : 'blocked',
    blockers,
    reason: recommendationAllowed
      ? `The canonical requirements for ${nextStage.label || nextStage.key} are satisfied.`
      : `Do not advance to ${nextStage.label || nextStage.key} yet. Resolve: ${blockerLabels.join(', ')}.`,
    basis: {
      requiredDocumentCount: requiredDocuments.length,
      missingDocumentCount: missingDocuments.length,
      reviewDocumentCount: reviewDocuments.length,
      requiredRecordCount: requiredFields.length,
      unresolvedRequiredRecordCount: unresolvedRequiredFields.length,
      readinessOverall: readiness?.overall ?? null,
    },
  };
}

module.exports = {
  buildStageDecision,
  isDigitalAssetReadinessBlocker,
  isChecklistItemReceived,
  participantSubmissionIdentity,
  normalizedStatus,
};