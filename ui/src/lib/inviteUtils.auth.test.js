jest.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

const {
  clearInviteSession,
  getRoomAuthHeaders,
  storeInviteSession,
} = require('./inviteUtils');

const propertyId = 'room-1';
const ownerKey = `kontra_owner_token_${propertyId}`;

describe('room authorization header precedence', () => {
  beforeEach(() => {
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

  it('sends the owner token when no participant session exists', () => {
    localStorage.setItem(ownerKey, 'owner-token');

    expect(getRoomAuthHeaders(propertyId)).toEqual({
      'x-owner-write-token': 'owner-token',
    });
  });

  it('removes an expired participant session and falls back to the owner token', () => {
    localStorage.setItem(ownerKey, 'owner-token');
    storeInviteSession(propertyId, 'expired-session', '2000-01-01T00:00:00.000Z');

    expect(getRoomAuthHeaders(propertyId)).toEqual({
      'x-owner-write-token': 'owner-token',
    });
    expect(sessionStorage.getItem(`kontra_session_${propertyId}`)).toBeNull();
  });

  it('can clear a participant session before owner re-entry', () => {
    storeInviteSession(propertyId, 'participant-session', '2999-01-01T00:00:00.000Z');
    clearInviteSession(propertyId);

    expect(getRoomAuthHeaders(propertyId)).toEqual({});
  });
});