const express = require('express');
const request = require('supertest');

jest.mock('../lib/crud', () => ({
  listEntity: jest.fn(),
  createEntity: jest.fn(),
  getEntity: jest.fn(),
  updateEntity: jest.fn(),
}));

const { listEntity } = require('../lib/crud');
const { createEntityRouter } = require('./entityRouter');

describe('createEntityRouter list fallback', () => {
  function buildApp() {
    const app = express();
    app.use((req, _res, next) => {
      req.orgId = 'org-test';
      next();
    });
    app.use(createEntityRouter('/payments', 'payments'));
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty list when schema is missing', async () => {
    const error = new Error('schema missing');
    error.code = 'SCHEMA_MISSING';
    listEntity.mockRejectedValueOnce(error);

    const response = await request(buildApp()).get('/payments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], total: 0 });
  });

  it('returns empty list when database query fails', async () => {
    const error = new Error('db failure');
    error.code = 'DB_ERROR';
    listEntity.mockRejectedValueOnce(error);

    const response = await request(buildApp()).get('/payments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], total: 0 });
  });
});
