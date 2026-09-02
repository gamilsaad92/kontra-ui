const request = require('supertest')
const app = require('./index')

describe('GET /api/decision-history', () => {
  it('responds with success', async () => {
    const res = await request(app).get('/api/decision-history')
    expect(res.statusCode).toBe(200)
  })
})
