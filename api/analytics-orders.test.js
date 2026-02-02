const request = require('supertest');
const app = require('./index');

describe('GET /api/analytics/orders', () => {
  it('returns analytics', async () => {
       const res = await request(app)
      .get('/api/analytics/orders')
      .set('X-Organization-Id', '1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalOrders');
  });
});
