process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.APP_DATABASE_URL = '';
process.env.SUPABASE_DB_URL = '';
process.env.SUPABASE_URL = 'http://placeholder';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.OPENAI_API_KEY = 'test-only-openai-key';
process.env.OPENAI_API_KEY1 = '';
process.env.RESEND_API_KEY = 'test-only-resend-key';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.PII_ENCRYPTION_KEY = 'test-only-pii-key';
process.env.SESSION_SECRET = 'test-only-session-secret';
process.env.JWT_SECRET = 'test-only-jwt-secret';

const mockRoomRows = [{
  property_id: 'room-owner-test',
  property_name: 'Isolated Room',
  customer_email: 'owner@example.com',
  owner_write_token: 'owner-token-isolated-test',
  property_type: 'Office',
  deal_type: 'acquisition',
  workflow_pack_id: 'cre_acquisition',
  status: 'active',
}];
const mockDatabaseCalls = [];
let mockParticipantSession = false;
const mockDeleteDealRoomData = jest.fn().mockResolvedValue({ deletedTables: [], skippedTables: [] });

function makeMockQuery(table) {
  const filters = {};
  const query = {
    select: () => query,
    insert: () => query,
    update: () => query,
    delete: () => query,
    upsert: () => query,
    eq: (column, value) => { filters[column] = value; return query; },
    ilike: (column, value) => {
      filters[column] = value;
      mockDatabaseCalls.push({ table, method: 'ilike', column, value });
      return query;
    },
    in: () => query,
    gt: () => query,
    is: () => query,
    neq: () => query,
    or: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => {
      if (table === 'deal_rooms') {
        return {
          data: mockRoomRows.find(row => row.property_id === filters.property_id) || null,
          error: null,
        };
      }
      if (table === 'deal_room_access_sessions' && mockParticipantSession) {
        return { data: { invite_id: 'invite-test' }, error: null };
      }
      if (table === 'deal_room_invites' && mockParticipantSession) {
        return {
          data: {
            property_id: 'room-owner-test',
            role_key: 'lender',
            invited_email: 'participant@example.com',
            status: 'active',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    single: async () => ({ data: null, error: null }),
    then: (resolve, reject) => {
      const emailPattern = filters.customer_email;
      const exactEmail = emailPattern?.replace(/\\([\\%_])/g, '$1').toLowerCase();
      const rows = table === 'deal_rooms'
        ? (exactEmail
          ? mockRoomRows.filter(row => row.customer_email.toLowerCase() === exactEmail)
          : mockRoomRows)
        : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return query;
}

const mockSupabase = {
  from: table => {
    mockDatabaseCalls.push({ table, method: 'from' });
    return makeMockQuery(table);
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: 'https://example.invalid' }, error: null }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
  auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  rpc: async () => ({ data: null, error: null }),
};

jest.mock('./db', () => ({
  supabase: mockSupabase,
  replica: mockSupabase,
  isDatabaseConnected: () => false,
}));
jest.mock('./lib/dealRoomDeletion', () => ({
  deleteDealRoomData: mockDeleteDealRoomData,
}));
jest.mock('pg', () => {
  class PersistentDatabaseDisabled {
    constructor() {
      throw new Error('Persistent PostgreSQL access is disabled in this test.');
    }
  }
  return { Pool: PersistentDatabaseDisabled, Client: PersistentDatabaseDisabled };
});
jest.mock('./middlewares/auditLogger', () => (_req, _res, next) => next());
jest.mock('./auditLogger', () => ({
  logAuditEntry: jest.fn(),
  AUDIT_PATH: '/dev/null',
  DEFAULT_TTL_MS: 15 * 60 * 1000,
}));
jest.mock('./hyperautomation', () => ({ runWorkflow: jest.fn().mockResolvedValue([]) }));

const request = require('supertest');
const crypto = require('crypto');
const app = require('./index');

let originalFetch;

beforeEach(() => {
  mockDatabaseCalls.length = 0;
  mockParticipantSession = false;
  mockDeleteDealRoomData.mockClear();
  mockDeleteDealRoomData.mockResolvedValue({ deletedTables: [], skippedTables: [] });
  originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'isolated-email' }),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

async function requestOtp(email) {
  const response = await request(app)
    .post('/api/public/my-rooms/request-otp')
    .send({ email });
  expect(response.status).toBe(200);
  const emailPayload = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
  return emailPayload.subject.match(/\d{6}/)[0];
}

describe('verified owner access for public deal-room dashboard routes', () => {
  it('returns room details and owner tokens only after a successful one-time email OTP', async () => {
    const directList = await request(app).get('/api/public/my-rooms?email=owner%40example.com');
    expect(directList.status).toBe(401);
    expect(directList.body.owner_tokens).toBeUndefined();

    const code = await requestOtp('owner@example.com');
    const verified = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: ' OWNER@example.com ', code });

    expect(verified.status).toBe(200);
    expect(verified.body.rooms).toHaveLength(1);
    expect(verified.body.rooms[0].owner_write_token).toBeUndefined();
    expect(verified.body.owner_tokens).toEqual({
      'room-owner-test': 'owner-token-isolated-test',
    });
    expect(mockDatabaseCalls).toContainEqual({
      table: 'deal_rooms',
      method: 'ilike',
      column: 'customer_email',
      value: 'owner@example.com',
    });

    const replay = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'owner@example.com', code });
    expect(replay.status).toBe(401);
    expect(replay.body.owner_tokens).toBeUndefined();
  });

  it('escapes email wildcard characters before matching rooms', async () => {
    const email = 'owner%_test@example.com';
    const code = await requestOtp(email);
    const verified = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email, code });

    expect(verified.status).toBe(200);
    expect(mockDatabaseCalls).toContainEqual({
      table: 'deal_rooms',
      method: 'ilike',
      column: 'customer_email',
      value: 'owner\\%\\_test@example.com',
    });
  });

  it('binds codes to the requested email and throttles repeated code requests', async () => {
    const randomInt = jest.spyOn(crypto, 'randomInt');
    const code = await requestOtp('binding@example.com');
    expect(randomInt).toHaveBeenCalledWith(100000, 1000000);

    const resend = await request(app)
      .post('/api/public/my-rooms/request-otp')
      .send({ email: 'binding@example.com' });
    expect(resend.status).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const wrongEmail = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'different@example.com', code });
    expect(wrongEmail.status).toBe(401);
    expect(wrongEmail.body.owner_tokens).toBeUndefined();

    const correctEmail = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'binding@example.com', code });
    expect(correctEmail.status).toBe(200);
    expect(correctEmail.body.owner_tokens).toEqual({});
  });

  it('expires challenges and stops verification after five incorrect attempts', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    const expiringCode = await requestOtp('expiring@example.com');
    clock.mockReturnValue(now + 10 * 60 * 1000);
    const expired = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'expiring@example.com', code: expiringCode });
    expect(expired.status).toBe(401);
    expect(expired.body.error).toMatch(/expired/i);
    clock.mockRestore();

    const code = await requestOtp('attempts@example.com');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await request(app)
        .post('/api/public/my-rooms/verify-otp')
        .send({ email: 'attempts@example.com', code: '000000' });
      expect(wrong.status).toBe(401);
    }
    const locked = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'attempts@example.com', code });
    expect(locked.status).toBe(401);
    expect(locked.body.error).toMatch(/request a new one/i);
  });

  it('keeps owner analytics available only with a matching room-owner token', async () => {
    const authorized = await request(app)
      .get('/api/public/my-rooms/analytics?email=owner%40example.com&propertyId=room-owner-test')
      .set('x-owner-write-token', 'owner-token-isolated-test');
    expect(authorized.status).toBe(200);
    expect(authorized.body.totalDeals).toBe(1);

    const mismatchedEmail = await request(app)
      .get('/api/public/my-rooms/analytics?email=someone%40elsewhere.com&propertyId=room-owner-test')
      .set('x-owner-write-token', 'owner-token-isolated-test');
    expect(mismatchedEmail.status).toBe(403);
  });

  it('requires the room owner token to delete and does not let a participant session override it', async () => {
    const emailOnly = await request(app)
      .delete('/api/public/my-rooms/room-owner-test')
      .send({ email: 'owner@example.com' });
    expect(emailOnly.status).toBe(403);
    expect(mockDeleteDealRoomData).not.toHaveBeenCalled();

    const ownerDelete = await request(app)
      .delete('/api/public/my-rooms/room-owner-test')
      .set('x-owner-write-token', 'owner-token-isolated-test')
      .send({ ownerWriteToken: 'owner-token-isolated-test' });
    expect(ownerDelete.status).toBe(200);
    expect(mockDeleteDealRoomData).toHaveBeenCalledWith('room-owner-test');

    mockDeleteDealRoomData.mockClear();
    mockParticipantSession = true;
    const participantDelete = await request(app)
      .delete('/api/public/my-rooms/room-owner-test')
      .set('x-kontra-session', 'participant-session-test')
      .set('x-owner-write-token', 'owner-token-isolated-test')
      .send({ ownerWriteToken: 'owner-token-isolated-test' });
    expect(participantDelete.status).toBe(403);
    expect(mockDeleteDealRoomData).not.toHaveBeenCalled();
  });
});
