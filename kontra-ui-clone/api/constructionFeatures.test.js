const request = require('supertest')
const app = require('./index')

describe('POST /api/validate-invoice', () => {
  it('requires project_id and file', async () => {
    const res = await request(app).post('/api/validate-invoice').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/project-forecast', () => {
  it('requires arrays', async () => {
    const res = await request(app).post('/api/project-forecast').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/audit-lien-waiver', () => {
  it('requires text', async () => {
    const res = await request(app).post('/api/audit-lien-waiver').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/assets/1/collateral', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/assets/1/collateral')
    expect(res.statusCode).not.toBe(404)
  })
})

describe('POST /api/financing-scorecard', () => {
  it('requires bureau_score', async () => {
    const res = await request(app).post('/api/financing-scorecard').send({})
    expect(res.statusCode).toBe(400)
  })
})
