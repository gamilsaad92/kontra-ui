'use strict';

const crypto = require('node:crypto');
const {
  loadInviteRoleDefinitions,
  redeemRoomInvite,
  revokeRoomInvite,
  validateParticipantInviteRole,
} = require('./roomInvitationSecurity');

function createMemoryClient({ invites = [], sessions = [], errors = {} } = {}) {
  const tables = { deal_room_invites: invites, deal_room_access_sessions: sessions };
  const calls = [];

  function matches(row, filters) {
    return Object.entries(filters).every(([key, value]) => {
      if (value && typeof value === 'object' && value.type === 'is') return row[key] === value.value;
      if (value && typeof value === 'object' && value.type === 'in') return value.value.includes(row[key]);
      return row[key] === value;
    });
  }

  function from(table) {
    const state = { filters: {}, operation: 'select', values: null };
    const execute = async () => {
      calls.push({ table, operation: state.operation, filters: { ...state.filters }, values: state.values });
      const error = errors[`${table}:${state.operation}`];
      if (error) return { data: null, error };
      const rows = tables[table] || [];
      if (state.operation === 'insert') {
        const inserted = Array.isArray(state.values) ? state.values : [state.values];
        rows.push(...inserted.map(value => ({
          ...value,
          ...(table === 'deal_room_access_sessions' ? { revoked_at: null } : {}),
        })));
        return { data: inserted.map(value => ({ ...value })), error: null };
      }
      const matchedRows = rows.filter(row => matches(row, state.filters));
      if (state.operation === 'update') {
        matchedRows.forEach(row => Object.assign(row, state.values));
      }
      return { data: matchedRows.map(row => ({ ...row })), error: null };
    };
    const chain = {
      select: () => chain,
      insert: values => { state.operation = 'insert'; state.values = values; return chain; },
      update: values => { state.operation = 'update'; state.values = values; return chain; },
      eq: (key, value) => { state.filters[key] = value; return chain; },
      is: (key, value) => { state.filters[key] = { type: 'is', value }; return chain; },
      in: (key, value) => { state.filters[key] = { type: 'in', value }; return chain; },
      maybeSingle: async () => {
        const result = await execute();
        return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error };
      },
      then: (resolve, reject) => execute().then(resolve, reject),
    };
    return chain;
  }

  return { client: { from }, tables, calls };
}

function invite(overrides = {}) {
  const rawToken = 'a'.repeat(48);
  return {
    id: 'invite-a',
    property_id: 'room-a',
    role_key: 'seller',
    status: 'pending',
    verification_method: 'link',
    invite_token_hash: crypto.createHash('sha256').update(rawToken).digest('hex'),
    expires_at: '2027-01-01T00:00:00.000Z',
    revoked_at: null,
    ...overrides,
  };
}

describe('participant invitation role checks', () => {
  const roles = [
    { key: 'buyer', invitable: false, canManage: true },
    { key: 'seller', invitable: true },
  ];

  it.each(['__room_owner__', 'owner', 'deal_coordinator', 'buyer'])(
    'rejects reserved or configured owner role %s',
    roleKey => {
      expect(validateParticipantInviteRole(roleKey, roles)).toEqual({
        ok: false,
        error: 'reserved_role',
      });
    },
  );

  it('allows configured participant roles and custom-pack roles', () => {
    expect(validateParticipantInviteRole('seller', roles)).toEqual({ ok: true, roleKey: 'seller' });
    expect(validateParticipantInviteRole('M_A_counsel', roles)).toEqual({
      ok: true,
      roleKey: 'm_a_counsel',
    });
  });

  it('fails closed when a custom workflow role definition cannot be loaded', async () => {
    const { client } = createMemoryClient();
    await expect(loadInviteRoleDefinitions(client, 'ws_custom'))
      .rejects.toMatchObject({ code: 'WORKFLOW_ROLES_UNAVAILABLE' });
  });
});

