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

  it('uses the server-only service key when older production environments lack SESSION_SECRET', () => {
    const previousSessionSecret = process.env.SESSION_SECRET;
    const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SESSION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    try {
      const token = createParticipantAccessToken({
        propertyId: 'room-1',
        inviteId: 'invite-buyer',
        role: 'buyer',
        now: 1_700_000_000_000,
      });
      expect(verifyParticipantAccessToken(token, {
        propertyId: 'room-1',
        now: 1_700_000_001_000,
      })).toEqual(expect.objectContaining({
        inviteId: 'invite-buyer',
        role: 'buyer',
      }));
    } finally {
      if (previousSessionSecret == null) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSessionSecret;
      if (previousServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
    }
  });
});