const request = require('supertest');
const app = require('../index');

describe('GET /api/loans/:id/escrow', () => {
  it('validates loan id', async () => {
    const res = await request(app).get('/api/loans/foo/escrow');
    expect(res.statusCode).toBe(400);
  });
});
