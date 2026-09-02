process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.SENTRY_DSN = 'test';
process.env.STRIPE_SECRET_KEY = 'test';
process.env.PII_ENCRYPTION_KEY = 'test';

jest.mock('./middlewares/authenticate', () => jest.fn((req, res, next) => next()));

jest.mock('./webhooks', () => ({
  listWebhooks: jest.fn().mockResolvedValue([]),
  addWebhook: jest.fn().mockResolvedValue(),
  removeWebhook: jest.fn().mockResolvedValue(),
  WEBHOOK_TOPICS: ['trade.created', 'loan.approved']
}));

const express = require('express');
const request = require('supertest');
const authenticate = require('./middlewares/authenticate');
const { addWebhook, removeWebhook } = require('./webhooks');
const webhooksRouter = require('./routers/webhookRoutes');

const app = express();
app.use(express.json());
app.use('/api', webhooksRouter);

describe('Webhook routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockImplementation((req, res, next) => {
      req.user = { id: 'user-1' };
      next();
    });
  });

  it('registers webhook with valid event and url', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .send({ event: 'trade.created', url: 'https://example.com/hook' });

    expect(response.statusCode).toBe(201);
    expect(addWebhook).toHaveBeenCalledWith('trade.created', 'https://example.com/hook');
  });

  it('rejects unauthorized requests', async () => {
    authenticate.mockImplementation((req, res) => {
      res.status(401).json({ error: 'unauthorized' });
    });

    const response = await request(app)
      .post('/api/webhooks')
      .send({ event: 'trade.created', url: 'https://example.com/hook' });

    expect(response.statusCode).toBe(401);
    expect(addWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid event topics on create', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .send({ event: 'unknown.event', url: 'https://example.com/hook' });

    expect(response.statusCode).toBe(400);
    expect(addWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook url on create', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .send({ event: 'trade.created', url: 'not-a-url' });

    expect(response.statusCode).toBe(400);
    expect(addWebhook).not.toHaveBeenCalled();
  });

  it('removes webhook for valid event and url', async () => {
    const response = await request(app)
      .delete('/api/webhooks')
      .send({ event: 'loan.approved', url: 'https://example.com/hook' });

    expect(response.statusCode).toBe(200);
    expect(removeWebhook).toHaveBeenCalledWith('loan.approved', 'https://example.com/hook');
  });

  it('rejects invalid event topics on delete', async () => {
    const response = await request(app)
      .delete('/api/webhooks')
      .send({ event: 'something.else', url: 'https://example.com/hook' });

    expect(response.statusCode).toBe(400);
    expect(removeWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook url on delete', async () => {
    const response = await request(app)
      .delete('/api/webhooks')
      .send({ event: 'trade.created', url: 'ftp://example.com/hook' });

    expect(response.statusCode).toBe(400);
    expect(removeWebhook).not.toHaveBeenCalled();
  });
});
