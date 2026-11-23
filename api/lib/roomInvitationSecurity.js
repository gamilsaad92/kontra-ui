'use strict';

const crypto = require('node:crypto');
const { DEFAULT_PACK_ID, getPackRoleConfig } = require('./dealRoomHelpers');

const RESERVED_ROLE_KEYS = new Set([
  '__room_owner__',
  '__owner__',
  'owner',
  'workspace_owner',
  'room_owner',
  'admin',
  'administrator',
  'workspace_admin',
  'room_admin',
  'deal_owner',
  'coordinator',
  'deal_coordinator',
  'transaction_coordinator',
]);
const INVITE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function validateParticipantInviteRole(roleKey, roleDefinitions = []) {
  if (typeof roleKey !== 'string') return { ok: false, error: 'invalid_role' };
  const normalizedRoleKey = roleKey.trim().toLowerCase();
  if (RESERVED_ROLE_KEYS.has(normalizedRoleKey)) {
    return { ok: false, error: 'reserved_role' };
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalizedRoleKey)) {
    return { ok: false, error: 'invalid_role' };
  }

  const configuredRole = roleDefinitions.find(
    role => String(role?.key || '').trim().toLowerCase() === normalizedRoleKey,
  );
  if (configuredRole && (
    configuredRole.invitable !== true
    || configuredRole.canManage === true
    || configuredRole.legacyOnly === true
    || configuredRole.isCoordinator === true
    || configuredRole.coordinator === true
  )) {
    return { ok: false, error: 'reserved_role' };
  }

  // Unknown valid keys are intentional custom participant roles. The UI lets
  // owners create these, but the reserved keys and configured owner roles above
  // can never be used to grant owner privileges.
  return { ok: true, roleKey: normalizedRoleKey };
}

