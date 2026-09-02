const request = require('supertest');
const app = require('./index');

describe('POST /api/restaurants', () => {
  it('requires name', async () => {
    const res = await request(app).post('/api/restaurants').send({});
    expect(res.statusCode).toBe(400);
  });
});
