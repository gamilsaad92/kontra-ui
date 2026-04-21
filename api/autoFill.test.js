const request = require('supertest')
const app = require('./index')

describe('POST /api/auto-fill', () => {
  it('requires file upload', async () => {
    const res = await request(app).post('/api/auto-fill')
    expect(res.statusCode).toBe(400)
  })
})
