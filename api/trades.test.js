process.env.SUPABASE_URL = 'http://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.FEATURE_FLAGS = ''
process.env.OPENAI_API_KEY = 'test'
process.env.SENTRY_DSN = 'test'
process.env.STRIPE_SECRET_KEY = 'test'
process.env.PII_ENCRYPTION_KEY = 'test'
jest.mock('./middlewares/authenticate', () => (req, res, next) => {
  req.user = { id: 'test' }
  req.organizationId = 'org1'
  next()
})
jest.mock('./webhooks', () => ({ triggerWebhooks: jest.fn() }))
const express = require('express')
const request = require('supertest')
const tradesRouter = require('./routers/trades')

const app = express()
app.use(express.json())
app.use('/api', tradesRouter)

describe('POST /api/trades', () => {
  it('rejects trades exceeding risk limit', async () => {
    const res = await request(app)
      .post('/api/trades')
      .send({ symbol: 'ABC', quantity: 2000000, price: 1, counterparties: ['cp1'] })
    expect(res.statusCode).toBe(400)
  })

  it('accepts trades within risk limit', async () => {
    const res = await request(app)
      .post('/api/trades')
      .send({ symbol: 'XYZ', quantity: 10, price: 100, counterparties: ['cp1'] })
    expect(res.statusCode).toBe(201)
    expect(res.body.trade).toBeDefined()
  })
})
