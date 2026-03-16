const request = require('supertest')
const app = require('../index')

describe('POST /api/tasks', () => {
  it('requires assign field', async () => {
    const res = await request(app).post('/api/tasks').send({})
    expect(res.statusCode).toBe(400)
  })
})
