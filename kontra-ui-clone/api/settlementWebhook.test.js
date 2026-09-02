process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.SENTRY_DSN = 'test';
process.env.STRIPE_SECRET_KEY = 'test';
process.env.PII_ENCRYPTION_KEY = 'test';

const request = require('supertest');
const app = require('./index');

describe('payment settlement webhook', () => {
  it('requires trade_id', async () => {
    const res = await request(app)
      .post('/api/exchange/settlement/webhook')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});
