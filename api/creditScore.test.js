const request = require('supertest')
const app = require('./index')

describe('POST /api/credit-score', () => {
  it('requires bureauScore', async () => {
    const res = await request(app).post('/api/credit-score').send({})
    expect(res.statusCode).toBe(400)
  })
})
