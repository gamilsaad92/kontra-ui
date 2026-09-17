'use strict';

// Automated Kontra workflow mail must use a notification-specific identity.
// Keep support@kontraplatform.com reserved for support and contact workflows.
const TRANSACTION_NOTIFICATION_ADDRESS = 'notifications@kontraplatform.com';
const TRANSACTION_NOTIFICATION_FROM = `Kontra <${TRANSACTION_NOTIFICATION_ADDRESS}>`;

module.exports = {
  TRANSACTION_NOTIFICATION_ADDRESS,
  TRANSACTION_NOTIFICATION_FROM,
};