describe('V1 invitation redemption', () => {
  const rawToken = 'a'.repeat(48);
  const now = new Date('2026-11-22T12:00:00.000Z');

  it('creates a scoped session and accepts the pending invite exactly once', async () => {
    const seededInvite = invite();
    const { client, tables, calls } = createMemoryClient({ invites: [seededInvite] });
    const result = await redeemRoomInvite(client, {
      propertyId: 'room-a',
      inviteToken: rawToken,
      now,
      createSessionToken: () => 'session-secret',
    });

    expect(result).toMatchObject({ ok: true, roleKey: 'seller', sessionToken: 'session-secret' });
    expect(seededInvite.status).toBe('accepted');
    expect(tables.deal_room_access_sessions).toHaveLength(1);
    expect(tables.deal_room_access_sessions[0].session_token_hash)
      .toBe(crypto.createHash('sha256').update('session-secret').digest('hex'));
    expect(tables.deal_room_access_sessions[0].session_token_hash).not.toBe('session-secret');
    expect(calls.find(call => call.table === 'deal_room_invites' && call.operation === 'update').filters)
      .toMatchObject({ id: 'invite-a', property_id: 'room-a', status: 'pending' });
  });

  it.each([
    ['expired status', { status: 'expired' }, 'expired'],
    ['elapsed expiry', { expires_at: '2026-11-22T11:59:59.000Z' }, 'expired'],
    ['revoked invite', { status: 'revoked', revoked_at: '2026-11-22T11:00:00.000Z' }, 'revoked'],
    ['already accepted invite', { status: 'accepted' }, 'already_used'],
    ['owner role invite', { role_key: '__room_owner__' }, 'reserved_role'],
  ])('rejects %s before creating a session', async (_name, overrides, error) => {
    const { client, tables } = createMemoryClient({ invites: [invite(overrides)] });
    const result = await redeemRoomInvite(client, { propertyId: 'room-a', inviteToken: rawToken, now });
    expect(result).toMatchObject({ ok: false, error });
    expect(tables.deal_room_access_sessions).toHaveLength(0);
  });

  it('rejects cross-room redemption', async () => {
    const { client, tables } = createMemoryClient({ invites: [invite()] });
    const result = await redeemRoomInvite(client, { propertyId: 'room-b', inviteToken: rawToken, now });
    expect(result).toMatchObject({ ok: false, error: 'wrong_room', status: 403 });
    expect(tables.deal_room_access_sessions).toHaveLength(0);
  });

  it('rejects a pack-configured owner role before creating a session', async () => {
    const { client, tables } = createMemoryClient({ invites: [invite({ role_key: 'buyer' })] });
    const result = await redeemRoomInvite(client, {
      propertyId: 'room-a',
      inviteToken: rawToken,
      now,
      validateRole: roleKey => validateParticipantInviteRole(roleKey, [
        { key: 'buyer', invitable: false, canManage: true },
        { key: 'seller', invitable: true },
      ]),
    });
    expect(result).toMatchObject({ ok: false, error: 'reserved_role', status: 403 });
    expect(tables.deal_room_access_sessions).toHaveLength(0);
  });

  it('invalidates the newly inserted session if acceptance persistence fails', async () => {
    const { client, tables } = createMemoryClient({
      invites: [invite()],
      errors: { 'deal_room_invites:update': new Error('write failed') },
    });
    const result = await redeemRoomInvite(client, {
      propertyId: 'room-a',
      inviteToken: rawToken,
      now,
      createSessionToken: () => 'session-secret',
    });
    expect(result).toMatchObject({ ok: false, error: 'acceptance_failed', sessionInvalidated: true });
    expect(tables.deal_room_invites[0].status).toBe('pending');
    expect(tables.deal_room_access_sessions[0].revoked_at).toBe(now.toISOString());
  });
});

describe('room-scoped V1 invitation revocation', () => {
  it('revokes the invite and every unrevoked session for its room', async () => {
    const { client, tables } = createMemoryClient({
      invites: [invite({ status: 'accepted' })],
      sessions: [
        { id: 'session-1', invite_id: 'invite-a', revoked_at: null },
        { id: 'session-2', invite_id: 'invite-a', revoked_at: null },
        { id: 'session-other', invite_id: 'invite-b', revoked_at: null },
      ],
    });
    const result = await revokeRoomInvite(client, {
      propertyId: 'room-a',
      inviteId: 'invite-a',
      now: new Date('2026-11-22T12:00:00.000Z'),
    });
    expect(result).toMatchObject({ ok: true, sessionsRevoked: 2 });
    expect(tables.deal_room_invites[0].status).toBe('revoked');
    expect(tables.deal_room_access_sessions[0].revoked_at).toBeTruthy();
    expect(tables.deal_room_access_sessions[1].revoked_at).toBeTruthy();
    expect(tables.deal_room_access_sessions[2].revoked_at).toBeNull();
  });

  it('does not revoke an invite from another room', async () => {
    const { client, tables } = createMemoryClient({ invites: [invite()] });
    const result = await revokeRoomInvite(client, {
      propertyId: 'room-b',
      inviteId: 'invite-a',
    });
    expect(result).toMatchObject({ ok: false, error: 'not_found', status: 404 });
    expect(tables.deal_room_invites[0].status).toBe('pending');
  });

  it('fails explicitly when session invalidation needs a retry', async () => {
    const { client, tables } = createMemoryClient({
      invites: [invite()],
      sessions: [{ id: 'session-1', invite_id: 'invite-a', revoked_at: null }],
      errors: { 'deal_room_access_sessions:update': new Error('write failed') },
    });
    const result = await revokeRoomInvite(client, { propertyId: 'room-a', inviteId: 'invite-a' });
    expect(result).toMatchObject({ ok: false, error: 'session_revoke_failed', inviteRevoked: true });
    expect(tables.deal_room_invites[0].status).toBe('revoked');
  });
});
