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
  UUID_RE: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
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
  const roomLinks = [
    { organization_id: 'aaaaaaaa-1111-0000-0000-000000000000', property_id: 'room-a', created_at: '2026-11-26T10:00:00.000Z' },
    { organization_id: 'bbbbbbbb-1111-0000-0000-000000000000', property_id: 'room-b', created_at: '2026-11-26T11:00:00.000Z' },
  ];
  const from = jest.fn((table) => {
    if (table === 'institutional_deal_room_links') {
      const filters = [];
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((key, value) => { filters.push([key, value]); return query; }),
        order: jest.fn(async () => ({
          data: roomLinks
            .filter((row) => filters.every(([key, value]) => String(row[key]) === String(value)))
            .map(({ property_id, created_at }) => ({ property_id, created_at })),
          error: null,
        })),
      };
      return query;
    }
    return {
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  });
  const membershipQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(async () => ({ data: [], error: null })),
  };
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockReturnValue(membershipQuery);
  membershipQuery.is.mockReturnValue(membershipQuery);
  const replicaFrom = jest.fn(() => membershipQuery);
  return {
    supabase: { rpc, from },
    replica: { from: replicaFrom },
    __test: { rpc, from, replicaFrom, membershipQuery },
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
const ORG_A = 'aaaaaaaa-1111-0000-0000-000000000000';
const ORG_B = 'bbbbbbbb-1111-0000-0000-000000000000';

function buildApp(options = {}) {
  const app = express();
  app.use(express.json());
  const membershipFilters = [];
  const membershipQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    order: jest.fn(async () => ({
      data: (options.memberships || []).filter((membership) => membershipFilters.every(([operation, key, value]) => {
        const actual = key === 'organizations.status'
          ? membership.organizations?.status
          : membership[key];
        return operation === 'is' ? actual === value : String(actual) === String(value);
      })),
      error: null,
    })),
  };
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockImplementation((key, value) => {
    membershipFilters.push(['eq', key, value]);
    return membershipQuery;
  });
  membershipQuery.is.mockImplementation((key, value) => {
    membershipFilters.push(['is', key, value]);
    return membershipQuery;
  });
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
  dbTest.replicaFrom.mockClear();
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

  test('lists only the verified user membership set without requiring a selected organization', async () => {
    const { app, membershipDb } = buildApp();
    const response = await request(app)
      .get('/api/organizations')
      .set('Authorization', 'Bearer verified-session');

    expect(response.status).toBe(200);
    expect(response.body.organizations).toEqual([]);
    expect(membershipDb.from).not.toHaveBeenCalled();
    expect(dbTest.replicaFrom).toHaveBeenCalledWith('org_memberships');
    expect(dbTest.membershipQuery.eq).toHaveBeenCalledWith('user_id', VERIFIED_USER_ID);
    expect(dbTest.rpc).not.toHaveBeenCalled();
  });

  test('rejects unauthenticated organization membership discovery', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/organizations');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
    expect(dbTest.replicaFrom).not.toHaveBeenCalled();
  });

  test('lists only Deal Room identifiers linked to the selected organization', async () => {
    const { app } = buildApp({
      memberships: [{
        id: 'membership-a',
        user_id: VERIFIED_USER_ID,
        org_id: ORG_A,
        role: 'owner',
        status: 'active',
        deleted_at: null,
        organizations: { status: 'active' },
      }],
    });
    const response = await request(app)
      .get(`/api/organizations/${ORG_A}/deal-rooms`)
      .set('Authorization', 'Bearer verified-session')
      .set('X-Org-Id', ORG_A);

    expect(response.status).toBe(200);
    expect(response.body.dealRooms).toEqual([
      { property_id: 'room-a', created_at: '2026-11-26T10:00:00.000Z' },
    ]);
    expect(dbTest.from).toHaveBeenCalledWith('institutional_deal_room_links');
  });

  test('blocks cross-organization room listing before reading the association table', async () => {
    const { app } = buildApp({
      memberships: [{
        id: 'membership-a',
        user_id: VERIFIED_USER_ID,
        org_id: ORG_A,
        role: 'owner',
        status: 'active',
        deleted_at: null,
        organizations: { status: 'active' },
      }],
    });
    const response = await request(app)
      .get(`/api/organizations/${ORG_B}/deal-rooms`)
      .set('Authorization', 'Bearer verified-session')
      .set('X-Org-Id', ORG_B);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_FORBIDDEN');
    expect(dbTest.from).not.toHaveBeenCalledWith('institutional_deal_room_links');
  });
});
