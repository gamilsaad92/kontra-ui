const express = require('express');
const request = require('supertest');

jest.mock('../../../middlewares/authenticate', () => (req, _res, next) => {
  req.user = { id: 'user-1', user_metadata: {} };
  req.authContext = { verified: true, provider: 'supabase', subject: 'user-1', authUserId: 'user-1' };
  req.authProvider = 'supabase';
  req.authSubject = 'user-1';
  req.authUserId = 'user-1';
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
  },
}));

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
});
