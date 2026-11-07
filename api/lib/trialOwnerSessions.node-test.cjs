'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OWNER_ROLE_KEY,
  SESSION_TTL_MS,
  createTrialOwnerExchange,
  exchangeTrialOwnerCredential,
  sha256,
} = require('./trialOwnerSessions');

test('owner exchange creation stores only a hash and scopes the pending capability to one room', async () => {
  let inserted;
  const client = {
    from(table) {
      assert.equal(table, 'deal_room_invites');
      return {
        insert: async row => { inserted = row; return { error: null }; },
      };
    },
  };
  const token = await createTrialOwnerExchange(client, 'room-1', 'owner@example.test');
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.equal(inserted.property_id, 'room-1');
  assert.equal(inserted.role_key, OWNER_ROLE_KEY);
  assert.equal(inserted.status, 'pending');
  assert.equal(inserted.invite_token_hash, sha256(token));
  assert.notEqual(inserted.invite_token_hash, token);
});

test('one-use owner exchange creates a room-scoped session without retaining the exchange token', async () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const invite = {
    id: 'owner-invite',
    property_id: 'room-1',
    role_key: OWNER_ROLE_KEY,
    status: 'pending',
    expires_at: '2026-11-06T12:15:00Z',
  };
  let sessionRow;
  const client = {
    from(table) {
      if (table === 'deal_room_invites') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: invite, error: null }) }),
          }),
          update: changes => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  select: () => ({
                    maybeSingle: async () => {
                      Object.assign(invite, changes);
                      return { data: { id: invite.id }, error: null };
                    },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      assert.equal(table, 'deal_room_access_sessions');
      return {
        insert: async row => { sessionRow = row; return { error: null }; },
      };
    },
  };
  const result = await exchangeTrialOwnerCredential(client, {
    propertyId: 'room-1',
    token: 'a'.repeat(64),
    now,
  });
  assert.equal(result.ok, true);
  assert.equal(result.inviteId, invite.id);
  assert.equal(new Date(result.expiresAt).getTime() - now.getTime(), SESSION_TTL_MS);
  assert.notEqual(sessionRow.session_token_hash, sha256('a'.repeat(64)));
});

test('invalid or replayed owner exchange capabilities are rejected', async () => {
  const client = {
    from() {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({
            data: {
              id: 'owner-invite',
              property_id: 'room-1',
              role_key: OWNER_ROLE_KEY,
              status: 'accepted',
              expires_at: '2026-11-06T12:15:00Z',
            },
            error: null,
          }) }),
        }),
      };
    },
  };
  const result = await exchangeTrialOwnerCredential(client, {
    propertyId: 'room-1',
    token: 'b'.repeat(64),
    now: new Date('2026-11-06T12:00:00Z'),
  });
  assert.equal(result.ok, false);
});
