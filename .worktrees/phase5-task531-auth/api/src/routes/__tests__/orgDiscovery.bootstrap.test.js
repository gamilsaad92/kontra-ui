const express = require('express');
const request = require('supertest');

jest.mock('../../../middlewares/authenticate', () => (req, _res, next) => {
  req.user = { id: 'aaaaaaaa-0000-0000-0000-000000000000', user_metadata: {} };
  req.authContext = { verified: true, provider: 'supabase', subject: 'aaaaaaaa-0000-0000-0000-000000000000', authUserId: 'aaaaaaaa-0000-0000-0000-000000000000' };
  req.authProvider = 'supabase';
  req.authSubject = 'aaaaaaaa-0000-0000-0000-000000000000';
  req.authUserId = 'aaaaaaaa-0000-0000-0000-000000000000';
  req.orgId = null;
  next();
});

const mockFrom = jest.fn(() => {
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    order: () => query,
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return query;
});

jest.mock('../../../db', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}));

const mockRpc = jest.fn();
const router = require('../orgDiscovery');

describe('GET /bootstrap', () => {
  test('returns 200 with empty orgs when user has no memberships', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/me', router);

    const tokenPayload = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
    const res = await request(app)
      .get('/api/me/bootstrap')
      .set('Authorization', `Bearer a.${tokenPayload}.c`);

    expect(res.status).toBe(200);
    expect(res.body.orgs).toEqual([]);
    expect(res.body.activeOrgId).toBeNull();
    expect(res.body.default_org_id).toBeNull();
  });

  test('creates the organization and owner using the verified Supabase Auth UUID', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/me', router);
    mockRpc.mockResolvedValueOnce({
      data: {
        id: 'aaaaaaaa-1111-0000-0000-000000000000',
        name: 'Pilot Organization',
        title: 'Pilot Organization',
        membership_id: 'bbbbbbbb-1111-0000-0000-000000000000',
        created_at: '2026-11-24T00:00:00.000Z',
      },
      error: null,
    });

    const tokenPayload = Buffer.from(JSON.stringify({
      sub: 'aaaaaaaa-0000-0000-0000-000000000000',
    })).toString('base64url');
    const response = await request(app)
      .post('/api/me')
      .set('Authorization', `Bearer a.${tokenPayload}.c`)
      .send({
        name: 'Pilot Organization',
        owner_user_id: 'cccccccc-0000-0000-0000-000000000000',
        plan: 'enterprise',
      });

    expect(response.status).toBe(201);
    expect(response.body.org.role).toBe('owner');
    expect(mockRpc).toHaveBeenCalledWith('create_organization_with_owner', {
      p_name: 'Pilot Organization',
      p_owner_user_id: 'aaaaaaaa-0000-0000-0000-000000000000',
    });
  });
});
