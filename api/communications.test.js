const request = require('supertest');
const app = require('../index');

describe('POST /api/send-communication', () => {
  it('requires contact info', async () => {
    const res = await request(app).post('/api/send-communication').send({});
    expect(res.statusCode).toBe(400);
  });
});
