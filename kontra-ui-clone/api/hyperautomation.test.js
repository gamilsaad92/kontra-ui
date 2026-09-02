const request = require('supertest');
const http = require('http');
const app = require('./index');

describe('POST /api/workflows/:id/run', () => {
  let server;
  beforeAll(done => {
    server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    }).listen(0, done);
  });
  afterAll(done => server.close(done));

  it('runs a workflow and returns results', async () => {
    const port = server.address().port;
    const create = await request(app)
      .post('/api/workflows')
      .send({ name: 'Run Flow', steps: [{ type: 'http', url: `http://localhost:${port}` }] });
    expect(create.statusCode).toBe(201);

    const res = await request(app).post(`/api/workflows/${create.body.id}/run`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
