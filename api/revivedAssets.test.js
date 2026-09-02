const request = require('supertest');
const app = require('./index');

describe('GET /api/assets/revived', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/assets/revived');
    expect(res.statusCode).not.toBe(404);
  });
});
