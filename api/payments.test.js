const request = require('supertest');
const app = require('../index');

describe('POST /api/loans/:id/payments', () => {
  it('requires amount and date', async () => {
    const res = await request(app).post('/api/loans/1/payments').send({});
    expect(res.statusCode).toBe(400);
  });
});
