const request = require('supertest');
const { app, resetSupabase } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('GET /api/loans/:id/escrow', () => {
  it('validates loan id', async () => {
    const res = await request(app)
      .get('/api/loans/foo/escrow')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(400);
  });
});
