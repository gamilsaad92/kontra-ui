process.env.DOTENV_CONFIG_PATH = '/dev/null';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.APP_DATABASE_URL = '';
process.env.SUPABASE_DB_URL = '';
process.env.SUPABASE_URL = 'http://placeholder';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.OPENAI_API_KEY = 'test-only-openai-key';
process.env.OPENAI_API_KEY1 = '';
process.env.SENTRY_DSN = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.PII_ENCRYPTION_KEY = 'test-only-pii-key';
process.env.SESSION_SECRET = 'test-only-session-secret';
process.env.JWT_SECRET = 'test-only-jwt-secret';

const crypto = require('crypto');
const mockWrites = [];
const mockRows = new Map();
const mockFailures = new Map();
const mockStripeSessions = new Map();
const mockCreateCheckoutSession = jest.fn();
const mockRetrieveCheckoutSession = jest.fn();
const mockRpc = jest.fn(async () => ({ data: { status: 'committed' }, error: null }));

function makeMockQuery(table) {
  const state = { method: 'select', values: null, options: null, filters: [] };
  const rowsForTable = () => {
    if (!mockRows.has(table)) mockRows.set(table, []);
    return mockRows.get(table);
  };
  const matches = row => state.filters.every(({ key, op, value }) => {
    if (op === 'eq') return row[key] === value;
    if (op === 'neq') return row[key] !== value;
    if (op === 'is') return value === null ? row[key] == null : row[key] === value;
    if (op === 'in') return value.includes(row[key]);
    if (op === 'gt') return row[key] > value;
    if (op === 'gte') return row[key] >= value;
    if (op === 'lt') return row[key] < value;
    if (op === 'lte') return row[key] <= value;
    if (op === 'like') return String(row[key] || '').includes(String(value).replace(/%/g, ''));
    return true;
  });
  const execute = () => {
    const injectedError = mockFailures.get(`${table}:${state.method}`);
    if (injectedError) return { data: null, error: injectedError };

    const rows = rowsForTable();
    let selected = rows.filter(matches);
    if (state.method === 'insert') {
      const insertedRows = (Array.isArray(state.values) ? state.values : [state.values])
        .map(value => ({
          ...(table === 'deal_room_checkout_intents' ? { status: 'pending' } : {}),
          ...value,
        }));
      if (table === 'deal_room_checkout_intents'
        && insertedRows.some(value => rows.some(row => row.property_id === value.property_id))) {
        return { data: null, error: { code: '23505', message: 'duplicate checkout intent' } };
      }
      rows.push(...insertedRows);
      selected = insertedRows;
    } else if (state.method === 'update') {
      selected.forEach(row => Object.assign(row, state.values));
    } else if (state.method === 'upsert') {
      const conflictKey = (state.options?.onConflict || 'property_id').split(',')[0];
      selected = (Array.isArray(state.values) ? state.values : [state.values]).map(value => {
        const existing = rows.find(row => row[conflictKey] === value[conflictKey]);
        if (existing) {
          Object.assign(existing, value);
          return existing;
        }
        const created = { ...value };
        rows.push(created);
        return created;
      });
    } else if (state.method === 'delete') {
      const removed = new Set(selected);
      mockRows.set(table, rows.filter(row => !removed.has(row)));
    }
    return { data: selected, error: null };
  };

  const query = {
    select: () => query,
    eq: (key, value) => { state.filters.push({ key, op: 'eq', value }); return query; },
    neq: (key, value) => { state.filters.push({ key, op: 'neq', value }); return query; },
    in: (key, value) => { state.filters.push({ key, op: 'in', value }); return query; },
    gte: (key, value) => { state.filters.push({ key, op: 'gte', value }); return query; },
    lte: (key, value) => { state.filters.push({ key, op: 'lte', value }); return query; },
    gt: (key, value) => { state.filters.push({ key, op: 'gt', value }); return query; },
    lt: (key, value) => { state.filters.push({ key, op: 'lt', value }); return query; },
    is: (key, value) => { state.filters.push({ key, op: 'is', value }); return query; },
    or: () => query,
    like: (key, value) => { state.filters.push({ key, op: 'like', value }); return query; },
    contains: () => query,
    limit: () => query,
    order: () => query,
    insert: values => {
      state.method = 'insert';
      state.values = values;
      mockWrites.push({ table, method: 'insert', values });
      return query;
    },
    update: values => {
      state.method = 'update';
      state.values = values;
      mockWrites.push({ table, method: 'update', values });
      return query;
    },
    delete: () => {
      state.method = 'delete';
      mockWrites.push({ table, method: 'delete' });
      return query;
    },
    upsert: (values, options) => {
      state.method = 'upsert';
      state.values = values;
      state.options = options;
      mockWrites.push({ table, method: 'upsert', values });
      return query;
    },
    maybeSingle: async () => {
      const result = execute();
      return { ...result, data: result.error ? null : (result.data?.[0] || null) };
    },
    single: async () => {
      const result = execute();
      return {
        ...result,
        data: result.error ? null : (result.data?.[0] || null),
      };
    },
    then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject),
  };
  return query;
}

