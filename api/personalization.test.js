const request = require('supertest');
const app = require('./index');

describe('/api/user-events', () => {
  it('requires auth', async () => {
    const res = await request(app)
      .post('/api/user-events')
      .send({ event: 'open_dashboard' });
    expect(res.statusCode).toBe(401);
  });
});

describe('/api/personalized-suggestion', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/personalized-suggestion');
    expect(res.statusCode).toBe(401);
  });
});
