'use strict';

const express = require('express');
const request = require('supertest');
const { createDeferredTask531Modules } = require('./deferredTask531Modules');

function buildApp(enabled) {
  const app = express();
  app.use('/api', createDeferredTask531Modules({ enabled }));
  app.get('/api/orgs', (_req, res) => res.json({ active: true }));
  app.get('/api/loans', (_req, res) => res.json({ loans: [] }));
  app.get('/api/public/deal-room/:propertyId', (req, res) => res.json({ property_id: req.params.propertyId }));
  app.post('/api/v2/deal-room/invite/request-otp', (_req, res) => res.json({ ok: true }));
  app.get('/api/workflow-packs', (_req, res) => res.json({ packs: [] }));
  app.get('/api/sso/config', (_req, res) => res.json({ configured: false }));
  return app;
}

describe('Task #531 deferred module boundary', () => {
  test.each([
    ['/api/orgs', 'institutional_tenancy'],
    ['/api/me/select', 'institutional_tenancy'],
    ['/api/organizations/123/members', 'institutional_tenancy'],
    ['/api/onboarding/members', 'institutional_tenancy'],
    ['/api/loans/123', 'lending_and_servicing'],
    ['/api/copilot/ask', 'lending_and_servicing'],
    ['/api/collections', 'lending_and_servicing'],
    ['/api/dashboard/overview', 'portfolio_and_dashboard'],
    ['/api/reports/export', 'institutional_reporting'],
    ['/api/mobile/overview', 'mobile_lending'],
    ['/api/sso/config', 'external_identity_integrations'],
  ])('returns a controlled deferred response for %s', async (path, module) => {
    const response = await request(buildApp(true)).get(path);
    expect(response.status).toBe(501);
    expect(response.body).toEqual(expect.objectContaining({
      code: 'TASK531_MODULE_DEFERRED',
      module,
    }));
  });

  test('does not match neighboring paths by prefix alone', async () => {
    const response = await request(buildApp(true)).get('/api/loans-archive');
    expect(response.status).toBe(404);
  });

  test.each([
    ['GET', '/api/public/deal-room/room-1', { property_id: 'room-1' }],
    ['POST', '/api/v2/deal-room/invite/request-otp', { ok: true }],
    ['GET', '/api/workflow-packs', { packs: [] }],
  ])('keeps current Deal Room route %s %s available', async (method, path, body) => {
    const response = await request(buildApp(true))[method.toLowerCase()](path);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(body);
  });

  test('passes deferred routes through when staging isolation is disabled', async () => {
    const response = await request(buildApp(false)).get('/api/orgs');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ active: true });
  });

  test('keeps external SSO deferred only while staging isolation is enabled', async () => {
    const staging = await request(buildApp(true)).get('/api/sso/config');
    const normal = await request(buildApp(false)).get('/api/sso/config');
    expect(staging.status).toBe(501);
    expect(staging.body.module).toBe('external_identity_integrations');
    expect(normal.status).toBe(200);
  });
});
