'use strict';

const JOINED_INVITE_STATUSES = new Set(['accepted', 'joined', 'active']);
const COMPLETE_DOCUMENT_STATUSES = new Set([
  'uploaded', 'approved', 'ai_complete', 'complete', 'completed', 'received',
]);

function normalizeParticipantRole(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function roleIdentitySet(role) {
  return new Set([
    role?.key,
    role?.role_key,
    role?.label,
    role?.shortLabel,
  ].filter(Boolean).map(normalizeParticipantRole));
}

function participantRoleMatches(role, value) {
  return roleIdentitySet(role).has(normalizeParticipantRole(value));
}

function participantDocumentsForRole(role, checklist = []) {
  return (Array.isArray(checklist) ? checklist : []).filter(item => {
    if (!item?.required || item?.notApplicable === true) return false;
    const assignedTo = item.assignedTo || item.assigned_to || [];
    return Array.isArray(assignedTo)
      && assignedTo.some(assignedRole => participantRoleMatches(role, assignedRole));
  });
}

function isCompletedDocument(item) {
  const status = normalizeParticipantRole(
    item?.status || item?.documentStatus || item?.document_state || item?.documentState,
  );
  return item?.uploaded === true
    || item?.uploaded === 'true'
    || COMPLETE_DOCUMENT_STATUSES.has(status);
}

function resolveParticipantCompletion(role, {
  checklist = [],
  invites = [],
  submissions = [],
} = {}) {
  const invite = (Array.isArray(invites) ? invites : []).find(item =>
    participantRoleMatches(role, item?.role_key)
  ) || null;
  const submission = (Array.isArray(submissions) ? submissions : []).find(item =>
    participantRoleMatches(role, item?.role)
  ) || null;
  const assignedDocuments = participantDocumentsForRole(role, checklist);
  const joined = JOINED_INVITE_STATUSES.has(normalizeParticipantRole(invite?.status));
  const unresolvedDocuments = assignedDocuments.filter(item => !isCompletedDocument(item));
  const complete = joined && unresolvedDocuments.length === 0;

  return {
    role: role?.key || role?.role_key || null,
    label: role?.label || role?.shortLabel || role?.key || null,
    status: submission?.status || invite?.status || null,
    inviteStatus: invite?.status || null,
    invited: !!invite,
    joined,
    submissionStatus: submission?.status || null,
    documentCount: Number(submission?.doc_count || 0),
    submittedAt: submission?.submitted_at || null,
    assignedRequiredDocumentCount: assignedDocuments.length,
    completedRequiredDocumentCount: assignedDocuments.length - unresolvedDocuments.length,
    unresolvedRequiredDocumentCount: unresolvedDocuments.length,
    requiredDocumentsComplete: unresolvedDocuments.length === 0,
    complete,
    completionSource: complete
      ? assignedDocuments.length > 0
        ? 'joined_invite_and_assigned_documents'
        : 'joined_invite_no_assigned_required_documents'
      : null,
  };
}

function resolveParticipantCompletions(roles = [], state = {}) {
  return (Array.isArray(roles) ? roles : []).map(role =>
    resolveParticipantCompletion(role, state)
  );
}

module.exports = {
  normalizeParticipantRole,
  participantRoleMatches,
  resolveParticipantCompletion,
  resolveParticipantCompletions,
};