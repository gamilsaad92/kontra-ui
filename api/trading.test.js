process.env.SUPABASE_URL = 'http://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
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

const fs = require('fs')
const path = require('path')
const request = require('supertest')

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc')

function buildApp() {
  const express = require('express')
  const app = express()
  const tradesRouter = require('./routers/trades')
  app.use(express.json())
  app.use('/api', tradesRouter)
  return app
}

describe('Trading API', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.FEATURE_FLAGS = ''
    delete process.env.KYC_API_URL
    delete process.env.KYC_API_KEY
    delete global.fetch
    app = buildApp()
  })

  afterEach(() => {
    if (fs.existsSync(AUDIT_PATH)) fs.unlinkSync(AUDIT_PATH)
  })

  describe('trade creation', () => {
    it('creates a trade with valid payload', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ symbol: 'AAPL', quantity: 10, price: 150 })
      expect(res.statusCode).toBe(201)
      expect(res.body.trade.symbol).toBe('AAPL')
    })

    it('rejects trade with missing fields', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ quantity: 5 })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('listing trades with filters', () => {
    it('filters by symbol and status', async () => {
      await request(app).post('/api/trades').send({ symbol: 'AAA', quantity: 1, price: 1 })
      const created = await request(app).post('/api/trades').send({ symbol: 'BBB', quantity: 2, price: 1 })
      await request(app).post(`/api/trades/${created.body.trade.id}/settle`)

      let res = await request(app).get('/api/trades?symbol=AAA')
      expect(res.body.trades).toHaveLength(1)
      expect(res.body.trades[0].symbol).toBe('AAA')

      res = await request(app).get('/api/trades?status=settled')
      expect(res.body.trades).toHaveLength(1)
      expect(res.body.trades[0].status).toBe('settled')
    })
  })

  describe('settlement flow', () => {
    it('settles a trade after creation', async () => {
      const created = await request(app)
        .post('/api/trades')
        .send({ symbol: 'XYZ', quantity: 3, price: 100 })
      const id = created.body.trade.id

      const res = await request(app).post(`/api/trades/${id}/settle`)
      expect(res.statusCode).toBe(200)
      expect(res.body.trade.status).toBe('settled')
    })
  })

  describe('with kyc feature flag', () => {
    beforeEach(() => {
      process.env.FEATURE_FLAGS = 'kyc'
      process.env.KYC_API_URL = 'http://kyc.test'
      process.env.KYC_API_KEY = 'key'
      global.fetch = jest.fn()
      jest.resetModules()
      app = buildApp()
    })

    it('rejects trade when kyc fails and prevents settlement', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({ passed: false }) })
      const res = await request(app)
        .post('/api/trades')
        .send({ symbol: 'FAIL', quantity: 1, price: 1, counterparties: ['cp1'] })
      expect(res.statusCode).toBe(400)

      const settle = await request(app).post('/api/trades/1/settle')
      expect(settle.statusCode).toBe(404)
    })

    it('allows trade and settlement when kyc passes', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({ passed: true }) })
      const created = await request(app)
        .post('/api/trades')
        .send({ symbol: 'PASS', quantity: 1, price: 1, counterparties: ['cp1'] })
      expect(created.statusCode).toBe(201)

      const id = created.body.trade.id
      const settle = await request(app).post(`/api/trades/${id}/settle`)
      expect(settle.statusCode).toBe(200)
      expect(settle.body.trade.status).toBe('settled')
      expect(fetch).toHaveBeenCalled()
    })
  })
})
