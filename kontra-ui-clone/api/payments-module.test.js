const request = require('supertest');
const app = require('./index');

describe('POST /api/payments', () => {
  it('requires order_id and amount', async () => {
    const res = await request(app).post('/api/payments').send({});
    expect(res.statusCode).toBe(400);
  });
});
