const request = require('supertest')
const app = require('./index')

describe('POST /api/detect-fraud', () => {
  it('flags suspicious address', async () => {
    const res = await request(app)
      .post('/api/detect-fraud')
      .send({ address: 'P.O. Box 123', income: 50000 })
    expect(res.statusCode).toBe(200)
    expect(res.body.suspicious).toBe(true)
  })
})
