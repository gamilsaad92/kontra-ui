'use strict';

const mockQueryLog = [];
const mockTableRows = {};

function mockMakeQuery(table) {
  const query = {
    select(...args) {
      mockQueryLog.push({ table, method: 'select', args });
      return query;
    },
    eq(field, value) {
      mockQueryLog.push({ table, method: 'eq', field, value });
      return query;
    },
    is(field, value) {
      mockQueryLog.push({ table, method: 'is', field, value });
      return query;
    },
    in(field, value) {
      mockQueryLog.push({ table, method: 'in', field, value });
      return query;
    },
    gte(field, value) {
      mockQueryLog.push({ table, method: 'gte', field, value });
      return query;
    },
    lte(field, value) {
      mockQueryLog.push({ table, method: 'lte', field, value });
      return query;
    },
    order(...args) {
      mockQueryLog.push({ table, method: 'order', args });
      return query;
    },
    limit(...args) {
      mockQueryLog.push({ table, method: 'limit', args });
      return query;
    },
    insert(rows) {
      mockQueryLog.push({ table, method: 'insert', rows });
      return query;
    },
    update(values) {
      mockQueryLog.push({ table, method: 'update', values });
      return query;
    },
    neq(field, value) {
      mockQueryLog.push({ table, method: 'neq', field, value });
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve({ data: mockTableRows[table] || [], error: null, count: 0 }).then(resolve, reject);
    },
    single() {
      return Promise.resolve({ data: mockTableRows[table]?.[0] || { id: 'created' }, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: mockTableRows[table]?.[0] || { user_id: 'target-user' }, error: null });
    },
  };
  return query;
}

