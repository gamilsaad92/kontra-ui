const request = require('supertest');
const app = require('../index');

const dashboardRoutes = ['/api/dashboard-layout', '/api/dashboard'];

describe.each(dashboardRoutes)('%s', (route) => {
  it('GET requires auth', async () => {
   const res = await request(app).get(route);
    expect(res.statusCode).toBe(401);
  });

  it('POST requires auth', async () => {
    const res = await request(app)
      .post(route)
      .send({ key: 'home', layout: [] });
    expect(res.statusCode).toBe(401);
  });
});
