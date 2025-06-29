const request = require('supertest');
const app = require('../index');

describe('POST /api/loans/:id/payments', () => {
  it('requires amount and date', async () => {
    const res = await request(app).post('/api/loans/1/payments').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/loans/:id/payment-portal', () => {
  it('requires amount', async () => {
    const res = await request(app)
      .post('/api/loans/1/payment-portal')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns a url', async () => {
    const res = await request(app)
      .post('/api/loans/1/payment-portal')
      .send({ amount: 100 });
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBeDefined();
  });
});
