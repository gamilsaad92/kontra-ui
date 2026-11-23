'use strict';

const crypto = require('node:crypto');
const {
  resolveExplicitParticipantAccess,
  resolveOwnerSessionAccess,
} = require('./explicitParticipantAccess');

const OWNER_SESSION_COOKIE = 'kontra_owner_session';
const OWNER_ROLE_KEY = '__room_owner__';

function readOwnerSessionCookie(req) {
  const cookieHeader = req?.headers?.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== OWNER_SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function loadSessionAndInvite(client, tokenHash) {
  const { data: session } = await client
    .from('deal_room_access_sessions')
    .select('invite_id, expires_at, revoked_at')
    .eq('session_token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .maybeSingle();
  let invite = null;
  if (session?.invite_id) {
    const result = await client
      .from('deal_room_invites')
      .select('property_id, role_key, invited_email, status, expires_at, revoked_at')
      .eq('id', session.invite_id)
      .maybeSingle();
    invite = result.data;
  }
  return { session, invite };
}

async function resolveRoomSessionAccess(req, propertyId, client, {
  ownerRoleKey = OWNER_ROLE_KEY,
} = {}) {
  const participantToken = String(req?.headers?.['x-kontra-session'] || '').trim();
  if (participantToken) {
    const { session, invite } = await loadSessionAndInvite(client, sha256(participantToken));
    const participantAccess = resolveExplicitParticipantAccess({
      sessionToken: participantToken,
      session,
      invite,
      propertyId,
      ownerRoleKey,
    });
    if (participantAccess) return participantAccess;
  }

  const ownerCookieToken = readOwnerSessionCookie(req);
  if (ownerCookieToken) {
    const { session, invite } = await loadSessionAndInvite(client, sha256(ownerCookieToken));
    const ownerAccess = resolveOwnerSessionAccess({
      cookieToken: ownerCookieToken,
      session,
      invite,
      propertyId,
      ownerRoleKey,
    });
    if (ownerAccess) return ownerAccess;
  }

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

module.exports = {
  OWNER_ROLE_KEY,
  OWNER_SESSION_COOKIE,
  readOwnerSessionCookie,
  resolveRoomSessionAccess,
};
