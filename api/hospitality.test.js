const request = require('supertest')
const app = require('../index')

describe('POST /api/guests', () => {
  it('requires name and email', async () => {
    const res = await request(app).post('/api/guests').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/guests', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/guests')
    expect(res.statusCode).not.toBe(404)
  })
})

describe('POST /api/rate-recommendation', () => {
  it('requires property_id and date', async () => {
    const res = await request(app).post('/api/rate-recommendation').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/service-request', () => {
  it('requires guest_id and request', async () => {
    const res = await request(app).post('/api/service-request').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/forecast-inventory', () => {
  it('requires item and history', async () => {
    const res = await request(app).post('/api/forecast-inventory').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/suggest-upsells', () => {
  it('requires guest_id', async () => {
    const res = await request(app).post('/api/suggest-upsells').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/service-requests', () => {
  it('requires guest_id', async () => {
    const res = await request(app).get('/api/service-requests')
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/guest-chat', () => {
  it('requires question', async () => {
    const res = await request(app).post('/api/guest-chat').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/demand-forecast', () => {
  it('requires occupancy array', async () => {
    const res = await request(app).post('/api/demand-forecast').send({})
    expect(res.statusCode).toBe(400)
  })
})
