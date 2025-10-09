const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('POST /api/loans/:id/payments', () => {
  it('requires amount and date', async () => {
    const res = await request(app)
      .post('/api/loans/1/payments')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/loans/:id/payment-portal', () => {
  it('requires amount', async () => {
    const res = await request(app)
      .post('/api/loans/1/payment-portal')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns a url', async () => {
       createClient.__setTable('loans', {
      maybeSingle: { id: 1, amount: 100, interest_rate: 5 },
    });
    const res = await request(app)
      .post('/api/loans/1/payment-portal')
       .set('Authorization', 'Bearer test-token')
      .send({ amount: 100 });
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBeDefined();
  });
});
