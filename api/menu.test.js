const request = require('supertest');
const app = require('./index');

describe('POST /api/menu', () => {
  it('requires name and price', async () => {
    const res = await request(app).post('/api/menu').send({});
    expect(res.statusCode).toBe(400);
  });
});
