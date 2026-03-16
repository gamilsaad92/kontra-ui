const request = require('supertest');
const { app, resetSupabase } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('POST /api/loans/:id/defer', () => {
  it('requires months', async () => {
    const res = await request(app)
      .post('/api/loans/1/defer')
      .set('Authorization', 'Bearer test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});
