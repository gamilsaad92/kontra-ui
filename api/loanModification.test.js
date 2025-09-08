const request = require('supertest');
const app = require('../index');

describe('POST /api/loans/:id/defer', () => {
  it('requires months', async () => {
    const res = await request(app).post('/api/loans/1/defer').send({});
    expect(res.statusCode).toBe(400);
  });
});
