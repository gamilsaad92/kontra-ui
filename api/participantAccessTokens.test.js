const {
  createParticipantAccessToken,
  verifyParticipantAccessToken,
} = require('./lib/participantAccessTokens');

describe('participant notification access tokens', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-session-secret';
  });

  it('binds a notification capability to the room and invite role', () => {
    const token = createParticipantAccessToken({
      propertyId: 'room-1',
      inviteId: 'invite-seller',
      role: 'seller',
      now: 1_700_000_000_000,
      ttlMs: 60_000,
    });

    expect(verifyParticipantAccessToken(token, {
      propertyId: 'room-1',
      now: 1_700_000_030_000,
    })).toEqual(expect.objectContaining({
      propertyId: 'room-1',
      inviteId: 'invite-seller',
      role: 'seller',
    }));
    expect(verifyParticipantAccessToken(token, { propertyId: 'room-2' })).toBeNull();
  });

  it('rejects tampering and expiry', () => {
    const token = createParticipantAccessToken({
      propertyId: 'room-1',
      inviteId: 'invite-seller',
      role: 'seller',
      now: 1_700_000_000_000,
      ttlMs: 60_000,
    });
    const [payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decoded.role = 'buyer';
    const tampered = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`;

    expect(verifyParticipantAccessToken(tampered, {
      propertyId: 'room-1',
      now: 1_700_000_030_000,
    })).toBeNull();
    expect(verifyParticipantAccessToken(token, {
      propertyId: 'room-1',
      now: 1_700_000_061_000,
    })).toBeNull();
  });
});