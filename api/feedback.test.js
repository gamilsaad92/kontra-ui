const request = require('supertest');
const app = require('./index');

describe('POST /api/feedback', () => {
  it('validates required fields', async () => {
    const res = await request(app).post('/api/feedback').send({});
    expect(res.statusCode).toBe(400);
  });
});
