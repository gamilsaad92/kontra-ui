const request = require('supertest');
const app = require('./index');

describe('POST /api/workflows/ingest', () => {
  it('requires file and type', async () => {
    const res = await request(app).post('/api/workflows/ingest');
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/smart-recommendations', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/smart-recommendations');
    expect(res.statusCode).not.toBe(404);
  });
});