async function loadInviteRoleDefinitions(client, packId) {
  const normalizedPackId = String(packId || DEFAULT_PACK_ID);
  if (normalizedPackId.startsWith('ws_')) {
    const { data, error } = await client
      .from('custom_workflow_packs')
      .select('config')
      .eq('id', normalizedPackId)
      .maybeSingle();
    if (error) throw error;
    if (!Array.isArray(data?.config?.roles)) {
      throw Object.assign(new Error('Custom workflow roles are unavailable'), {
        code: 'WORKFLOW_ROLES_UNAVAILABLE',
      });
    }
    return data.config.roles;
  }

  const roles = getPackRoleConfig(normalizedPackId)?.roles;
  if (!Array.isArray(roles)) {
    throw Object.assign(new Error('Workflow roles are unavailable'), {
      code: 'WORKFLOW_ROLES_UNAVAILABLE',
    });
  }
  return roles;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function invalidateSession(client, sessionHash, now) {
  return client
    .from('deal_room_access_sessions')
    .update({ revoked_at: now })
    .eq('session_token_hash', sessionHash)
    .is('revoked_at', null);
}

async function redeemRoomInvite(client, {
  propertyId,
  inviteToken,
  now = new Date(),
  createSessionToken = () => crypto.randomBytes(32).toString('hex'),
  validateRole = roleKey => validateParticipantInviteRole(roleKey, []),
}) {
  if (typeof inviteToken !== 'string' || !/^[a-f0-9]{48,128}$/i.test(inviteToken.trim())) {
    return { ok: false, error: 'invalid_token', status: 400 };
  }
  const currentTime = now instanceof Date ? now : new Date(now);
  const nowIso = currentTime.toISOString();
  const { data: invite, error: inviteError } = await client
    .from('deal_room_invites')
    .select('id, property_id, role_key, status, verification_method, expires_at, locked_until, revoked_at')
    .eq('invite_token_hash', tokenHash(inviteToken.trim()))
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) return { ok: false, error: 'not_found', status: 404 };
  if (invite.property_id !== propertyId) return { ok: false, error: 'wrong_room', status: 403 };
  const roleValidation = await validateRole(invite.role_key);
  if (!roleValidation?.ok) {
    return { ok: false, error: 'reserved_role', status: 403 };
  }
  if (invite.status === 'revoked' || invite.revoked_at) {
    return { ok: false, error: 'revoked', status: 403 };
  }
  if (invite.status === 'expired') return { ok: false, error: 'expired', status: 403 };
  if (invite.expires_at) {
    const expiry = new Date(invite.expires_at);
    if (Number.isNaN(expiry.getTime()) || expiry <= currentTime) {
      return { ok: false, error: 'expired', status: 403 };
    }
  }
  if (invite.locked_until && new Date(invite.locked_until) > currentTime) {
    return { ok: false, error: 'locked', status: 403, locked_until: invite.locked_until };
  }
  if (invite.verification_method !== 'link') {
    return { ok: false, error: 'requires_pin', status: 400 };
  }
  if (invite.status !== 'pending') {
    return { ok: false, error: 'already_used', status: 409 };
  }

  const sessionToken = createSessionToken();
  const sessionHash = tokenHash(sessionToken);
  const sessionExpiry = new Date(currentTime.getTime() + INVITE_SESSION_TTL_MS);
  if (invite.expires_at) {
    const inviteExpiry = new Date(invite.expires_at);
    if (inviteExpiry < sessionExpiry) sessionExpiry.setTime(inviteExpiry.getTime());
  }
  const expiresAt = sessionExpiry.toISOString();
  const { error: sessionError } = await client
    .from('deal_room_access_sessions')
    .insert({
      invite_id: invite.id,
      session_token_hash: sessionHash,
      expires_at: expiresAt,
    });
  if (sessionError) throw sessionError;

  // The session is not usable while the invite is pending. Claim the invite
  // with a conditional update so concurrent link redemptions cannot both win.
  const { data: acceptedInvite, error: acceptanceError } = await client
    .from('deal_room_invites')
    .update({ status: 'accepted', accepted_at: nowIso, last_used_at: nowIso })
    .eq('id', invite.id)
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (acceptanceError || !acceptedInvite) {
    const { error: cleanupError } = await invalidateSession(client, sessionHash, nowIso);
    return {
      ok: false,
      error: acceptanceError
        ? (cleanupError ? 'acceptance_and_session_cleanup_failed' : 'acceptance_failed')
        : (cleanupError ? 'invite_used_session_cleanup_failed' : 'already_used'),
      status: acceptanceError ? 500 : 409,
      inviteAccepted: false,
      sessionInvalidated: !cleanupError,
    };
  }

  return {
    ok: true,
    sessionToken,
    expiresAt,
    roleKey: invite.role_key,
  };
}

async function revokeRoomInvite(client, {
  propertyId,
  inviteId,
  now = new Date(),
}) {
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const { data: invite, error: lookupError } = await client
    .from('deal_room_invites')
    .select('id, property_id, role_key')
    .eq('id', inviteId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!invite) return { ok: false, error: 'not_found', status: 404 };

  const { data: revokedInvite, error: inviteError } = await client
    .from('deal_room_invites')
    .update({ status: 'revoked', revoked_at: nowIso })
    .eq('id', inviteId)
    .eq('property_id', propertyId)
    .select('id')
    .maybeSingle();
  if (inviteError) {
    return { ok: false, error: 'invite_revoke_failed', status: 500 };
  }
  if (!revokedInvite) return { ok: false, error: 'not_found', status: 404 };

  const { data: sessions, error: sessionsError } = await client
    .from('deal_room_access_sessions')
    .update({ revoked_at: nowIso })
    .eq('invite_id', inviteId)
    .is('revoked_at', null)
    .select('id');
  if (sessionsError) {
    // The invite is already revoked, so the shared resolver denies its
    // sessions even if this cleanup needs a retry.
    return { ok: false, error: 'session_revoke_failed', status: 500, inviteRevoked: true };
  }

  return {
    ok: true,
    inviteId,
    sessionsRevoked: Array.isArray(sessions) ? sessions.length : 0,
  };
}

module.exports = {
  INVITE_SESSION_TTL_MS,
  loadInviteRoleDefinitions,
  redeemRoomInvite,
  revokeRoomInvite,
  validateParticipantInviteRole,
};
