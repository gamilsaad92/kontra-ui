'use strict';

const FINAL_STAGE_PATTERN = /closing|close|funded|funded|settlement|complete|completed|closed|final/i;

function normalizeStageText(stage) {
  return `${stage?.key || ''} ${stage?.label || ''}`.trim().toLowerCase();
}

function stageMatches(candidate, target) {
  const targetKey = String(target?.key || target || '').trim().toLowerCase();
  const targetLabel = String(target?.label || '').trim().toLowerCase();
  return [candidate?.key, candidate?.label, candidate]
    .filter(Boolean)
    .some(value => {
      const normalized = String(value).trim().toLowerCase();
      return normalized === targetKey || normalized === targetLabel;
    });
}

function explicitStageRequirements(item) {
  return [
    item?.requiredForStages,
    item?.required_for_stages,
    item?.gateStages,
    item?.gate_stages,
  ].find(Array.isArray);
}

function isApplicableRequirement(item, nextStage, evidenceSections = []) {
  const explicitStages = explicitStageRequirements(item);
  if (explicitStages) return explicitStages.some(stage => stageMatches(stage, nextStage));
  const targetText = normalizeStageText(nextStage);
  if (FINAL_STAGE_PATTERN.test(targetText)) return true;
  return evidenceSections.includes(String(item?.section || '').toLowerCase());
}

function isSatisfiedField(field) {
  const status = String(field?.status || field?.rawStatus || '').trim().toLowerCase();
  return status === 'confirmed' || status === 'verified' || status === 'not_applicable';
}

function isReceivedDocument(item) {
  const status = String(item?.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return item?.uploaded === true
    || ['uploaded', 'approved', 'ai_complete', 'complete', 'completed', 'processing', 'retrying', 'analyzing', 'received'].includes(status);
}

function getLifecycleTransitionGate({
  stages = [],
  currentStage,
  nextStage,
  requiredDocuments = [],
  receivedDocuments = [],
  reviewDocuments = [],
  requiredFields = [],
  participantStates = [],
  unresolvedConflicts = [],
  requiredApprovals = [],
  recordHydrated = true,
} = {}) {
  const target = nextStage || null;
  if (!target) return { ready: true, eligible: false, nextStage: null, blockers: [] };
  if (!recordHydrated) {
    return {
      ready: false,
      eligible: false,
      nextStage: target,
      blockers: [{
        key: 'record-hydrating',
        text: 'Canonical Transaction Record is still loading',
        detail: 'Complete the remaining required items before advancing.',
      }],
    };
  }

  const evidenceSections = [];
  const missingDocuments = requiredDocuments.filter(item =>
    !receivedDocuments.includes(item) && !isReceivedDocument(item)
  );
  const blockers = [];
  missingDocuments
    .filter(item => isApplicableRequirement(item, target, evidenceSections))
    .forEach(item => blockers.push({
      key: `document-${item.id || item.section || item.label}`,
      text: `${item.label || item.name || 'Required document'} is required before ${target.label || 'the next stage'}`,
      detail: 'This required document has not been received.',
      type: 'document',
      requirement: item,
    }));

  reviewDocuments
    .filter(item => isApplicableRequirement(item, target, evidenceSections))
    .forEach(item => blockers.push({
      key: `document-review-${item.id || item.section || item.label}`,
      text: `${item.label || item.name || 'Required document'} needs review before ${target.label || 'the next stage'}`,
      detail: 'A required document has unresolved review findings.',
      type: 'document_review',
      requirement: item,
    }));

  requiredFields
    .filter(field => field?.required !== false && !isSatisfiedField(field))
    .forEach(field => blockers.push({
      key: `record-${field.key || field.field_key || field.label}`,
      text: `${field.label || field.display_label || field.key || field.field_key || 'Required Transaction Record field'} must be confirmed`,
      detail: 'This required Transaction Record field is not confirmed.',
      type: 'record',
      requirement: field,
    }));

  unresolvedConflicts.forEach(conflict => blockers.push({
    key: `conflict-${conflict.fieldKey || conflict.field_key || conflict.id || conflict.label}`,
    text: `Resolve ${conflict.label || conflict.display_label || conflict.fieldKey || 'the unresolved Transaction Record conflict'}`,
    detail: 'A blocking Transaction Record conflict remains unresolved.',
    type: 'conflict',
    requirement: conflict,
  }));

  const explicitRoles = [
    target.requiredRoles,
    target.requiredRoleKeys,
    target.participantRoles,
  ].find(Array.isArray);
  const rolesToCheck = explicitRoles
    ? participantStates.filter(state => explicitRoles.includes(state.key))
    : FINAL_STAGE_PATTERN.test(normalizeStageText(target))
      ? participantStates.filter(state => state.required)
      : [];
  rolesToCheck
    .filter(state => !state.complete && !state.satisfied)
    .forEach(state => blockers.push({
      key: `participant-${state.key}`,
      text: `${state.label || state.key} must be active before ${target.label || 'the next stage'}`,
      detail: state.invited ? 'This required participant has not completed their required action.' : 'This required participant has not been invited.',
      type: 'participant',
      requirement: state,
    }));

  requiredApprovals
    .filter(approval => !approval?.approved && approval?.status !== 'approved' && approval?.status !== 'confirmed')
    .forEach(approval => blockers.push({
      key: `approval-${approval.key || approval.id || approval.label}`,
      text: `${approval.label || approval.key || 'Required approval'} is still outstanding`,
      detail: 'This configured approval or condition must be completed before advancing.',
      type: 'approval',
      requirement: approval,
    }));

  const deduped = [];
  const seen = new Set();
  blockers.forEach(blocker => {
    if (!seen.has(blocker.key)) {
      seen.add(blocker.key);
      deduped.push(blocker);
    }
  });
  return {
    ready: true,
    eligible: deduped.length === 0,
    nextStage: target,
    blockers: deduped,
  };
}

module.exports = {
  FINAL_STAGE_PATTERN,
  getLifecycleTransitionGate,
  isApplicableRequirement,
};