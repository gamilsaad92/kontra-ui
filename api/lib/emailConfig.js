'use strict';

// Automated Kontra workflow mail must use a notification-specific identity.
// Keep support@kontraplatform.com reserved for support and contact workflows.
const TRANSACTION_NOTIFICATION_ADDRESS = 'notifications@kontraplatform.com';
const TRANSACTION_NOTIFICATION_FROM = `Kontra <${TRANSACTION_NOTIFICATION_ADDRESS}>`;

function getOtpEmailConfiguration({ env = process.env, stagingIsolationVerified = false } = {}) {
  if (stagingIsolationVerified) {
    const apiKey = typeof env.STAGING_RESEND_API_KEY === 'string'
      ? env.STAGING_RESEND_API_KEY.trim()
      : '';
    const from = typeof env.STAGING_RESEND_FROM === 'string'
      ? env.STAGING_RESEND_FROM.trim()
      : '';

    return { apiKey, from, configured: Boolean(apiKey && from) };
  }

  const apiKey = env.RESEND_API_KEY;
  return {
    apiKey,
    from: TRANSACTION_NOTIFICATION_FROM,
    configured: Boolean(apiKey),
  };
}

module.exports = {
  TRANSACTION_NOTIFICATION_ADDRESS,
  TRANSACTION_NOTIFICATION_FROM,
  getOtpEmailConfiguration,
};
