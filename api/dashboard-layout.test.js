const request = require('supertest');
const app = require('../index');

describe('/api/dashboard-layout', () => {
  it('GET requires auth', async () => {
    const res = await request(app).get('/api/dashboard-layout');
    expect(res.statusCode).toBe(401);
  });

  it('POST requires auth', async () => {
    const res = await request(app)
      .post('/api/dashboard-layout')
      .send({ key: 'home', layout: [] });
    expect(res.statusCode).toBe(401);
  });
});
