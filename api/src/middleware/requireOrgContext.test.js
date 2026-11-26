'use strict';

jest.mock('../../db', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  },
}));

const express = require('express');
const request = require('supertest');
const { createRequireOrgContext, isExempt } = require('./requireOrgContext');
const subscriptionsRouter = require('../../routers/subscriptions');

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000000';
const USER_ADMIN = 'cccccccc-0000-0000-0000-000000000000';
const USER_REVOKED = 'dddddddd-0000-0000-0000-000000000000';
const ORG_A = 'aaaaaaaa-1111-0000-0000-000000000000';
const ORG_B = 'bbbbbbbb-1111-0000-0000-000000000000';
const ORG_ADMIN = 'cccccccc-1111-0000-0000-000000000000';
const ORG_REVOKED = 'dddddddd-1111-0000-0000-000000000000';

const memberships = [
  { id: 'ma', user_id: USER_A, org_id: ORG_A, role: 'member', status: 'active', deleted_at: null, organizations: { status: 'active' } },
  { id: 'mb', user_id: USER_B, org_id: ORG_B, role: 'owner', status: 'active', deleted_at: null, organizations: { status: 'active' } },
  { id: 'mc', user_id: USER_ADMIN, org_id: ORG_ADMIN, role: 'admin', status: 'active', deleted_at: null, organizations: { status: 'active' } },
  { id: 'md', user_id: USER_REVOKED, org_id: ORG_REVOKED, role: 'owner', status: 'revoked', deleted_at: null, organizations: { status: 'active' } },
];
const identityLinks = [
  { issuer: 'kontra-local', subject: 'legacy-user-1', auth_user_id: USER_A },
];

