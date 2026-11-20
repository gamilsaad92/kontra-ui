'use strict';

const crypto = require('node:crypto');
const { resolveRoomSessionAccess } = require('./roomSessionAccess');

const ownerToken = 'owner-session-capability';
const participantToken = 'participant-session-capability';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function createClient({
  ownerRoomId = 'room-1',
  ownerExpiresAt = '2999-01-01T00:00:00.000Z',
  participantRoomId = 'room-1',
} = {}) {
  const sessions = {
    [hash(ownerToken)]: {
      invite_id: 'owner-invite',
      expires_at: ownerExpiresAt,
      revoked_at: null,
    },
    [hash(participantToken)]: {
      invite_id: 'participant-invite',
      expires_at: '2999-01-01T00:00:00.000Z',
      revoked_at: null,
    },
  };
  const invites = {
    'owner-invite': {
      property_id: ownerRoomId,
      role_key: '__room_owner__',
      invited_email: 'owner@example.test',
      status: 'accepted',
      expires_at: '2999-01-01T00:00:00.000Z',
      revoked_at: null,
    },
    'participant-invite': {
      property_id: participantRoomId,
      role_key: 'seller',
      invited_email: 'seller@example.test',
      status: 'accepted',
      expires_at: '2999-01-01T00:00:00.000Z',
      revoked_at: null,
    },
  };
  return {
    from(table) {
      const state = { filters: {} };
      const chain = {
        select: () => chain,
        eq: (key, value) => { state.filters[key] = value; return chain; },
        gt: () => chain,
        is: () => chain,
        maybeSingle: async () => ({
          data: table === 'deal_room_access_sessions'
            ? sessions[state.filters.session_token_hash] || null
            : invites[state.filters.id] || null,
          error: null,
        }),
      };
      return chain;
    },
  };
}

describe('shared room-session access resolver', () => {
  test('accepts an active room-scoped owner cookie', async () => {
    const access = await resolveRoomSessionAccess(
      { headers: { cookie: `kontra_owner_session=${ownerToken}` } },
      'room-1',
      createClient(),
    );

    expect(access.mode).toBe('owner');
    expect(access.permissions.manageParticipants).toBe(true);
  });

  test.each([
    ['missing', {}, createClient()],
    ['expired', { headers: { cookie: `kontra_owner_session=${ownerToken}` } }, createClient({
      ownerExpiresAt: '2000-01-01T00:00:00.000Z',
    })],
    ['wrong room', { headers: { cookie: `kontra_owner_session=${ownerToken}` } }, createClient({
      ownerRoomId: 'room-2',
    })],
    ['raw legacy header', { headers: { 'x-owner-write-token': ownerToken } }, createClient()],
    ['raw legacy body', { headers: {}, body: { ownerWriteToken: ownerToken } }, createClient()],
  ])('rejects %s owner credentials', async (_label, req, client) => {
    const access = await resolveRoomSessionAccess(req, 'room-1', client);
    expect(access.mode).toBe('anonymous');
  });

  test('preserves participant role scope and permissions', async () => {
    const access = await resolveRoomSessionAccess(
      { headers: { 'x-kontra-session': participantToken } },
      'room-1',
      createClient(),
    );

    expect(access.mode).toBe('participant');
    expect(access.role).toBe('seller');
    expect(access.permissions.viewAllDocuments).toBe(false);
    expect(access.permissions.manageStages).toBe(false);
  });
});
