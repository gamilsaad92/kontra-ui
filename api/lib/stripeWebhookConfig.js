const { isStagingIsolationEnabled, isStagingStripeReady } = require('./stagingIsolation');

function isStripeWebhookConfigured() {
  if (isStagingIsolationEnabled()) return isStagingStripeReady();
  return typeof process.env.STRIPE_WEBHOOK_SECRET === 'string'
    && process.env.STRIPE_WEBHOOK_SECRET.trim().length > 0;
}

module.exports = { isStripeWebhookConfigured };
