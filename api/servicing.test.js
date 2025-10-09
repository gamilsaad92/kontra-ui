const request = require('supertest');
const { app, resetSupabase } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('GET /api/escrows/upcoming', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/escrows/upcoming');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/loans/:id/escrow/pay', () => {
  it('requires type and amount', async () => {
    const res = await request(app)
      .post('/api/loans/1/escrow/pay')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/loans/:id/escrow/projection', () => {
  it('validates loan id', async () => {
    const res = await request(app)
      .get('/api/loans/foo/escrow/projection')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(400);
  });
});
