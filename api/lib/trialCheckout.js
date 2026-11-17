'use strict';

const STAGING_FRONTEND_ORIGIN = 'https://kontra-ui-staging.vercel.app';

function buildTrialCheckoutResponse({
  origin,
  plan,
  propertyId,
  propertyName,
  sessionId,
  isTrial,
  stagingIsolation,
  ownerExchangeToken,
}) {
  const stagingTrial = isTrial === true && stagingIsolation === true;
  const successUrl = new URL(
    '/checkout/success',
    stagingTrial ? STAGING_FRONTEND_ORIGIN : origin,
  );
  successUrl.searchParams.set('plan', plan || 'deal');
  successUrl.searchParams.set('property', propertyId);
  if (propertyName) successUrl.searchParams.set('name', propertyName);
  successUrl.searchParams.set('session_id', sessionId);
  successUrl.searchParams.set('demo', 'true');
  successUrl.searchParams.set('trial', String(isTrial === true));

  if (stagingTrial) {
    return {
      url: successUrl.toString(),
      ownerExchange: { propertyId, token: ownerExchangeToken },
    };
  }

  successUrl.searchParams.set('owner_token', ownerExchangeToken);
  return { url: successUrl.toString() };
}

module.exports = { STAGING_FRONTEND_ORIGIN, buildTrialCheckoutResponse };
