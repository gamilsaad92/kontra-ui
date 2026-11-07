'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const request = require('supertest');
const {
  createTrustedOriginSet,
  createOwnerCookieOriginGuard,
  createCorsOriginCallback,
  isTrustedOrigin,
  normalizeOrigin,
} = require('./corsSecurity');

const trustedOrigins = createTrustedOriginSet({
  corsOrigins: 'https://review.kontraplatform.com,https://custom.example.test',
});

function createTestApp() {
  let mutations = 0;
  const app = express();
  app.use(createOwnerCookieOriginGuard({ trustedOrigins }));
  app.use(cors({
    origin: createCorsOriginCallback(trustedOrigins),
    credentials: true,
  }));
  app.get('/owner-only', (req, res) => {
    if (!String(req.headers.cookie || '').includes('kontra_owner_session=')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return res.json({ room: 'private' });
  });
  app.post('/owner-only', (req, res) => {
    if (!String(req.headers.cookie || '').includes('kontra_owner_session=')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    mutations += 1;
    return res.json({ mutations });
  });
  return { app, getMutations: () => mutations };
}

function runGuard(guard, { method = 'GET', origin, cookie } = {}) {
  const req = { method, headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) } };
  let nextCalled = false;
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  guard(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, body };
}

test('only exact configured frontend origins are trusted', () => {
  assert.equal(isTrustedOrigin('https://kontraplatform.com', trustedOrigins), true);
  assert.equal(isTrustedOrigin('https://review.kontraplatform.com', trustedOrigins), true);
  assert.equal(isTrustedOrigin('https://evil.vercel.app', trustedOrigins), false);
  assert.equal(isTrustedOrigin('https://evil.replit.dev', trustedOrigins), false);
  assert.equal(isTrustedOrigin('https://evil.repl.co', trustedOrigins), false);
});

test('staging isolation excludes production and user-configured origins', () => {
  const stagingOrigins = createTrustedOriginSet({
    stagingIsolation: true,
    corsOrigins: 'https://kontraplatform.com,https://attacker.example',
    frontendUrl: 'https://kontraplatform.com',
  });
  assert.equal(stagingOrigins.size, 1);
  assert.equal(isTrustedOrigin('https://staging.kontraplatform.com', stagingOrigins), true);
  assert.equal(isTrustedOrigin('https://kontraplatform.com', stagingOrigins), false);
  assert.equal(isTrustedOrigin('https://attacker.example', stagingOrigins), false);
});

test('malformed and opaque origins never normalize into trusted origins', () => {
  for (const origin of ['null', '', 'https://kontraplatform.com/', 'https://kontraplatform.com/path', 'https://good.test,https://evil.test', 'javascript:alert(1)']) {
    assert.equal(normalizeOrigin(origin), null);
    assert.equal(isTrustedOrigin(origin, trustedOrigins), false);
  }
});

test('CORS grants credentialed browser access only for exact trusted origins', () => {
  const originCallback = createCorsOriginCallback(trustedOrigins);
  const check = (origin) => new Promise((resolve, reject) => {
    originCallback(origin, (error, allowed) => error ? reject(error) : resolve(allowed));
  });
  return Promise.all([
    check('https://kontraplatform.com'),
    check('https://evil.vercel.app'),
    check('null'),
    check(undefined),
  ]).then(([trusted, wildcard, malformed, noOrigin]) => {
    assert.equal(trusted, true);
    assert.equal(wildcard, false);
    assert.equal(malformed, false);
    assert.equal(noOrigin, true);
  });
});

test('safe same-origin owner-cookie reads may omit Origin, but untrusted origins are rejected', () => {
  const guard = createOwnerCookieOriginGuard({ trustedOrigins });
  assert.equal(runGuard(guard, { cookie: 'kontra_owner_session=secret' }).nextCalled, true);
  assert.equal(runGuard(guard, { cookie: 'kontra_owner_session=secret', origin: 'https://custom.example.test' }).nextCalled, true);
  const untrusted = runGuard(guard, { cookie: 'kontra_owner_session=secret', origin: 'https://evil.vercel.app' });
  assert.equal(untrusted.statusCode, 403);
  assert.equal(untrusted.body.error, 'UNTRUSTED_ORIGIN');
});

test('owner-cookie state changes require a trusted, well-formed Origin', () => {
  const guard = createOwnerCookieOriginGuard({ trustedOrigins });
  const missing = runGuard(guard, { method: 'POST', cookie: 'kontra_owner_session=secret' });
  assert.equal(missing.statusCode, 403);
  assert.equal(missing.body.error, 'TRUSTED_ORIGIN_REQUIRED');
  const malformed = runGuard(guard, {
    method: 'DELETE',
    origin: 'null',
    cookie: 'kontra_owner_session=secret',
  });
  assert.equal(malformed.statusCode, 403);
  assert.equal(malformed.body.error, 'UNTRUSTED_ORIGIN');
  assert.equal(runGuard(guard, {
    method: 'PATCH',
    origin: 'https://kontraplatform.com',
    cookie: 'kontra_owner_session=secret',
  }).nextCalled, true);
});

test('legacy-token requests without the owner cookie keep their existing path', () => {
  const guard = createOwnerCookieOriginGuard({ trustedOrigins });
  assert.equal(runGuard(guard, { method: 'POST' }).nextCalled, true);
});

test('owner-session exchange requires a trusted Origin even before a cookie exists', () => {
  const guard = createOwnerCookieOriginGuard({ trustedOrigins, requireOrigin: true });
  assert.equal(runGuard(guard, { method: 'POST' }).statusCode, 403);
  assert.equal(runGuard(guard, {
    method: 'POST',
    origin: 'https://evil.replit.dev',
  }).statusCode, 403);
  assert.equal(runGuard(guard, {
    method: 'POST',
    origin: 'https://kontraplatform.com',
  }).nextCalled, true);
});

test('untrusted origins cannot read credentialed owner-only responses', async () => {
  const { app } = createTestApp();
  const response = await request(app)
    .get('/owner-only')
    .set('Origin', 'https://attacker.vercel.app')
    .set('Cookie', 'kontra_owner_session=opaque');
  assert.equal(response.status, 403);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('trusted origins can use the room-scoped owner cookie through same-origin routing', async () => {
  const { app } = createTestApp();
  const response = await request(app)
    .get('/owner-only')
    .set('Origin', 'https://kontraplatform.com')
    .set('Cookie', 'kontra_owner_session=opaque');
  assert.equal(response.status, 200);
  assert.equal(response.headers['access-control-allow-origin'], 'https://kontraplatform.com');
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
});

test('untrusted or missing origins cannot perform owner-cookie state changes', async () => {
  const { app, getMutations } = createTestApp();
  const untrusted = await request(app)
    .post('/owner-only')
    .set('Origin', 'https://attacker.replit.dev')
    .set('Cookie', 'kontra_owner_session=opaque');
  const missing = await request(app)
    .post('/owner-only')
    .set('Cookie', 'kontra_owner_session=opaque');
  assert.equal(untrusted.status, 403);
  assert.equal(missing.status, 403);
  assert.equal(getMutations(), 0);
});
