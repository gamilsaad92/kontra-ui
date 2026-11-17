'use strict';

const { buildTrialCheckoutResponse, STAGING_FRONTEND_ORIGIN } = require('./trialCheckout');

describe('buildTrialCheckoutResponse', () => {
  test('staging trial keeps the one-time capability out of its success URL', () => {
    const response = buildTrialCheckoutResponse({
      origin: 'https://staging.kontraplatform.com',
      plan: 'deal',
      propertyId: 'harbor-view--a1b2c3d4',
      propertyName: 'Harbor View Apartments',
      sessionId: 'session-123',
      isTrial: true,
      stagingIsolation: true,
      ownerExchangeToken: 'one-time-secret',
    });

    const url = new URL(response.url);
    expect(url.origin).toBe(STAGING_FRONTEND_ORIGIN);
    expect(url.pathname).toBe('/checkout/success');
    expect(url.searchParams.get('property')).toBe('harbor-view--a1b2c3d4');
    expect(url.search).not.toContain('one-time-secret');
    expect(url.searchParams.has('owner_token')).toBe(false);
    expect(url.searchParams.has('owner_exchange')).toBe(false);
    expect(response.ownerExchange).toEqual({
      propertyId: 'harbor-view--a1b2c3d4',
      token: 'one-time-secret',
    });
  });

  test('non-staging checkout keeps its existing owner-token URL contract', () => {
    const response = buildTrialCheckoutResponse({
      origin: 'https://kontraplatform.com',
      plan: 'deal',
      propertyId: 'legacy-room',
      sessionId: 'session-456',
      isTrial: false,
      stagingIsolation: false,
      ownerExchangeToken: 'existing-paid-owner-token',
    });

    expect(new URL(response.url).origin).toBe('https://kontraplatform.com');
    expect(new URL(response.url).searchParams.get('owner_token')).toBe('existing-paid-owner-token');
    expect(response.ownerExchange).toBeUndefined();
  });
});
