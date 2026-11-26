'use strict';

jest.mock('./db', () => {
  const memberships = [
    { id: 'owner-membership', org_id: 'aaaaaaaa-1111-0000-0000-000000000000', user_id: 'aaaaaaaa-0000-0000-0000-000000000000', role: 'owner', status: 'active', deleted_at: null, organizations: { status: 'active' } },
    { id: 'admin-membership', org_id: 'bbbbbbbb-1111-0000-0000-000000000000', user_id: 'bbbbbbbb-0000-0000-0000-000000000000', role: 'admin', status: 'active', deleted_at: null, organizations: { status: 'active' } },
    { id: 'member-membership', org_id: 'cccccccc-1111-0000-0000-000000000000', user_id: 'cccccccc-0000-0000-0000-000000000000', role: 'member', status: 'active', deleted_at: null, organizations: { status: 'active' } },
  ];
  const updates = [];
  const supabase = {
    from(table) {
      const filters = [];
      let operation = 'select';
      let updateValue;
      const builder = {
        select() { operation = 'select'; return builder; },
        update(value) { operation = 'update'; updateValue = value; return builder; },
        eq(column, value) { filters.push([column, value]); return builder; },
        is(column, value) { filters.push([column, value]); return builder; },
        order() { return builder; },
        single() {
          return Promise.resolve({ data: { plan: 'basic' }, error: null });
        },
        then(resolve, reject) {
          if (table === 'organizations' && operation === 'update') {
            updates.push({ filters, value: updateValue });
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          const data = table === 'org_memberships'
            ? memberships.filter((row) => filters.every(([column, value]) => {
              if (column === 'organizations.status') return row.organizations.status === value;
              return String(row[column]) === String(value);
            }))
            : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { supabase, __test: { memberships, updates } };
});

const express = require('express');
const request = require('supertest');
const { supabase } = require('./db');
const { createRequireOrgContext } = require('./src/middleware/requireOrgContext');
const subscriptionsRouter = require('./routers/subscriptions');

const USERS = {
  owner: 'aaaaaaaa-0000-0000-0000-000000000000',
  admin: 'bbbbbbbb-0000-0000-0000-000000000000',
  member: 'cccccccc-0000-0000-0000-000000000000',
};
const ORGS = {
  owner: 'aaaaaaaa-1111-0000-0000-000000000000',
  admin: 'bbbbbbbb-1111-0000-0000-000000000000',
  member: 'cccccccc-1111-0000-0000-000000000000',
};

function buildApp() {
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.authContext = { verified: true, provider: 'supabase', subject: token };
    req.authProvider = 'supabase';
    req.authSubject = token;
    req.user = { id: token };
    return next();
  };
  app.use('/api', createRequireOrgContext({ auth, db: supabase }));
  app.use('/api', subscriptionsRouter);
  return app;
}

describe('subscription route authorization', () => {
  test('keeps the static plan catalog public', async () => {
    const response = await request(buildApp()).get('/api/plans');
    expect(response.status).toBe(200);
    expect(response.body.plans.map((plan) => plan.name)).toEqual(['basic', 'pro', 'enterprise']);
  });

  test('does not make protected subscription writes public', async () => {
    const response = await request(buildApp())
      .post('/api/subscription')
      .set('X-Organization-Id', ORGS.owner)
      .send({ plan: 'invalid' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  test('allows a verified owner through authorization before validating the plan', async () => {
    const response = await request(buildApp())
      .post('/api/subscription')
      .set('Authorization', `Bearer ${USERS.owner}`)
      .set('X-Organization-Id', ORGS.owner)
      .send({ plan: 'invalid' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid plan');
  });

  test.each(['admin', 'member'])('denies a verified %s from changing subscription', async (role) => {
    const response = await request(buildApp())
      .post('/api/subscription')
      .set('Authorization', `Bearer ${USERS[role]}`)
      .set('X-Organization-Id', ORGS[role])
      .send({ plan: 'pro' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_ROLE_FORBIDDEN');
  });

  test('requires owner or admin membership to read subscription details', async () => {
    const member = await request(buildApp())
      .get('/api/subscription')
      .set('Authorization', `Bearer ${USERS.member}`)
      .set('X-Organization-Id', ORGS.member);
    const owner = await request(buildApp())
      .get('/api/subscription')
      .set('Authorization', `Bearer ${USERS.owner}`)
      .set('X-Organization-Id', ORGS.owner);

    expect(member.status).toBe(403);
    expect(owner.status).toBe(200);
    expect(owner.body.plan).toBe('basic');
  });
});