jest.mock('./db', () => {
  const client = {
    from: jest.fn((table) => mockMakeQuery(table)),
    rpc: jest.fn(async () => ({ data: { id: 'new-org' }, error: null })),
    auth: { admin: { inviteUserByEmail: jest.fn(), createUser: jest.fn() } },
  };
  return { supabase: client, replica: client };
});
jest.mock('./cache', () => ({
  get: jest.fn(async () => null),
  set: jest.fn(async () => true),
}));
jest.mock('./personalization', () => ({
  logUserEvent: jest.fn(),
  suggestNextFeature: jest.fn(async () => null),
}));
jest.mock('./featureFlags', () => ({ isFeatureEnabled: () => true }));
jest.mock('./services/underwriting', () => ({
  parseDocumentBuffer: jest.fn(),
  autoFillFields: jest.fn(),
  advancedCreditScore: jest.fn(),
  detectFraud: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const reportsRouter = require('./routers/reports');
const dashboardRouter = require('./routers/dashboard');
const mobileRouter = require('./routers/mobile');
const applicationsRouter = require('./routers/applications');
const onboardingRouter = require('./routers/onboarding');
const orgsRouter = require('./src/routes/organizations');

const ORG_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORG_B = 'bbbbbbbb-2222-4222-8222-222222222222';
let membershipRole = 'owner';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authContext = { verified: true };
    req.authUserId = 'aaaaaaaa-3333-4333-8333-333333333333';
    req.user = { id: req.authUserId, email: 'owner@example.invalid' };
    req.orgId = ORG_A;
    req.membershipRole = membershipRole;
    req.membership = {
      org_id: ORG_A,
      user_id: req.authUserId,
      status: 'active',
      deleted_at: null,
      role: membershipRole,
    };
    next();
  });
  app.use('/reports', reportsRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/api', mobileRouter);
  app.use('/applications', applicationsRouter);
  app.use('/onboarding', onboardingRouter);
  app.use('/orgs', orgsRouter);
  return app;
}

describe('tenant query and membership guardrails', () => {
  beforeEach(() => {
    mockQueryLog.length = 0;
    Object.keys(mockTableRows).forEach((key) => delete mockTableRows[key]);
    membershipRole = 'owner';
  });

  test('scopes generic report execution and export to the verified organization', async () => {
    const app = buildApp();
    const run = await request(app)
      .post('/reports/run')
      .send({ table: 'loans', fields: ['id', 'status'], filters: { status: 'active' } });
    expect(run.status).toBe(200);
    expect(mockQueryLog).toContainEqual({ table: 'loans', method: 'eq', field: 'organization_id', value: ORG_A });

    mockQueryLog.length = 0;
    const exported = await request(app).get('/reports/export?table=loans&format=json');
    expect(exported.status).toBe(200);
    expect(mockQueryLog).toContainEqual({ table: 'loans', method: 'eq', field: 'organization_id', value: ORG_A });
  });

  test('rejects caller-supplied tenant filters and unsupported report tables', async () => {
    const app = buildApp();
    const override = await request(app)
      .post('/reports/run')
      .send({ table: 'loans', filters: { organization_id: ORG_B } });
    expect(override.status).toBe(400);

    const unscoped = await request(app)
      .post('/reports/run')
      .send({ table: 'trades' });
    expect(unscoped.status).toBe(400);
  });

  test('denies cross-organization member-list paths and member-role access', async () => {
    const app = buildApp();
    const crossOrg = await request(app).get(`/orgs/${ORG_B}/members`);
    expect(crossOrg.status).toBe(404);

    membershipRole = 'member';
    const denied = await request(buildApp()).get(`/orgs/${ORG_A}/members`);
    expect(denied.status).toBe(403);
  });

  test('allows owner/admin member access but prevents admin owner promotion', async () => {
    const app = buildApp();
    expect((await request(app).get(`/orgs/${ORG_A}/members`)).status).toBe(200);

    membershipRole = 'admin';
    const adminApp = buildApp();
    expect((await request(adminApp).get(`/orgs/${ORG_A}/members`)).status).toBe(200);
    expect((await request(adminApp).post(`/orgs/${ORG_A}/members`).send({
      user_id: 'bbbbbbbb-4444-4444-8444-444444444444',
      role: 'owner',
    })).status).toBe(403);
    expect((await request(adminApp).post(`/orgs/${ORG_A}/members`).send({
      user_id: 'bbbbbbbb-4444-4444-8444-444444444444',
      role: 'member',
    })).status).toBe(201);

    membershipRole = 'owner';
    const ownerPromotion = await request(buildApp()).post(`/orgs/${ORG_A}/members`).send({
      user_id: 'bbbbbbbb-4444-4444-8444-444444444444',
      role: 'owner',
    });
    expect(ownerPromotion.status).toBe(403);
  });

  test('only owners can change canonical organization roles', async () => {
    membershipRole = 'member';
    const denied = await request(buildApp()).post('/onboarding/assign-role').send({
      user_id: 'bbbbbbbb-4444-4444-8444-444444444444',
      app_role: 'member',
    });
    expect(denied.status).toBe(403);

    membershipRole = 'admin';
    const adminDenied = await request(buildApp()).post('/onboarding/assign-role').send({
      user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
      app_role: 'member',
    });
    expect(adminDenied.status).toBe(403);

    membershipRole = 'owner';
    const allowed = await request(buildApp()).post('/onboarding/assign-role').send({
      user_id: 'bbbbbbbb-4444-4444-8444-444444444444',
      app_role: 'member',
    });
    expect(allowed.status).toBe(200);
    expect(mockQueryLog).toContainEqual({ table: 'org_memberships', method: 'eq', field: 'org_id', value: ORG_A });
  });

  test('scopes dashboard, mobile, and applications queries to the active organization', async () => {
    const app = buildApp();
    expect((await request(app).get('/dashboard/overview')).status).toBe(200);
    expect((await request(app).get('/api/mobile/overview')).status).toBe(200);
    expect((await request(app).get('/applications')).status).toBe(200);

    for (const table of ['loans', 'collections', 'loan_applications', 'underwriting_tasks', 'delinquency_alerts']) {
      expect(mockQueryLog).toContainEqual(expect.objectContaining({
        table,
        method: 'eq',
        value: ORG_A,
      }));
    }
  });
});
