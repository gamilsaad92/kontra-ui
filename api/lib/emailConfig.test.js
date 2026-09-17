'use strict';

const fs = require('fs');
const path = require('path');
const {
  TRANSACTION_NOTIFICATION_ADDRESS,
  TRANSACTION_NOTIFICATION_FROM,
} = require('./emailConfig');

const sourceFiles = [
  '../index.js',
  './dealRoomHelpers.js',
  './taskEngine.js',
  '../routers/dealRoomSecurityV2.js',
  '../routers/verifiedAssetPackage.js',
  './pluginConnector.js',
  '../routers/delinquencyAlerts.js',
].map(file => path.resolve(__dirname, file));

describe('automated transaction email sender', () => {
  test('uses the notification-specific address and standardized display name', () => {
    expect(TRANSACTION_NOTIFICATION_ADDRESS).toBe('notifications@kontraplatform.com');
    expect(TRANSACTION_NOTIFICATION_FROM).toBe('Kontra <notifications@kontraplatform.com>');
  });

  test.each(sourceFiles)('%s imports the shared sender configuration', file => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('emailConfig');
    expect(source).not.toMatch(/from:\s*['"`]Kontra(?: Platform)? <(?:support|notifications)@kontraplatform\.com>['"`]/);
  });
});