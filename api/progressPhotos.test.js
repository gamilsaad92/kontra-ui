const request = require('supertest');
const app = require('./index');

describe('GET /api/progress-photos', () => {
  it('requires project_id', async () => {
    const res = await request(app).get('/api/progress-photos');
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/progress-photos/1', () => {
  it('requires status', async () => {
    const res = await request(app).post('/api/progress-photos/1').send({});
    expect(res.statusCode).toBe(400);
  });
});
