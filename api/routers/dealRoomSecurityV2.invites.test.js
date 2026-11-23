'use strict';

const mockCallPrivate = jest.fn();
const mockInsertedInvites = [];
let mockRouterRoutes;
let mockRoom = {
  property_id: 'room-1',
  property_name: 'Test Room',
  customer_email: 'owner@example.test',
  first_name: 'Owner',
  auth_v2_enabled: true,
  workflow_pack_id: 'ws_test_pack',
};
const mockRoles = [
  { key: 'owner', label: 'Owner', invitable: false, canManage: true },
  { key: 'seller', label: 'Seller', invitable: true },
  { key: 'custom_reviewer', label: 'Custom Reviewer', invitable: true },
];

function makeAdminClient() {
  return {
    auth: {
      getUser: jest.fn(async token => token === 'valid-owner-jwt'
        ? { data: { user: { id: 'user-1', email: 'owner@example.test' } }, error: null }
        : { data: { user: null }, error: new Error('invalid token') }),
    },
    from(table) {
      const state = { filters: {}, operation: 'select', values: null };
      const result = () => {
        if (table === 'deal_rooms') {
          return state.filters.property_id === mockRoom.property_id ? mockRoom : null;
        }
        if (table === 'custom_workflow_packs') {
          return state.filters.id === mockRoom.workflow_pack_id ? { config: { roles: mockRoles } } : null;
        }
        if (table === 'deal_room_invites_v2') {
          if (state.operation === 'insert') {
            mockInsertedInvites.push({ ...state.values });
            return { id: 'invite-new' };
          }
          return state.filters.id === 'invite-1' && state.filters.room_id === mockRoom.property_id
            ? { id: 'invite-1', role_key: 'seller' }
            : null;
        }
        if (table === 'deal_room_participants') {
          return state.filters.id === 'participant-1' && state.filters.room_id === mockRoom.property_id
            ? { id: 'participant-1' }
            : null;
        }
        return null;
      };
      const chain = {
        select: () => chain,
        insert: values => { state.operation = 'insert'; state.values = values; return chain; },
        eq: (key, value) => { state.filters[key] = value; return chain; },
        single: async () => ({ data: result(), error: null }),
        maybeSingle: async () => ({ data: result(), error: null }),
      };
      return chain;
    },
  };
}

let admin;

