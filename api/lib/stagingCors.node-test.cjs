'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STAGING_TRUSTED_ORIGINS,
  createTrustedOriginSet,
  createCorsOriginCallback,
  createOwnerCookieOriginGuard,
} = require('./corsSecurity');

test('staging CORS is pinned to the authorized staging origin', async () => {
  const trusted = createTrustedOriginSet({
    stagingIsolation: true,
    corsOrigins: 'https://kontraplatform.com,https://unreviewed.example',
    frontendUrl: 'https://kontraplatform.com',
  });
  assert.deepEqual([...trusted], [...STAGING_TRUSTED_ORIGINS]);

  const check = origin => new Promise((resolve, reject) => {
    createCorsOriginCallback(trusted)(origin, (error, allowed) => (
      error ? reject(error) : resolve(allowed)
    ));
  });
  assert.equal(await check('https://staging.kontraplatform.com'), true);
  assert.equal(await check('https://kontraplatform.com'), false);
  assert.equal(await check('https://unreviewed.example'), false);
  assert.equal(await check('https://evil.vercel.app'), false);
});

test('staging owner-cookie mutations reject missing and unauthorized origins', () => {
  const trusted = createTrustedOriginSet({ stagingIsolation: true });
  const guard = createOwnerCookieOriginGuard({ trustedOrigins: trusted });
  const invoke = origin => {
    let statusCode = null;
    let nextCalled = false;
    guard(
      { method: 'POST', headers: { cookie: 'kontra_owner_session=synthetic', ...(origin ? { origin } : {}) } },
      {
        status(code) { statusCode = code; return this; },
        json() { return this; },
      },
      () => { nextCalled = true; },
    );
    return { statusCode, nextCalled };
  };

  assert.deepEqual(invoke(), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invoke('https://kontraplatform.com'), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invoke('https://staging.kontraplatform.com'), { statusCode: null, nextCalled: true });
});