function mockDb({ membershipError = null } = {}) {
  return {
    from(table) {
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(key, value) { filters.push(['eq', key, value]); return builder; },
        is(key, value) { filters.push(['is', key, value]); return builder; },
        order() { return builder; },
        rows() {
          const source = table === 'org_memberships' ? memberships
            : table === 'local_auth_identity_links' ? identityLinks : [];
          return source.filter((row) => filters.every(([op, key, value]) => {
            const resolved = key === 'organizations.status' ? row.organizations?.status : row[key];
            if (op === 'is') return resolved === value;
            return String(resolved) === String(value);
          }));
        },
        maybeSingle() {
          return Promise.resolve({ data: builder.rows()[0] || null, error: null });
        },
        then(resolve, reject) {
          const error = table === 'org_memberships' ? membershipError : null;
          return Promise.resolve({ data: error ? null : builder.rows(), error }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function buildApp(options = {}) {
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => {
    const subject = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!subject) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    const provider = subject.startsWith('local:') ? 'local' : 'supabase';
    const actualSubject = provider === 'local' ? subject.slice(6) : subject;
    req.authContext = {
      verified: true,
      provider,
      subject: actualSubject,
      authUserId: provider === 'supabase' ? actualSubject : null,
    };
    req.authProvider = provider;
    req.authSubject = actualSubject;
    req.authUserId = provider === 'supabase' ? actualSubject : null;
    req.user = { id: actualSubject };
    next();
  };
  const gate = createRequireOrgContext({ auth, db: mockDb(options) });
  app.use('/api', gate);
  app.get('/api/loans/:id', (req, res) => res.json({ id: req.params.id, org_id: req.orgId }));
  app.post('/api/loans', (req, res) => res.status(201).json({ org_id: req.orgId }));
  app.get('/api/public/deal-room/:id', (_req, res) => res.json({ public: true }));
  app.use('/api', subscriptionsRouter);
  return app;
}

describe('organization membership gate', () => {
  test('rejects unauthenticated tenant access', async () => {
    const response = await request(buildApp()).get('/api/loans/1');
    expect(response.status).toBe(401);
  });

  test('denies switching to an organization without active membership', async () => {
    const response = await request(buildApp())
      .get('/api/loans/1')
      .set('Authorization', `Bearer ${USER_A}`)
      .set('X-Org-Id', ORG_B);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_FORBIDDEN');
  });

  test('denies selecting an organization through a revoked membership', async () => {
    const response = await request(buildApp())
      .get('/api/loans/1')
      .set('Authorization', `Bearer ${USER_REVOKED}`)
      .set('X-Org-Id', ORG_REVOKED);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_FORBIDDEN');
  });

  test('blocks cross-tenant reads and writes before handlers run', async () => {
    const app = buildApp();
    const read = await request(app)
      .get('/api/loans/loan-b')
      .set('Authorization', `Bearer ${USER_A}`)
      .set('X-Organization-Id', ORG_B);
    const write = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${USER_A}`)
      .set('X-Org-Id', ORG_B)
      .send({ amount: 1 });
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
  });

  test('allows a legitimate member in their selected organization', async () => {
    const response = await request(buildApp())
      .get('/api/loans/loan-a')
      .set('Authorization', `Bearer ${USER_A}`)
      .set('X-Org-Id', ORG_A);
    expect(response.status).toBe(200);
    expect(response.body.org_id).toBe(ORG_A);
  });

  test('allows an owner to select an organization with active membership', async () => {
    const response = await request(buildApp())
      .get('/api/loans/loan-b')
      .set('Authorization', `Bearer ${USER_B}`)
      .set('X-Org-Id', ORG_B);
    expect(response.status).toBe(200);
    expect(response.body.org_id).toBe(ORG_B);
  });

  test('allows an active owner to update the organization subscription', async () => {
    const response = await request(buildApp())
      .post('/api/subscription')
      .set('Authorization', `Bearer ${USER_B}`)
      .set('X-Org-Id', ORG_B)
      .send({ plan: 'pro' });
    expect(response.status).toBe(200);
    expect(response.body.plan).toBe('pro');
  });

  test.each([
    ['admin', USER_ADMIN, ORG_ADMIN],
    ['member', USER_A, ORG_A],
  ])('denies an active %s from updating the organization subscription', async (_role, userId, orgId) => {
    const response = await request(buildApp())
      .post('/api/subscription')
      .set('Authorization', `Bearer ${userId}`)
      .set('X-Org-Id', orgId)
      .send({ plan: 'pro' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_ROLE_FORBIDDEN');
  });

  test('maps local JWT subjects only through an explicit identity link', async () => {
    const linked = await request(buildApp())
      .get('/api/loans/loan-a')
      .set('Authorization', 'Bearer local:legacy-user-1')
      .set('X-Org-Id', ORG_A);
    const unlinked = await request(buildApp())
      .get('/api/loans/loan-a')
      .set('Authorization', 'Bearer local:unmapped-user')
      .set('X-Org-Id', ORG_A);
    expect(linked.status).toBe(200);
    expect(unlinked.status).toBe(403);
    expect(unlinked.body.code).toBe('IDENTITY_LINK_REQUIRED');
  });

  test('leaves public Deal Room routes outside organization membership auth', async () => {
    const response = await request(buildApp()).get('/api/public/deal-room/room-1');
    expect(response.status).toBe(200);
    expect(response.body.public).toBe(true);
  });

  test('fails closed when the organization schema is missing', async () => {
    const response = await request(buildApp({
      membershipError: { message: 'relation org_memberships does not exist' },
    }))
      .get('/api/loans/1')
      .set('Authorization', `Bearer ${USER_A}`);
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('ORG_AUTHORIZATION_UNAVAILABLE');
  });

  test('does not exempt organization administration or organization invites', () => {
    expect(isExempt({ originalUrl: '/api/organizations', url: '/api/organizations', method: 'GET' })).toBe(false);
    expect(isExempt({ originalUrl: '/api/invites/accept', url: '/api/invites/accept', method: 'POST' })).toBe(false);
    expect(isExempt({ originalUrl: '/api/plans', url: '/api/plans', method: 'GET' })).toBe(true);
    expect(isExempt({ originalUrl: '/api/plans', url: '/api/plans', method: 'POST' })).toBe(false);
  });
});
