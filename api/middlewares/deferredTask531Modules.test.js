'use strict';

const express = require('express');
const request = require('supertest');
const { createDeferredTask531Modules } = require('./deferredTask531Modules');

function buildApp(enabled) {
  const app = express();
  app.use('/api', createDeferredTask531Modules({ enabled }));
  app.get('/api/orgs', (_req, res) => res.json({ active: true }));
  app.post('/api/organizations', (_req, res) => res.status(201).json({ created: true }));
  app.get('/api/organizations/:id', (req, res) => res.json({ id: req.params.id }));
  app.get('/api/me', (_req, res) => res.json({ authenticatedRouteReached: true }));
  app.get('/api/me/bootstrap', (_req, res) => res.json({ authenticatedRouteReached: true }));
  app.get('/api/me/active', (_req, res) => res.json({ authenticatedRouteReached: true }));
  app.post('/api/me', (_req, res) => res.status(201).json({ created: true }));
  app.post('/api/me/select', (_req, res) => res.json({ selected: true }));
  app.get('/api/onboarding/me', (_req, res) => res.json({ authenticatedRouteReached: true }));
  app.post('/api/onboarding/invite', (_req, res) => res.status(201).json({ invited: true }));
  app.post('/api/invites/accept', (_req, res) => res.status(201).json({ accepted: true }));
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
    ['/api/invites/accept', 'institutional_tenancy'],
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

  test.each([
    ['POST', '/api/organizations', 201],
    ['GET', '/api/organizations/org-1', 200],
    ['GET', '/api/me', 200],
    ['GET', '/api/me/bootstrap', 200],
    ['GET', '/api/me/active', 200],
    ['POST', '/api/me', 201],
    ['POST', '/api/me/select', 200],
    ['GET', '/api/onboarding/me', 200],
    ['POST', '/api/onboarding/invite', 201],
  ])('passes canonical organization route %s %s through staging deferral', async (method, path, status) => {
    const response = await request(buildApp(true))[method.toLowerCase()](path);
    expect(response.status).toBe(status);
    expect(response.body.code).not.toBe('TASK531_MODULE_DEFERRED');
  });

  test('keeps unsupported /api/me paths behind normal routing, not the deferred stub', async () => {
    const response = await request(buildApp(true)).get('/api/me/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body.code).not.toBe('TASK531_MODULE_DEFERRED');
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
