const request = require('supertest')
const app = require('./index')

describe('POST /api/assets/1/upload', () => {
  it('requires file', async () => {
    const res = await request(app).post('/api/assets/1/upload')
    expect(res.statusCode).toBe(400)
  })
})
