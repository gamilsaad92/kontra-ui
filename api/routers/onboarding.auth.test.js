'use strict';

jest.mock('../db', () => {
  const userIds = {
    owner: 'aaaaaaaa-0000-0000-0000-000000000000',
    admin: 'bbbbbbbb-0000-0000-0000-000000000000',
    member: 'cccccccc-0000-0000-0000-000000000000',
    otherOrgOwner: 'dddddddd-0000-0000-0000-000000000000',
    invited: 'eeeeeeee-0000-0000-0000-000000000000',
    invitedAdmin: 'ffffffff-0000-0000-0000-000000000000',
  };
  const orgIds = {
    a: 'aaaaaaaa-1111-0000-0000-000000000000',
    b: 'bbbbbbbb-1111-0000-0000-000000000000',
  };
  const memberships = [
    { id: 'owner-a', org_id: orgIds.a, user_id: userIds.owner, role: 'owner', status: 'active', deleted_at: null, invited_email: 'owner@example.test', created_at: '2026-01-01T00:00:00Z', data: {}, organizations: { status: 'active' } },
    { id: 'admin-a', org_id: orgIds.a, user_id: userIds.admin, role: 'admin', status: 'active', deleted_at: null, invited_email: 'admin@example.test', created_at: '2026-01-02T00:00:00Z', data: {}, organizations: { status: 'active' } },
    { id: 'member-a', org_id: orgIds.a, user_id: userIds.member, role: 'member', status: 'active', deleted_at: null, invited_email: 'member@example.test', created_at: '2026-01-03T00:00:00Z', data: {}, organizations: { status: 'active' } },
    { id: 'owner-b', org_id: orgIds.b, user_id: userIds.otherOrgOwner, role: 'owner', status: 'active', deleted_at: null, invited_email: 'other@example.test', created_at: '2026-01-04T00:00:00Z', data: {}, organizations: { status: 'active' } },
  ];
  const initialMemberships = memberships.map((row) => ({ ...row, organizations: { ...row.organizations } }));
  let nextId = 0;
  const inviteUserByEmail = jest.fn(async (email) => ({
    data: {
      user: {
        id: email === 'admin-new@example.test' ? userIds.invitedAdmin : userIds.invited,
        email,
        user_metadata: {},
      },
    },
    error: null,
  }));

  function matches(row, filters) {
    return filters.every(({ op, column, value }) => {
      const actual = column === 'organizations.status' ? row.organizations?.status : row[column];
      if (op === 'is') return actual === value;
      if (op === 'neq') return String(actual) !== String(value);
      if (op === 'in') return value.includes(actual);
      return String(actual) === String(value);
    });
  }

  const supabase = {
    auth: { admin: { inviteUserByEmail } },
    from(table) {
      let operation = 'select';
      let values;
      const filters = [];
      const builder = {
        select() { return builder; },
        insert(input) { operation = 'insert'; values = input; return builder; },
        update(input) { operation = 'update'; values = input; return builder; },
        eq(column, value) { filters.push({ op: 'eq', column, value }); return builder; },
        is(column, value) { filters.push({ op: 'is', column, value }); return builder; },
        neq(column, value) { filters.push({ op: 'neq', column, value }); return builder; },
        in(column, value) { filters.push({ op: 'in', column, value }); return builder; },
        order() { return builder; },
        limit() { return builder; },
        single() { return execute(true); },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      function execute(single) {
        if (table !== 'org_memberships') {
          return Promise.resolve({ data: single ? null : [], error: null });
        }
        if (operation === 'insert') {
          const row = {
            id: `new-membership-${++nextId}`,
            created_at: '2026-11-24T00:00:00.000Z',
            deleted_at: null,
            ...values,
            organizations: { status: 'active' },
          };
          memberships.push(row);
          return Promise.resolve({ data: row, error: null });
        }
        if (operation === 'update') {
          const row = memberships.find((candidate) => matches(candidate, filters));
          if (row) Object.assign(row, values);
          return Promise.resolve({ data: row || null, error: null });
        }
        const rows = memberships.filter((row) => matches(row, filters));
        return Promise.resolve({ data: single ? rows[0] || null : rows, error: null });
      }
      return builder;
    },
  };
  return { supabase, __test: { memberships, initialMemberships, inviteUserByEmail, userIds, orgIds } };
});

const express = require('express');
const request = require('supertest');
const { supabase, __test } = require('../db');
const { createRequireOrgContext } = require('../src/middleware/requireOrgContext');
const onboardingRouter = require('./onboarding');

function auth(req, res, next) {
  const userId = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!userId) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  req.authContext = { verified: true, provider: 'supabase', subject: userId };
  req.authProvider = 'supabase';
  req.authSubject = userId;
  req.user = { id: userId, email: `${userId}@example.test`, user_metadata: {} };
  return next();
}

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api', createRequireOrgContext({ auth, db: supabase }));
  server.use('/api/onboarding', auth, onboardingRouter);
  return server;
}