async function invoke(method, path, { headers = {}, body = {}, params = {}, query = {} } = {}) {
  const handler = mockRouterRoutes[method][path];
  if (!handler) throw new Error(`Route not registered: ${method.toUpperCase()} ${path}`);
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const response = {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(values) { Object.assign(this.headers, values); return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({
    headers: normalizedHeaders,
    body,
    params,
    query,
    socket: { remoteAddress: '127.0.0.1' },
  }, response, () => {});
  return response;
}

beforeEach(() => {
  mockInsertedInvites.length = 0;
  mockRoom = {
    property_id: 'room-1',
    property_name: 'Test Room',
    customer_email: 'owner@example.test',
    first_name: 'Owner',
    auth_v2_enabled: true,
    workflow_pack_id: 'ws_test_pack',
  };
  mockCallPrivate.mockReset().mockResolvedValue(null);
  delete process.env.RESEND_API_KEY;
  process.env.SUPABASE_URL = 'https://supabase.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role';
  process.env.APP_BASE_URL = 'https://staging.example.test';
  jest.resetModules();
  mockRouterRoutes = { get: Object.create(null), post: Object.create(null) };
  admin = makeAdminClient();
  jest.doMock('express', () => ({
    Router: () => ({
      get: (path, handler) => { mockRouterRoutes.get[path] = handler; },
      post: (path, handler) => { mockRouterRoutes.post[path] = handler; },
    }),
  }), { virtual: true });
  jest.doMock('@supabase/supabase-js', () => ({ createClient: () => admin }));
  jest.doMock('../db', () => ({ supabase: admin }));
  jest.doMock('../lib/privateDb', () => ({ callPrivate: (...args) => mockCallPrivate(...args) }));
  jest.doMock('../lib/emailConfig', () => ({ TRANSACTION_NOTIFICATION_FROM: 'Kontra <test@example.test>' }));
  require('./dealRoomSecurityV2');
  global.fetch = jest.fn(() => {
    throw new Error('External network access is disabled in this test');
  });
});

afterEach(() => {
  jest.dontMock('@supabase/supabase-js');
  jest.dontMock('../db');
  jest.dontMock('../lib/privateDb');
  jest.dontMock('../lib/emailConfig');
});

describe('V2 invitation security routes', () => {
  const auth = () => ({ Authorization: 'Bearer valid-owner-jwt' });

  it('returns only a masked email hint when an anonymous bearer resolves an invitation', async () => {
    mockCallPrivate.mockImplementation(async function (fn) {
      if (fn === 'resolve_invite_token') {
        return {
          valid: true,
          room_id: 'room-1',
          room_name: 'Sensitive Deal Name',
          role_key: 'seller',
          invite_id: 'private-invite-id',
          invited_email: 'private.recipient@example.test',
          masked_email: 'p***@example.test',
        };
      }
      return null;
    });

    const response = await invoke('post', '/invite/resolve', {
      body: { token: 'c'.repeat(64) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: true, masked_email: 'p***@example.test' });
    expect(JSON.stringify(response.body)).not.toContain('private.recipient@example.test');
    expect(JSON.stringify(response.body)).not.toContain('private-invite-id');
    expect(JSON.stringify(response.body)).not.toContain('Sensitive Deal Name');
    expect(response.headers).toMatchObject({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Referrer-Policy': 'no-referrer',
    });
  });

  it('does not disclose invitation status or private fields for an invalid token', async () => {
    mockCallPrivate.mockImplementation(async function (fn) {
      if (fn === 'resolve_invite_token') {
        return {
          valid: false,
          reason: 'expired',
          invite_id: 'private-invite-id',
          invited_email: 'private.recipient@example.test',
        };
      }
      return null;
    });

    const response = await invoke('post', '/invite/resolve', {
      body: { token: 'd'.repeat(64) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ valid: false });
    expect(JSON.stringify(response.body)).not.toContain('expired');
    expect(JSON.stringify(response.body)).not.toContain('private.recipient@example.test');
    expect(JSON.stringify(response.body)).not.toContain('private-invite-id');
  });

  it('rejects a configured owner role before creating an invite', async () => {
    const response = await invoke('post', '/invite/create', {
      headers: auth(),
      body: { roomId: 'room-1', roleKey: 'owner', invitedEmail: 'seller@example.test' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('reserved_role');
    expect(mockInsertedInvites).toHaveLength(0);
  });

  it('allows custom participant roles and returns accurate delivery state without logging the raw token', async () => {
    const response = await invoke('post', '/invite/create', {
      headers: auth(),
      body: { roomId: 'room-1', roleKey: 'custom_reviewer', invitedEmail: 'reviewer@example.test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      invite_id: 'invite-new',
      emailSent: false,
      deliveryReason: 'email_not_configured',
    });
    expect(response.body.invite_token).toMatch(/^[a-f0-9]{64}$/);
    expect(mockInsertedInvites[0].role_key).toBe('custom_reviewer');
    expect(mockInsertedInvites[0].token_hash).not.toBe(response.body.invite_token);
    expect(JSON.stringify(mockCallPrivate.mock.calls)).not.toContain(response.body.invite_token);
    expect(mockCallPrivate).toHaveBeenCalledWith(
      'log_audit_event',
      expect.arrayContaining([expect.anything()]),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects revocation of an invitation from another room before calling the private RPC', async () => {
    const response = await invoke('post', '/invite/revoke', {
      headers: auth(),
      body: { roomId: 'room-1', inviteId: 'foreign-invite' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('invite_not_found');
    expect(mockCallPrivate).not.toHaveBeenCalled();
  });

  it('rejects revocation of a participant from another room before calling the private RPC', async () => {
    const response = await invoke('post', '/invite/revoke', {
      headers: auth(),
      body: { roomId: 'room-1', participantId: 'foreign-participant' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('participant_not_found');
    expect(mockCallPrivate).not.toHaveBeenCalled();
  });

  it('keeps acceptance atomic and blocks a previously-created reserved-role invite', async () => {
    mockCallPrivate.mockImplementation(async function (fn) {
      if (fn === 'resolve_invite_token') {
        return { valid: true, room_id: 'room-1', role_key: 'owner' };
      }
      return { ok: true };
    });
    const response = await invoke('post', '/invite/accept', {
      headers: auth(),
      body: { token: 'a'.repeat(64) },
    });

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('reserved_role');
    expect(mockCallPrivate).toHaveBeenCalledWith('resolve_invite_token', [expect.any(String)]);
    expect(mockCallPrivate).not.toHaveBeenCalledWith('accept_invite', expect.anything());
  });

  it('accepts an eligible custom participant role through the existing atomic RPC', async () => {
    mockCallPrivate.mockImplementation(async function (fn) {
      if (fn === 'resolve_invite_token') {
        return { valid: true, room_id: 'room-1', role_key: 'custom_reviewer' };
      }
      if (fn === 'accept_invite') {
        return {
          ok: true,
          room_id: 'room-1',
          role_key: 'custom_reviewer',
          participant_id: 'participant-1',
        };
      }
      return null;
    });
    const response = await invoke('post', '/invite/accept', {
      headers: auth(),
      body: { token: 'b'.repeat(64) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, role_key: 'custom_reviewer' });
    expect(mockCallPrivate).toHaveBeenCalledWith(
      'accept_invite',
      expect.arrayContaining([expect.any(String)]),
    );
  });
});