const mockSupabase = {
  from: table => makeMockQuery(table),
  storage: { from: () => ({ getPublicUrl: () => ({ publicURL: '' }) }) },
  auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  rpc: (...args) => mockRpc(...args),
};

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
jest.mock('./db', () => ({
  supabase: mockSupabase,
  replica: mockSupabase,
  isDatabaseConnected: () => false,
}));
jest.mock('stripe', () => {
  const Stripe = jest.requireActual('stripe');
  return jest.fn(apiKey => {
    const client = new Stripe(apiKey);
    client.checkout.sessions.create = mockCreateCheckoutSession;
    client.checkout.sessions.retrieve = mockRetrieveCheckoutSession;
    return client;
  });
});

const request = require('supertest');
function loadFreshApp() {
  delete require.cache[require.resolve('./index')];
  return require('./index');
}
let app;

async function postSignedStripeEvent(targetApp, event) {
  const rawPayload = JSON.stringify(event, null, 2);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureDigest = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawPayload}`, 'utf8')
    .digest('hex');
  return request(targetApp)
    .post('/api/webhook/stripe')
    .set('content-type', 'application/json')
    .set('stripe-signature', `t=${timestamp},v1=${signatureDigest}`)
    .send(rawPayload);
}

async function createPaidGuestCheckout(targetApp, propertyId = 'paid-room-isolated') {
  const checkout = await request(targetApp).post('/api/checkout/guest').send({
    propertyId,
    propertyName: 'Isolated paid room',
    email: 'owner@example.com',
    meta: {
      workflowPackId: 'cre_acquisition',
      dealType: 'acquisition',
      transactionEntryMode: 'active',
      type: 'Office',
    },
  });
  const checkoutParams = mockCreateCheckoutSession.mock.calls[0]?.[0];
  const session = {
    id: 'cs_paid_isolated',
    url: 'https://checkout.invalid/isolated',
    status: 'complete',
    payment_status: 'paid',
    mode: 'payment',
    currency: 'usd',
    amount_total: 49900,
    customer_details: { email: 'owner@example.com' },
    metadata: checkoutParams?.metadata,
  };
  mockStripeSessions.set(session.id, session);
  return { checkout, checkoutParams, session };
}

describe('payment settlement webhook', () => {
  beforeEach(() => {
    mockWrites.length = 0;
    mockRows.clear();
    mockFailures.clear();
    mockStripeSessions.clear();
    mockRpc.mockClear();
    mockCreateCheckoutSession.mockReset().mockResolvedValue({
      id: 'cs_paid_isolated',
      url: 'https://checkout.invalid/isolated',
    });
    mockRetrieveCheckoutSession.mockReset().mockImplementation(async sessionId => {
      const session = mockStripeSessions.get(sessionId);
      if (!session) throw new Error('Checkout Session unavailable in isolated test');
      return session;
    });
    process.env.STRIPE_SECRET_KEY = '';
    process.env.STRIPE_WEBHOOK_SECRET = '';
    app = loadFreshApp();
  });

  it('blocks the unauthenticated exchange settlement hook before it can write settlement state', async () => {
    const res = await request(app)
      .post('/api/exchange/settlement/webhook')
      .send({
        trade_id: 'trade-test',
        funds_confirmed: true,
        assignments_confirmed: true,
        waterfall: { source: 'isolated-test' },
      });
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('INTERIM_SECURITY_RESTRICTION');
  });

  it('does not create a checkout session when the webhook signing secret is absent', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    const response = await request(app).post('/api/checkout/guest').send({
      propertyId: 'paid-room-isolated',
      propertyName: 'Isolated paid room',
      email: 'owner@example.com',
    });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('STRIPE_WEBHOOK_UNCONFIGURED');
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
    expect(mockRows.get('deal_room_checkout_intents') || []).toHaveLength(0);
  });

  it('rejects unsigned or invalidly signed events without fulfillment writes', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
    const response = await request(app)
      .post('/api/webhook/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', 'sig_invalid_isolated')
      .send('{"type":"checkout.session.completed","data":{"object":{}}}');

    expect(response.status).toBe(400);
    expect(mockWrites).toHaveLength(0);
  });

  it('acknowledges a standalone Pro subscription without creating an empty-ID room', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
    const response = await postSignedStripeEvent(app, {
      id: 'evt_pro_isolated',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_pro_isolated',
          status: 'complete',
          payment_status: 'paid',
          mode: 'subscription',
          currency: 'usd',
          amount_total: 29900,
          metadata: { plan: 'pro_monthly', propertyId: '' },
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(mockRows.get('deal_rooms') || []).toHaveLength(0);
    expect(mockWrites).not.toContainEqual(expect.objectContaining({
      table: 'deal_rooms',
      method: 'upsert',
    }));
  });

  it('creates a restart-safe $499 room without returning the owner token in Stripe data', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
    const { checkout, checkoutParams, session } = await createPaidGuestCheckout(app);
    expect(checkout.status).toBe(200);
    expect(checkout.body.url).toBe('https://checkout.invalid/isolated');
    expect(checkoutParams.line_items[0].price_data.unit_amount).toBe(49900);
    expect(checkoutParams.success_url).not.toContain('owner_token');
    expect(checkoutParams.metadata).not.toHaveProperty('owner_write_token');

    const intent = mockRows.get('deal_room_checkout_intents')?.[0];
    expect(intent).toEqual(expect.objectContaining({
      property_id: 'paid-room-isolated',
      stripe_session_id: 'cs_paid_isolated',
      plan: 'deal',
      status: 'pending',
    }));
    expect(intent.owner_write_token).toEqual(expect.any(String));

    mockStripeSessions.set(session.id, { ...session, status: 'open', url: checkout.body.url });
    const retriedCheckout = await request(app).post('/api/checkout/guest').send({
      propertyId: 'paid-room-isolated',
      propertyName: 'Isolated paid room',
      email: 'owner@example.com',
      meta: {
        workflowPackId: 'cre_acquisition',
        dealType: 'acquisition',
        transactionEntryMode: 'active',
        type: 'Office',
      },
    });
    expect(retriedCheckout.status).toBe(200);
    expect(retriedCheckout.body.url).toBe(checkout.body.url);
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1);
    mockStripeSessions.set(session.id, session);

    const event = {
      id: 'evt_paid_isolated',
      type: 'checkout.session.completed',
      data: { object: session },
    };
    const restartedApp = loadFreshApp();
    const beforeFulfillment = await request(restartedApp)
      .post('/api/checkout/owner-token')
      .send({ sessionId: session.id });
    expect(beforeFulfillment.status).toBe(202);

    const fulfillment = await postSignedStripeEvent(restartedApp, event);

    expect(fulfillment.status).toBe(200);
    expect(fulfillment.body).toEqual({ received: true });
    const createdRoom = mockRows.get('deal_rooms')?.[0];
    expect(createdRoom).toEqual(expect.objectContaining({
      property_id: 'paid-room-isolated',
      property_name: 'Isolated paid room',
      customer_email: 'owner@example.com',
      amount_paid: 499,
      owner_write_token: intent.owner_write_token,
    }));
    expect(mockRows.get('deal_rooms')).toHaveLength(1);
    expect(mockRows.get('deal_room_checkout_intents')[0].status).toBe('fulfilled');
    expect(mockRpc).toHaveBeenCalled();

    const access = await request(restartedApp)
      .post('/api/checkout/owner-token')
      .send({ sessionId: session.id });
    expect(access.status).toBe(200);
    expect(access.body).toEqual({
      propertyId: 'paid-room-isolated',
      ownerToken: intent.owner_write_token,
    });

    const replayApp = loadFreshApp();
    const replay = await postSignedStripeEvent(replayApp, event);
    expect(replay.status).toBe(200);
    expect(mockRows.get('deal_rooms')).toHaveLength(1);
    expect(mockRows.get('deal_rooms')[0].owner_write_token).toBe(intent.owner_write_token);
  });

  it('leaves paid fulfillment retryable when the required room write fails', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
    const { checkout, session } = await createPaidGuestCheckout(app, 'retry-room-isolated');
    expect(checkout.status).toBe(200);

    mockFailures.set('deal_rooms:upsert', { code: 'XX000', message: 'isolated write failure' });
    const failedApp = loadFreshApp();
    const failed = await postSignedStripeEvent(failedApp, {
      id: 'evt_retry_isolated',
      type: 'checkout.session.completed',
      data: { object: session },
    });
    expect(failed.status).toBe(503);
    expect(mockRows.get('deal_rooms') || []).toHaveLength(0);
    expect(mockRows.get('deal_room_checkout_intents')[0].status).toBe('pending');

    mockFailures.clear();
    const retryApp = loadFreshApp();
    const retried = await postSignedStripeEvent(retryApp, {
      id: 'evt_retry_isolated',
      type: 'checkout.session.completed',
      data: { object: session },
    });
    expect(retried.status).toBe(200);
    expect(mockRows.get('deal_rooms')).toHaveLength(1);
    expect(mockRows.get('deal_room_checkout_intents')[0].status).toBe('fulfilled');
  });

  it('rejects a signed Checkout event whose amount is not the configured $499 price', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
    const { checkout, session } = await createPaidGuestCheckout(app, 'wrong-amount-isolated');
    expect(checkout.status).toBe(200);

    const response = await postSignedStripeEvent(loadFreshApp(), {
      id: 'evt_wrong_amount_isolated',
      type: 'checkout.session.completed',
      data: { object: { ...session, amount_total: 50000 } },
    });
    expect(response.status).toBe(400);
    expect(mockRows.get('deal_rooms') || []).toHaveLength(0);
  });
});
