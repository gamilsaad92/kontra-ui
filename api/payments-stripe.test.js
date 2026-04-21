const request = require('supertest');
const app = require('./index');

describe('POST /api/payments/stripe', () => {
  it('requires amount', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    const res = await request(app).post('/api/payments/stripe').send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns a client secret', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    const res = await request(app)
      .post('/api/payments/stripe')
      .send({ amount: 5 });
    expect([200,201].includes(res.statusCode)).toBe(true);
    expect(res.body.client_secret).toBeDefined();
  });
});