beforeEach(() => {
  __test.memberships.splice(
    0,
    __test.memberships.length,
    ...__test.initialMemberships.map((row) => ({ ...row, organizations: { ...row.organizations } })),
  );
  __test.inviteUserByEmail.mockClear();
});

describe('institutional onboarding uses canonical organization memberships', () => {
  test('an owner invitation writes only an org_memberships row for the authenticated organization', async () => {
    const response = await request(app())
      .post('/api/onboarding/invite')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ email: 'new@example.test', full_name: 'New User', role: 'member' });

    expect(response.status).toBe(201);
    expect(response.body.member.user_id).toBe(__test.userIds.invited);
    expect(response.body.member.role).toBe('member');
    expect(__test.memberships.at(-1)).toMatchObject({
      org_id: __test.orgIds.a,
      user_id: __test.userIds.invited,
      role: 'member',
      status: 'active',
      created_by: __test.userIds.owner,
    });
    expect(__test.inviteUserByEmail).toHaveBeenCalledTimes(1);
  });

  test('an admin cannot invite another admin or assign elevated roles', async () => {
    const invite = await request(app())
      .post('/api/onboarding/invite')
      .set('Authorization', `Bearer ${__test.userIds.admin}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ email: 'new@example.test', role: 'admin' });
    const assign = await request(app())
      .post('/api/onboarding/assign-role')
      .set('Authorization', `Bearer ${__test.userIds.admin}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ user_id: __test.userIds.member, role: 'member' });

    expect(invite.status).toBe(403);
    expect(assign.status).toBe(403);
    expect(__test.inviteUserByEmail).not.toHaveBeenCalled();
  });

  test('an admin can invite members while an owner can invite admins', async () => {
    const adminInvite = await request(app())
      .post('/api/onboarding/invite')
      .set('Authorization', `Bearer ${__test.userIds.admin}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ email: 'new@example.test', role: 'member' });
    const ownerInvite = await request(app())
      .post('/api/onboarding/invite')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ email: 'admin-new@example.test', role: 'admin' });

    expect(adminInvite.status).toBe(201);
    expect(adminInvite.body.member.role).toBe('member');
    expect(ownerInvite.status).toBe(201);
    expect(ownerInvite.body.member.role).toBe('admin');
    expect(__test.memberships.slice(-2).map((row) => row.role)).toEqual(['member', 'admin']);
  });

  test('an owner can change a member to admin without changing the organization owner', async () => {
    const response = await request(app())
      .post('/api/onboarding/assign-role')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ user_id: __test.userIds.member, role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.body.member.role).toBe('admin');
    expect(__test.memberships[0].role).toBe('owner');
  });

  test('role changes cannot promote or modify an owner', async () => {
    const promotion = await request(app())
      .post('/api/onboarding/assign-role')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ user_id: __test.userIds.member, role: 'owner' });
    const ownerChange = await request(app())
      .post('/api/onboarding/assign-role')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ user_id: __test.userIds.owner, role: 'member' });

    expect(promotion.status).toBe(400);
    expect(ownerChange.status).toBe(403);
    expect(__test.memberships[0].role).toBe('owner');
  });

  test('revocation marks membership inactive and the revoked user loses tenant access', async () => {
    const revoked = await request(app())
      .post('/api/onboarding/revoke')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.a)
      .send({ user_id: __test.userIds.member });
    const after = await request(app())
      .get('/api/onboarding/me')
      .set('Authorization', `Bearer ${__test.userIds.member}`)
      .set('X-Org-Id', __test.orgIds.a);

    expect(revoked.status).toBe(200);
    expect(revoked.body.member.status).toBe('revoked');
    expect(revoked.body.member.deleted_at).toBeTruthy();
    expect(after.status).toBe(403);
    expect(after.body.code).toBe('ORG_FORBIDDEN');
  });

  test('an organization member cannot invite or revoke into another organization', async () => {
    const response = await request(app())
      .post('/api/onboarding/invite')
      .set('Authorization', `Bearer ${__test.userIds.owner}`)
      .set('X-Org-Id', __test.orgIds.b)
      .send({ email: 'new@example.test', role: 'member' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_FORBIDDEN');
    expect(__test.inviteUserByEmail).not.toHaveBeenCalled();
  });
});
