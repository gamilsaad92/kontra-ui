'use strict';

jest.mock('../middlewares/authenticate', () => (req, res, next) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token !== 'verified-session') {
    return res.status(401).json({ code: 'AUTH_REQUIRED' });
  }
  req.authContext = { verified: true, provider: 'supabase', subject: 'auth-subject' };
  req.user = { id: 'auth-subject' };
  return next();
});

jest.mock('../middlewares/resolveCanonicalIdentity', () => ({
  resolveCanonicalIdentity: jest.fn(async () => ({
    userId: 'aaaaaaaa-0000-0000-0000-000000000000',
  })),
}));

jest.mock('../db', () => {
  const rpc = jest.fn(async () => ({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'First Organization',
      title: 'First Organization',
      plan: 'basic',
    },
    error: null,
  }));
  const from = jest.fn(() => ({
    update: () => ({
      eq: async () => ({ error: null }),
    }),
  }));
  return {
    supabase: { rpc, from },
    replica: {},
    __test: { rpc, from },
  };
});

jest.mock('../compliance', () => ({
  runKycCheck: jest.fn(async () => ({ passed: false })),
}));
jest.mock('../auditLogger', () => ({
  logAuditEntry: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { __test: dbTest } = require('../db');
const { createRequireOrgContext } = require('../src/middleware/requireOrgContext');
const authenticate = require('../middlewares/authenticate');
const organizationsRouter = require('./organizations');

const VERIFIED_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000000';
const ATTACKER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000000';

function buildApp() {
  const app = express();
  app.use(express.json());
  const membershipQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(async () => ({ data: [], error: null })),
  };
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockReturnValue(membershipQuery);
  membershipQuery.is.mockReturnValue(membershipQuery);
  const membershipDb = {
    from: jest.fn(() => membershipQuery),
  };
  app.use('/api', createRequireOrgContext({ auth: authenticate, db: membershipDb }));
  app.use('/api/organizations', organizationsRouter);
  return { app, membershipDb, membershipQuery };
}

beforeEach(() => {
  dbTest.rpc.mockClear();
  dbTest.from.mockClear();
});

describe('first organization creation', () => {
  test('uses the verified server identity and atomic owner-creation RPC', async () => {
    const { app, membershipDb } = buildApp();
    const response = await request(app)
      .post('/api/organizations')
      .set('Authorization', 'Bearer verified-session')
      .send({
        name: 'First Organization',
        owner_user_id: ATTACKER_USER_ID,
        data: { source: 'pilot-onboarding' },
      });

    expect(response.status).toBe(201);
    expect(dbTest.rpc).toHaveBeenCalledWith('create_organization_with_owner', {
      p_name: 'First Organization',
      p_owner_user_id: VERIFIED_USER_ID,
      p_branding: {},
      p_parent_id: null,
      p_data: { source: 'pilot-onboarding' },
    });
    expect(dbTest.rpc.mock.calls[0][1].p_owner_user_id).not.toBe(ATTACKER_USER_ID);
    expect(membershipDb.from).not.toHaveBeenCalled();
  });

  test('rejects an unauthenticated first-time organization request', async () => {
    const { app } = buildApp();
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: 'Unauthenticated Organization' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
    expect(dbTest.rpc).not.toHaveBeenCalled();
  });

  test('keeps other organization routes behind the membership gate', async () => {
    const { app, membershipDb, membershipQuery } = buildApp();
    const response = await request(app)
      .get('/api/organizations')
      .set('Authorization', 'Bearer verified-session');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
    expect(membershipDb.from).toHaveBeenCalledWith('org_memberships');
    expect(membershipQuery.eq).toHaveBeenCalledWith('user_id', VERIFIED_USER_ID);
    expect(dbTest.rpc).not.toHaveBeenCalled();
  });
});
