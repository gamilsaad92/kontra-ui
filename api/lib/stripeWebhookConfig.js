function isStripeWebhookConfigured() {
  return typeof process.env.STRIPE_WEBHOOK_SECRET === 'string'
    && process.env.STRIPE_WEBHOOK_SECRET.trim().length > 0;
}

module.exports = { isStripeWebhookConfigured };
