process.env.SUPABASE_URL = 'http://example.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';

const request = require('supertest');
const app = require('./index');

describe('risk summary endpoint', () => {
  it('returns summary data', async () => {
    const res = await request(app).get('/api/risk/summary');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.buckets)).toBe(true);
    expect(res.body.stress).toHaveProperty('buckets');
    expect(Array.isArray(res.body.flags)).toBe(true);
    expect(Array.isArray(res.body.penalties)).toBe(true);
  });
});
