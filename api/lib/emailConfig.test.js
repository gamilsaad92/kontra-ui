'use strict';

const fs = require('fs');
const path = require('path');
const {
  TRANSACTION_NOTIFICATION_ADDRESS,
  TRANSACTION_NOTIFICATION_FROM,
  getPilotEmailDispatchPolicy,
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
const pilotCreateRouteStart = apiSource.indexOf(
  "app.post('/api/admin/create-pilot-workspace'",
);
const pilotResendRouteStart = apiSource.indexOf(
  "app.post('/api/admin/send-pilot-link'",
);
const pilotResendRouteEnd = apiSource.indexOf(
  "app.get('/api/admin/pilot-workspaces'",
  pilotResendRouteStart,
);
const pilotCreateRoute = apiSource.slice(pilotCreateRouteStart, pilotResendRouteStart);
const pilotResendRoute = apiSource.slice(pilotResendRouteStart, pilotResendRouteEnd);

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

  test('pilot handoff suppresses welcome and resend mail in verified staging', () => {
    const policy = getPilotEmailDispatchPolicy({
      env: {
        RESEND_API_KEY: 'production-key-must-not-be-selected',
        STAGING_RESEND_API_KEY: 'staging-key',
        STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
      },
      stagingIsolationVerified: true,
    });

    expect(policy).toEqual({
      apiKey: 'staging-key',
      from: 'Kontra Staging <staging@example.test>',
      configured: true,
      sendAllowed: false,
      deliveryStatus: 'suppressed_staging',
    });
  });

  test('pilot handoff stays email-free in staging when staging mail is unconfigured', () => {
    const policy = getPilotEmailDispatchPolicy({
      env: { RESEND_API_KEY: 'production-key-must-not-be-used' },
      stagingIsolationVerified: true,
    });

    expect(policy.sendAllowed).toBe(false);
    expect(policy.deliveryStatus).toBe('suppressed_staging');
    expect(policy.apiKey).toBe('');
  });

  test('pilot handoff keeps configured production delivery behavior', () => {
    const policy = getPilotEmailDispatchPolicy({
      env: {
        RESEND_API_KEY: 'production-key',
        STAGING_RESEND_API_KEY: 'staging-key-must-not-be-selected',
        STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
      },
      stagingIsolationVerified: false,
    });

    expect(policy).toEqual({
      apiKey: 'production-key',
      from: TRANSACTION_NOTIFICATION_FROM,
      configured: true,
      sendAllowed: true,
      deliveryStatus: 'ready',
    });
  });

  test('pilot creation uses the shared policy and never mails from verified staging', () => {
    expect(pilotCreateRouteStart).toBeGreaterThanOrEqual(0);
    expect(pilotResendRouteStart).toBeGreaterThan(pilotCreateRouteStart);
    expect(pilotCreateRoute).toContain('getPilotEmailDispatchPolicy({');
    expect(pilotCreateRoute).toContain('stagingIsolationVerified: stagingEnvironment.enabled');
    expect(pilotCreateRoute).toContain('if (pilotEmailPolicy.sendAllowed)');
    expect(pilotCreateRoute).toContain('emailDeliveryStatus');
    expect(pilotCreateRoute).not.toContain('process.env.RESEND_API_KEY');
  });

  test('pilot resend returns a staging suppression result before any provider call', () => {
    expect(pilotResendRouteStart).toBeGreaterThanOrEqual(0);
    expect(pilotResendRouteEnd).toBeGreaterThan(pilotResendRouteStart);
    expect(pilotResendRoute).toContain('stagingIsolationVerified: stagingEnvironment.enabled');
    expect(pilotResendRoute).toContain("emailDeliveryStatus: 'suppressed_staging'");
    expect(pilotResendRoute).toContain('sendResendEmail(pilotEmailPolicy.apiKey,');
    expect(pilotResendRoute).not.toContain('process.env.RESEND_API_KEY');
  });
});