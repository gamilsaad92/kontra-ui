'use strict';

const PARTICIPANT_PERMISSIONS = Object.freeze({
  viewOverview: true,
  viewAssignedDocuments: true,
  uploadAssignedDocuments: true,
  viewAllDocuments: false,
  manageStages: false,
  manageParticipants: false,
  manageSettings: false,
  updateOwnSubmission: true,
});

const OWNER_PERMISSIONS = Object.freeze({
  viewOverview: true,
  viewAssignedDocuments: true,
  uploadAssignedDocuments: true,
  viewAllDocuments: true,
  manageStages: true,
  manageParticipants: true,
  manageSettings: true,
  updateOwnSubmission: true,
});

function anonymousAccess(propertyId) {
  return {
    mode: 'anonymous',
    role: 'guest',
    roomId: propertyId,
    actorType: 'anonymous',
    permissions: {
      viewOverview: true,
      viewAssignedDocuments: false,
      uploadAssignedDocuments: false,
      viewAllDocuments: false,
      manageStages: false,
      manageParticipants: false,
      manageSettings: false,
      updateOwnSubmission: false,
    },
  };
}

function resolveExplicitParticipantAccess({
  sessionToken,
  session,
  invite,
  propertyId,
  now = new Date(),
}) {
  if (!sessionToken) return null;
  const nowDate = now instanceof Date ? now : new Date(now);
  const invalidSession = !session?.invite_id || session.revoked_at || !session.expires_at
    || new Date(session.expires_at) <= nowDate;
  const invalidInvite = !invite || invite.property_id !== propertyId
    || invite.revoked_at || ['revoked', 'expired'].includes(invite.status)
    || (invite.expires_at && new Date(invite.expires_at) <= nowDate);
  if (invalidSession || invalidInvite) return anonymousAccess(propertyId);
  return {
    mode: 'participant',
    role: invite.role_key,
    actorId: session.invite_id,
    email: invite.invited_email || null,
    roomId: propertyId,
    actorType: 'participant',
    permissions: PARTICIPANT_PERMISSIONS,
  };
}

function resolveOwnerSessionAccess({ cookieToken, session, invite, propertyId, ownerRoleKey, now = new Date() }) {
  if (!cookieToken) return null;
  const nowDate = now instanceof Date ? now : new Date(now);
  const invalidSession = !session?.invite_id || session.revoked_at || !session.expires_at
    || new Date(session.expires_at) <= nowDate;
  const invalidInvite = !invite || invite.property_id !== propertyId
    || invite.role_key !== ownerRoleKey || invite.revoked_at
    || ['revoked', 'expired'].includes(invite.status)
    || (invite.expires_at && new Date(invite.expires_at) <= nowDate);
  if (invalidSession || invalidInvite) return null;
  return {
    mode: 'owner',
    role: 'owner',
    actorId: invite.invited_email || propertyId,
    email: invite.invited_email || null,
    roomId: propertyId,
    actorType: 'owner',
    permissions: OWNER_PERMISSIONS,
  };
}

module.exports = { resolveExplicitParticipantAccess, resolveOwnerSessionAccess };
