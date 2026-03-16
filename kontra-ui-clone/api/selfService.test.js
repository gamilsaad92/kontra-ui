const request = require('supertest');
const { app, resetSupabase } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('GET /api/loans/:id/balance', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/loans/1/balance');
   expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/loans/:id/payoff', () => {
  it('requires payoff_date', async () => {
    const res = await request(app)
      .post('/api/loans/1/payoff')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/bookings/:id', () => {
  it('requires start_date or end_date', async () => {
    const res = await request(app).patch('/api/bookings/1').send({});
    expect(res.statusCode).toBe(400);
  });
});
