const request = require('supertest');
const app = require('./index');

describe('GET /api/waiver-checklist/1', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/waiver-checklist/1');
    expect(res.statusCode).not.toBe(404);
  });
});
