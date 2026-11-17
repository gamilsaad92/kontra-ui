'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrialCheckoutResponse, STAGING_FRONTEND_ORIGIN } = require('./trialCheckout');

test('staging trial response puts the one-time capability only in the response body', () => {
  const response = buildTrialCheckoutResponse({
    origin: 'https://staging.kontraplatform.com',
    plan: 'deal',
    propertyId: 'room--a1b2c3d4',
    propertyName: 'Sample Room',
    sessionId: 'synthetic-session',
    isTrial: true,
    stagingIsolation: true,
    ownerExchangeToken: 'synthetic-one-time-capability',
  });
  const url = new URL(response.url);
  assert.equal(url.origin, STAGING_FRONTEND_ORIGIN);
  assert.equal(url.pathname, '/checkout/success');
  assert.equal(url.searchParams.get('property'), 'room--a1b2c3d4');
  assert.equal(url.search.includes('synthetic-one-time-capability'), false);
  assert.equal(url.searchParams.has('owner_token'), false);
  assert.equal(url.searchParams.has('owner_exchange'), false);
  assert.equal(response.ownerExchange.token, 'synthetic-one-time-capability');
});

test('non-staging checkout preserves the legacy owner token redirect', () => {
  const response = buildTrialCheckoutResponse({
    origin: 'https://kontraplatform.com',
    plan: 'deal',
    propertyId: 'legacy-room',
    sessionId: 'synthetic-session',
    isTrial: false,
    stagingIsolation: false,
    ownerExchangeToken: 'synthetic-paid-token',
  });
  assert.equal(new URL(response.url).searchParams.get('owner_token'), 'synthetic-paid-token');
  assert.equal(response.ownerExchange, undefined);
});
