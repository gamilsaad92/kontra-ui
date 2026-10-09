process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.APP_DATABASE_URL = '';
process.env.SUPABASE_DB_URL = '';
process.env.SUPABASE_URL = 'http://placeholder';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.OPENAI_API_KEY = 'test-only-openai-key';
process.env.SENTRY_DSN = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.PII_ENCRYPTION_KEY = 'test-only-pii-key';
process.env.SESSION_SECRET = 'test-only-session-secret';
process.env.JWT_SECRET = 'test-only-jwt-secret';

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
jest.mock('./hyperautomation', () => ({
  runWorkflow: jest.fn().mockResolvedValue([]),
}));
jest.mock('stripe', () => jest.fn(() => ({
  paymentIntents: {
    create: jest.fn().mockResolvedValue({ id: 'pi_isolated', client_secret: 'pi_test_secret' }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({ id: 'cs_isolated', url: 'https://checkout.invalid/isolated' }),
    },
  },
  webhooks: {
    constructEvent: jest.fn((payload) => JSON.parse(payload.toString())),
  },
})));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('./index');

function expectInterimBlock(response) {
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('INTERIM_SECURITY_RESTRICTION');
}

describe('interim security route gates', () => {
  it('fails closed on organization, billing, subscription, SSO, and exchange surfaces before auth middleware', async () => {
    const responses = await Promise.all([
      request(app).get('/api/orgs'),
      request(app).post('/api/organizations').set('x-org-id', 'org-test').send({ name: 'Test' }),
      request(app).get('/api/billing/summary').set('x-org-id', 'org-test'),
      request(app).get('/api/subscription').set('x-org-id', 'org-test'),
      request(app).post('/api/sso/oidc/login').send({ orgId: 'org-test' }),
      request(app).get('/api/exchange/listings').set('x-org-id', 'org-test'),
      request(app).get('/api/exchange-programs/participations').set('x-org-id', 'org-test'),
    ]);

    responses.forEach(expectInterimBlock);
  });

  it('blocks organization creation, auto-provisioning, and switching aliases without blocking self reads', async () => {
    const blocked = await Promise.all([
      request(app).post('/api/me').send({ name: 'Test' }),
      request(app).get('/api/me/bootstrap'),
      request(app).post('/api/me/select').send({ org_id: '00000000-0000-0000-0000-000000000001' }),
    ]);
    blocked.forEach(expectInterimBlock);

    const selfRead = await request(app).get('/api/me');
    expect(selfRead.status).toBe(401);
    expect(selfRead.body.code).not.toBe('INTERIM_SECURITY_RESTRICTION');
  });

  it('keeps sign-in and refresh handlers active', async () => {
    const [signIn, refresh] = await Promise.all([
      request(app).post('/api/auth/signin').send({}),
      request(app).post('/api/auth/refresh').send({}),
    ]);

    expect(signIn.status).toBe(400);
    expect(signIn.body.error).toBe('Email and password are required');
    expect(refresh.status).toBe(400);
    expect(refresh.body.error).toBe('refresh_token is required');
  });

  it('keeps plans reachable, gates purchases without webhook configuration, and blocks only the specified trade routes', async () => {
    const plans = await request(app).get('/api/plans');
    const paymentToken = jwt.sign({
      sub: 'test-user',
      email: 'test@example.com',
      role: 'member',
      portal: 'lender',
      org_id: 'org-test',
    }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_only';
    let paymentBlocked;
    let payment;
    try {
      paymentBlocked = await request(app)
        .post('/api/payments/stripe')
        .set('Authorization', `Bearer ${paymentToken}`)
        .set('x-org-id', 'org-test')
        .send({ amount: 1 });
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_isolated_only';
      payment = await request(app)
        .post('/api/payments/stripe')
        .set('Authorization', `Bearer ${paymentToken}`)
        .set('x-org-id', 'org-test')
        .send({ amount: 1 });
    } finally {
      process.env.STRIPE_SECRET_KEY = originalStripeKey;
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
    const [checkout, stripeWebhook, tradeSettlement, tradeList, tradeCreate, marketTradeList, marketTradeSettle, compliance] = await Promise.all([
      request(app).post('/api/checkout/guest').send({}),
      request(app).post('/api/webhook/stripe')
        .set('content-type', 'application/json')
        .send('{}'),
      request(app).post('/api/trades/1/settle').send({}),
      request(app).get('/api/trades'),
      request(app).post('/api/trades').send({}),
      request(app).get('/api/market/trades'),
      request(app).post('/api/market/trades/1/settle').send({}),
      request(app).get('/api/trades/compliance'),
    ]);

    expect(plans.status).toBe(200);
    expect(paymentBlocked.status).toBe(503);
    expect(paymentBlocked.body.code).toBe('STRIPE_WEBHOOK_UNCONFIGURED');
    expect(payment.status).toBe(201);
    expect(payment.body.client_secret).toBe('pi_test_secret');
    expect(checkout.status).toBe(503);
    expect(checkout.body.code).toBe('STRIPE_WEBHOOK_UNCONFIGURED');
    expect(stripeWebhook.status).toBe(503);
    expect(stripeWebhook.body.code).toBe('STRIPE_WEBHOOK_UNCONFIGURED');
    [tradeSettlement, tradeList, tradeCreate, marketTradeList, marketTradeSettle].forEach(expectInterimBlock);
    expect(compliance.status).not.toBe(503);
  });

  it('requires owner authorization for room analytics and deletion, and disables email-only billing access', async () => {
    const [rooms, deletion, analytics, billing] = await Promise.all([
      request(app).get('/api/public/my-rooms?email=owner%40example.com'),
      request(app).delete('/api/public/my-rooms/room-test').send({ email: 'owner@example.com' }),
      request(app).get('/api/public/my-rooms/analytics?email=owner%40example.com&propertyId=room-test'),
      request(app).post('/api/public/billing-portal').send({ email: 'owner@example.com' }),
    ]);

    expect(rooms.status).toBe(401);
    expect(rooms.body.code).toBe('ROOM_OTP_REQUIRED');
    expect(rooms.body.owner_tokens).toBeUndefined();
    expect(deletion.status).toBe(403);
    expect(analytics.status).toBe(403);
    expect(billing.status).toBe(503);
    expect(billing.body.code).toBe('INTERIM_SECURITY_RESTRICTION');
  });
});
