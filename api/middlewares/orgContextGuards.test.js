'use strict';

const express = require('express');
const request = require('supertest');
const requireOrg = require('./requireOrg');
const requireMembershipRole = require('./requireMembershipRole');

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const ORG_A = 'aaaaaaaa-1111-0000-0000-000000000000';
const ORG_B = 'bbbbbbbb-1111-0000-0000-000000000000';

function buildApp(context = {}, middleware = requireOrg) {
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, context);
    next();
  });
  app.get('/api/tenant', middleware, (req, res) => {
    res.json({ orgId: req.orgId });
  });
  return app;
}

function activeContext(overrides = {}) {
  const membership = {
    user_id: USER_A,
    org_id: ORG_A,
    role: 'owner',
    status: 'active',
    deleted_at: null,
  };
  return {
    authContext: { verified: true },
    authUserId: USER_A,
    orgId: ORG_A,
    organizationId: ORG_A,
    membership,
    membershipRole: 'owner',
    ...overrides,
  };
}

describe('organization context defense-in-depth guards', () => {
  test('does not accept an organization header without verified membership context', async () => {
    const response = await request(buildApp()).get('/api/tenant').set('X-Org-Id', ORG_A);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  test('rejects unverified authentication even when membership-shaped fields are present', async () => {
    const response = await request(buildApp(activeContext({
      authContext: { verified: false },
    }))).get('/api/tenant');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  test('allows a verified active member and uses the server-established tenant', async () => {
    const response = await request(buildApp(activeContext()))
      .get('/api/tenant')
      .set('X-Org-Id', ORG_B);
    expect(response.status).toBe(200);
    expect(response.body.orgId).toBe(ORG_A);
  });

  test('rejects a membership for a different organization', async () => {
    const context = activeContext({
      membership: { ...activeContext().membership, org_id: ORG_B },
    });
    const response = await request(buildApp(context)).get('/api/tenant');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  test('rejects revoked membership', async () => {
    const context = activeContext({
      membership: { ...activeContext().membership, status: 'revoked' },
    });
    const response = await request(buildApp(context)).get('/api/tenant');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  test('requires the role guard to receive the same verified active tenant membership', async () => {
    const response = await request(buildApp(
      activeContext({ membershipRole: 'owner', orgId: ORG_B }),
      requireMembershipRole('owner'),
    )).get('/api/tenant');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  test('does not authorize a role using a caller-inconsistent role projection', async () => {
    const response = await request(buildApp(
      activeContext({ membershipRole: 'owner', membership: {
        ...activeContext().membership,
        role: 'member',
      } }),
      requireMembershipRole('owner'),
    )).get('/api/tenant');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_ROLE_FORBIDDEN');
  });

  test('allows the verified role assigned to the active membership', async () => {
    const response = await request(buildApp(
      activeContext(),
      requireMembershipRole('owner', 'admin'),
    )).get('/api/tenant');
    expect(response.status).toBe(200);
    expect(response.body.orgId).toBe(ORG_A);
  });

  test('preserves the public Deal Room path exemption without broad substring bypasses', async () => {
    const app = express();
    app.use('/api', requireOrg);
    app.get('/api/public/deal-room/:id', (_req, res) => res.json({ public: true }));
    app.get('/api/tenant/api/public/not-public', (_req, res) => res.json({ tenant: true }));

    const publicRoom = await request(app).get('/api/public/deal-room/room-1');
    const nestedPath = await request(app).get('/api/tenant/api/public/not-public');

    expect(publicRoom.status).toBe(200);
    expect(publicRoom.body.public).toBe(true);
    expect(nestedPath.status).toBe(403);
    expect(nestedPath.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });
});
