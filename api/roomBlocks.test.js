const request = require('supertest');
const app = require('./index');

describe('POST /api/room-blocks', () => {
  it('requires rooms and dates', async () => {
    const res = await request(app).post('/api/room-blocks').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/hospitality/forecast', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/hospitality/forecast');
    expect(res.statusCode).not.toBe(404);
  });
});
