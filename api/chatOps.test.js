const request = require('supertest');
const app = require('../index');

describe('POST /api/chatops', () => {
  it('requires question', async () => {
    const res = await request(app).post('/api/chatops').send({});
    expect(res.statusCode).toBe(400);
  });
});
