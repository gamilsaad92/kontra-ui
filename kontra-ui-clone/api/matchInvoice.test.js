const request = require('supertest');
const app = require('./index');

describe('POST /api/match-invoice', () => {
  it('requires project_id and file', async () => {
    const res = await request(app).post('/api/match-invoice').send({});
    expect(res.statusCode).toBe(400);
  });
});
