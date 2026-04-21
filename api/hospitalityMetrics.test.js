const request = require('supertest');
const app = require('./index');

describe('GET /api/hospitality/metrics', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/hospitality/metrics');
    expect(res.statusCode).not.toBe(404);
  });
});
