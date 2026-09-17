'use strict';

const COMPLETE_DOCUMENT_STATUSES = new Set([
  'uploaded', 'approved', 'ai_complete', 'complete', 'completed', 'received',
]);
const ACTIVE_INVITE_STATUSES = new Set([
  'pending', 'invited', 'sent', 'accepted', 'joined', 'active',
]);
const JOINED_INVITE_STATUSES = new Set(['accepted', 'joined', 'active']);
const EXPIRING_INVITE_STATUSES = new Set(['pending', 'invited', 'sent']);

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

function inviteTimestamp(invite) {
  const value = invite?.updated_at
    || invite?.accepted_at
    || invite?.created_at
    || invite?.sent_at
    || invite?.invited_at;
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isUsableParticipantInvite(invite, now = Date.now()) {
  const status = normalizeParticipantRole(invite?.status);
  if (!ACTIVE_INVITE_STATUSES.has(status)) return false;
  if (invite?.revoked_at) return false;
  if (EXPIRING_INVITE_STATUSES.has(status)
    && invite?.expires_at
    && Date.parse(invite.expires_at) <= now) {
    return false;
  }
  return true;
}

/**
 * Pick one current invite for a role. A joined state wins over historical
 * pending invitations; within the same state, the most recently updated
 * invite wins.
 */
function selectParticipantInvite(role, invites = [], now = Date.now()) {
  return (Array.isArray(invites) ? invites : [])
    .map((invite, index) => ({ invite, index }))
    .filter(({ invite }) =>
      participantRoleMatches(role, invite?.role_key)
      && isUsableParticipantInvite(invite, now)
    )
    .sort((left, right) => {
      const leftStatus = normalizeParticipantRole(left.invite?.status);
      const rightStatus = normalizeParticipantRole(right.invite?.status);
      const joinedDifference = Number(JOINED_INVITE_STATUSES.has(rightStatus))
        - Number(JOINED_INVITE_STATUSES.has(leftStatus));
      if (joinedDifference !== 0) return joinedDifference;

      const timestampDifference = inviteTimestamp(right.invite) - inviteTimestamp(left.invite);
      if (timestampDifference !== 0) return timestampDifference;

      const idDifference = String(right.invite?.id || '').localeCompare(
        String(left.invite?.id || ''),
      );
      return idDifference || left.index - right.index;
    })
    .map(({ invite }) => invite)[0] || null;
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
  const invite = selectParticipantInvite(role, invites);
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
  selectParticipantInvite,
  resolveParticipantCompletion,
  resolveParticipantCompletions,
};