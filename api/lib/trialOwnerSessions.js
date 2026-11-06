'use strict';

const crypto = require('node:crypto');

const OWNER_ROLE_KEY = '__room_owner__';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const EXCHANGE_TTL_MS = 15 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function createTrialOwnerExchange(client, propertyId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + EXCHANGE_TTL_MS).toISOString();
  const { error } = await client.from('deal_room_invites').insert({
    property_id: propertyId,
    role_key: OWNER_ROLE_KEY,
    invited_email: email || null,
    invite_token_hash: tokenHash,
    verification_method: 'pin',
    pin_hash: tokenHash,
    status: 'pending',
    expires_at: expiresAt,
    created_by: email || null,
  });
  if (error) throw error;
  return token;
}

async function exchangeTrialOwnerCredential(client, { propertyId, token, now = new Date() }) {
  if (typeof token !== 'string' || token.length < 32) return { ok: false };
  const { data: invite, error: findError } = await client
    .from('deal_room_invites')
    .select('id, property_id, role_key, status, expires_at')
    .eq('invite_token_hash', sha256(token))
    .maybeSingle();
  if (findError) throw findError;
  if (!invite || invite.property_id !== propertyId || invite.role_key !== OWNER_ROLE_KEY
    || invite.status !== 'pending' || !invite.expires_at || new Date(invite.expires_at) <= now) {
    return { ok: false };
  }

  const acceptedAt = now.toISOString();
  const { data: claimed, error: claimError } = await client
    .from('deal_room_invites')
    .update({ status: 'accepted', accepted_at: acceptedAt })
    .eq('id', invite.id)
    .eq('status', 'pending')
    .gt('expires_at', acceptedAt)
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { ok: false };

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const { error: sessionError } = await client.from('deal_room_access_sessions').insert({
    invite_id: invite.id,
    session_token_hash: sha256(sessionToken),
    expires_at: expiresAt,
  });
  if (sessionError) {
    await client.from('deal_room_invites')
      .update({ status: 'pending', accepted_at: null })
      .eq('id', invite.id)
      .eq('status', 'accepted');
    throw sessionError;
  }
  return { ok: true, sessionToken, expiresAt, inviteId: invite.id };
}

module.exports = {
  OWNER_ROLE_KEY,
  SESSION_TTL_MS,
  sha256,
  createTrialOwnerExchange,
  exchangeTrialOwnerCredential,
};
