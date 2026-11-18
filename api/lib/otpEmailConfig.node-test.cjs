'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingEnvironment } = require('./stagingEnvironment');
const {
  TRANSACTION_NOTIFICATION_FROM,
  getOtpEmailConfiguration,
} = require('./emailConfig');

function validStagingEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    KONTRA_STAGING_ISOLATION: 'true',
    STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-role-key-for-tests-only-123456',
    STAGING_OPENAI_API_KEY: 'synthetic-staging-openai-key-for-tests-only-123456',
    STAGING_SESSION_SECRET: 'synthetic-staging-session-secret-for-tests-only-123456',
    ...overrides,
  };
}

test('verified staging isolation selects the staging Resend key and sender', () => {
  const env = validStagingEnv({
    STAGING_RESEND_API_KEY: 'synthetic-staging-resend-key',
    STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
    RESEND_API_KEY: 'synthetic-production-resend-key',
  });
  const isolation = assertStagingEnvironment(env);

  assert.deepEqual(
    getOtpEmailConfiguration({ env, stagingIsolationVerified: isolation.enabled }),
    {
      apiKey: 'synthetic-staging-resend-key',
      from: 'Kontra Staging <staging@example.test>',
      configured: true,
    },
  );
});

test('incomplete staging settings fail closed without falling back to production', () => {
  const env = validStagingEnv({
    STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
    RESEND_API_KEY: 'synthetic-production-resend-key',
  });
  const isolation = assertStagingEnvironment(env);

  assert.deepEqual(
    getOtpEmailConfiguration({ env, stagingIsolationVerified: isolation.enabled }),
    {
      apiKey: '',
      from: 'Kontra Staging <staging@example.test>',
      configured: false,
    },
  );
});

test('staging also fails closed when its sender is missing', () => {
  const env = validStagingEnv({
    STAGING_RESEND_API_KEY: 'synthetic-staging-resend-key',
  });
  const isolation = assertStagingEnvironment(env);

  assert.deepEqual(
    getOtpEmailConfiguration({ env, stagingIsolationVerified: isolation.enabled }),
    {
      apiKey: 'synthetic-staging-resend-key',
      from: '',
      configured: false,
    },
  );
});

test('production retains RESEND_API_KEY and the existing sender', () => {
  const env = {
    NODE_ENV: 'production',
    RESEND_API_KEY: 'synthetic-production-resend-key',
    STAGING_RESEND_API_KEY: 'synthetic-staging-resend-key',
    STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
  };
  const isolation = assertStagingEnvironment(env);

  assert.deepEqual(
    getOtpEmailConfiguration({ env, stagingIsolationVerified: isolation.enabled }),
    {
      apiKey: 'synthetic-production-resend-key',
      from: TRANSACTION_NOTIFICATION_FROM,
      configured: true,
    },
  );
});

test('staging credentials are ignored when the staging guard is not enabled', () => {
  const env = {
    NODE_ENV: 'production',
    STAGING_RESEND_API_KEY: 'synthetic-staging-resend-key',
    STAGING_RESEND_FROM: 'Kontra Staging <staging@example.test>',
  };
  const isolation = assertStagingEnvironment(env);

  assert.deepEqual(
    getOtpEmailConfiguration({ env, stagingIsolationVerified: isolation.enabled }),
    {
      apiKey: undefined,
      from: TRANSACTION_NOTIFICATION_FROM,
      configured: false,
    },
  );
});
