const express = require('express');
const request = require('supertest');

jest.mock('../../../middlewares/authenticate', () => (req, _res, next) => {
  req.user = { id: 'user-1', user_metadata: {} };
  req.orgId = null;
  next();
});

const eqMock = jest.fn(() => ({ is: isMock }));
const isMock = jest.fn(async () => ({ data: [], error: null }));
const selectMock = jest.fn(() => ({ eq: eqMock }));
const fromMock = jest.fn(() => ({ select: selectMock }));

jest.mock('../../../db', () => ({
  supabase: {
    from: (...args) => fromMock(...args),
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
