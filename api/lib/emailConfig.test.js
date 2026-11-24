'use strict';

const fs = require('fs');
const path = require('path');
const {
  TRANSACTION_NOTIFICATION_ADDRESS,
  TRANSACTION_NOTIFICATION_FROM,
} = require('./emailConfig');

const sourceFiles = [
  './dealRoomHelpers.js',
  './taskEngine.js',
  '../routers/dealRoomSecurityV2.js',
  '../routers/verifiedAssetPackage.js',
  './pluginConnector.js',
  '../routers/delinquencyAlerts.js',
].map(file => path.resolve(__dirname, file));
const apiSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const inviteRouteStart = apiSource.indexOf(
  "app.post('/api/public/deal-room/:propertyId/create-invite'",
);
const inviteRouteEnd = apiSource.indexOf(
  "app.get('/api/public/deal-room/:propertyId/invites'",
  inviteRouteStart,
);
const participantInviteRoute = apiSource.slice(inviteRouteStart, inviteRouteEnd);

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

  test('V1 participant invitations use the verified staging-aware email configuration', () => {
    expect(inviteRouteStart).toBeGreaterThanOrEqual(0);
    expect(inviteRouteEnd).toBeGreaterThan(inviteRouteStart);
    expect(participantInviteRoute).toContain('getOtpEmailConfiguration({');
    expect(participantInviteRoute).toContain('stagingIsolationVerified: stagingEnvironment.enabled');
    expect(participantInviteRoute).toContain('sendResendEmail(inviteEmailConfig.apiKey,');
    expect(participantInviteRoute).toContain('from: inviteEmailConfig.from,');
    expect(participantInviteRoute).not.toContain('process.env.RESEND_API_KEY');
  });
});