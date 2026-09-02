const request = require('supertest');
const app = require('./index');

describe('GET /api/analytics/restaurant', () => {
  it('returns metrics', async () => {
    const res = await request(app).get('/api/analytics/restaurant');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('tableTurnover');
  });
});
