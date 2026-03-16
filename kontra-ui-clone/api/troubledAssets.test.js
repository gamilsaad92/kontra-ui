const request = require('supertest');
const app = require('./index');

describe('GET /api/assets/troubled', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/assets/troubled');
    expect(res.statusCode).not.toBe(404);
  });
});
