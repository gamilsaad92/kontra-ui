const request = require('supertest');
const app = require('./index');

describe('POST /api/assets/1/revive', () => {
  it('endpoint exists', async () => {
    const res = await request(app).post('/api/assets/1/revive').send({});
    expect(res.statusCode).not.toBe(404);
  });
});
