const request = require('supertest');
const app = require('./index');

describe('GET /api/accounting/entries', () => {
  it('returns entries', async () => {
    const res = await request(app).get('/api/accounting/entries');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('entries');
  });
});
