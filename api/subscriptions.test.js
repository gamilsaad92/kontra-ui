const request = require('supertest');
const app = require('./index');

describe('GET /api/plans', () => {
  it('returns available plans', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });
});

describe('POST /api/subscription', () => {
  it('rejects invalid plan', async () => {
    const res = await request(app)
      .post('/api/subscription')
      .set('X-Org-Id', '1')
      .send({ plan: 'invalid' });
    expect(res.statusCode).toBe(400);
  });
});
