'use strict';

const crypto = require('crypto');

const PARTICIPANT_ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenSecret() {
  // SESSION_SECRET is the primary signing key. Older Render environments may
  // have the service-role key configured before the newer session secret was
  // added; it is still server-only high-entropy material and keeps notification
  // delivery from failing before Resend is reached.
  const secret = String(
    process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  if (!secret) throw new Error('SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for participant access links');
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload) {
  return crypto
    .createHmac('sha256', tokenSecret())
    .update(payload)
    .digest('base64url');
}

function createParticipantAccessToken({
  propertyId,
  inviteId,
  role,
  now = Date.now(),
  ttlMs = PARTICIPANT_ACCESS_TOKEN_TTL_MS,
}) {
  if (!propertyId || !inviteId || !role) {
    throw new Error('Participant access links require a room, invite, and role');
  }
  const payload = encode(JSON.stringify({
    propertyId: String(propertyId),
    inviteId: String(inviteId),
    role: String(role),
    expiresAt: Math.floor((now + ttlMs) / 1000),
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyParticipantAccessToken(token, {
  propertyId,
  now = Date.now(),
} = {}) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length
    || !crypto.timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.propertyId || !decoded.inviteId || !decoded.role) return null;
    if (propertyId && decoded.propertyId !== String(propertyId)) return null;
    if (!Number.isFinite(decoded.expiresAt) || decoded.expiresAt <= Math.floor(now / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

module.exports = {
  PARTICIPANT_ACCESS_TOKEN_TTL_MS,
  createParticipantAccessToken,
  verifyParticipantAccessToken,
};