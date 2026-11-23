jest.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

const {
  buildInviteLink,
  clearInviteCredentialsFromUrl,
  clearInviteSession,
  getRoomAuthHeaders,
  revokeInvite,
  storeInviteSession,
  verifyInviteLink,
  verifyParticipantAccess,
} = require('./inviteUtils');

const propertyId = 'room-1';
const ownerKey = `kontra_owner_token_${propertyId}`;

describe('room authorization header precedence', () => {
  beforeEach(() => {
    clearInviteSession(propertyId);
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sends a participant session without the same-room owner token', () => {
    localStorage.setItem(ownerKey, 'owner-token');
    storeInviteSession(propertyId, 'participant-session', '2999-01-01T00:00:00.000Z');

    expect(getRoomAuthHeaders(propertyId, { Accept: 'application/json' })).toEqual({
      Accept: 'application/json',
      'x-kontra-session': 'participant-session',
    });
  });

  it('keeps the participant session explicit when sessionStorage is unavailable', () => {
    localStorage.setItem(ownerKey, 'owner-token');
    Object.defineProperty(sessionStorage, 'setItem', {
      configurable: true,
      value: () => { throw new Error('storage unavailable'); },
    });
    try {
      storeInviteSession(propertyId, 'in-memory-participant-session', '2999-01-01T00:00:00.000Z');
      expect(getRoomAuthHeaders(propertyId)).toEqual({
        'x-kontra-session': 'in-memory-participant-session',
      });
    } finally {
      delete sessionStorage.setItem;
    }
  });

  it('never emits an owner token header from browser storage', () => {
    localStorage.setItem(ownerKey, 'owner-token');

    let headers;
    jest.isolateModules(() => {
      const fresh = require('./inviteUtils');
      headers = fresh.getRoomAuthHeaders(propertyId);
    });

    expect(headers).toEqual({});
    expect(localStorage.getItem(ownerKey)).toBeNull();
  });

  it('removes an expired participant session without falling back to an owner token', () => {
    localStorage.setItem(ownerKey, 'owner-token');
    storeInviteSession(propertyId, 'expired-session', '2000-01-01T00:00:00.000Z');

    let headers;
    jest.isolateModules(() => {
      const fresh = require('./inviteUtils');
      headers = fresh.getRoomAuthHeaders(propertyId);
    });

    expect(headers).toEqual({});
    expect(localStorage.getItem(ownerKey)).toBeNull();
    expect(sessionStorage.getItem(`kontra_session_${propertyId}`)).toBeNull();
  });

  it('can clear a participant session before owner re-entry', () => {
    storeInviteSession(propertyId, 'participant-session', '2999-01-01T00:00:00.000Z');
    clearInviteSession(propertyId);

    expect(getRoomAuthHeaders(propertyId)).toEqual({});
  });

  it('exchanges a notification CTA without trusting its URL role', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        session_token: 'participant-session',
        expires_at: '2999-01-01T00:00:00.000Z',
        role_key: 'seller',
      }),
    });

    await expect(verifyParticipantAccess(propertyId, 'signed-capability')).resolves.toEqual({
      success: true,
      session_token: 'participant-session',
      expires_at: '2999-01-01T00:00:00.000Z',
      role_key: 'seller',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public/deal-room/room-1/participant-access/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ accessToken: 'signed-capability' }),
      }),
    );
  });

  it('builds a room invitation URL and removes its credentials after exchange', () => {
    expect(buildInviteLink('room/a', 'raw-token', 'seller', 'https://example.test'))
      .toBe('https://example.test/deal-room/room%2Fa?invite=raw-token&role=seller');

    window.history.replaceState({}, '', '/deal-room/room-1?invite=raw-token&role=seller&participant_access=signed-capability');
    expect(clearInviteCredentialsFromUrl({ verificationPath: '/deal-room/room-1/verify' })).toBe(true);
    expect(window.location.pathname).toBe('/deal-room/room-1/verify');
    expect(window.location.search).toBe('?role=seller');
    expect(window.location.href).not.toContain('raw-token');
    expect(window.location.href).not.toContain('signed-capability');
  });

  it('uses the V1 verify endpoint without caching or referrer leakage', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, role_key: 'seller', session_token: 'session' }),
    });
    await expect(verifyInviteLink(propertyId, 'raw-invite-token')).resolves.toMatchObject({
      success: true,
      role_key: 'seller',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public/deal-room/room-1/invite/verify-link',
      expect.objectContaining({ cache: 'no-store', referrerPolicy: 'no-referrer' }),
    );
  });

  it('revokes through the room-scoped owner-session endpoint and reports failure', async () => {
    storeInviteSession(propertyId, 'participant-session', '2999-01-01T00:00:00.000Z');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    });

    await expect(revokeInvite(propertyId, 'invite-1')).resolves.toMatchObject({
      success: false,
      error: 'forbidden',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public/deal-room/room-1/invites/invite-1/revoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-kontra-session': 'participant-session' }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        credentials: 'include',
      }),
    );
  });
});