'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertStagingEnvironment,
  assertStagingDatabaseEnvironment,
  isStagingIsolationEnabled,
  isStagingStripeReady,
} = require('./stagingIsolation');

function validEnvironment(overrides = {}) {
  return {
    KONTRA_STAGING_ISOLATION: 'true',
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://jpemuoapbgzwapydqiio.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'staging-service-role-test-key',
    OPENAI_API_KEY: 'staging-openai-test-key',
    FRONTEND_URL: 'https://staging.kontra.example',
    CORS_ORIGINS: 'https://staging.kontra.example',
    ...overrides,
  };
}

test('staging isolation is explicit and valid staging configuration passes', () => {
  assert.equal(isStagingIsolationEnabled({}), false);
  assert.doesNotThrow(() => assertStagingEnvironment(validEnvironment()));
});

test('staging rejects database overrides and a non-designated Supabase project', () => {
  assert.throws(
    () => assertStagingDatabaseEnvironment(validEnvironment({ DATABASE_URL: 'postgres://test' })),
    /database overrides/,
  );
  assert.throws(
    () => assertStagingDatabaseEnvironment(validEnvironment({
      SUPABASE_URL: 'https://production-project.supabase.co',
    })),
    /jpemuoapbgzwapydqiio/,
  );
});

test('staging rejects missing credentials, OpenAI key aliases, and production origins', () => {
  assert.throws(() => assertStagingEnvironment(validEnvironment({ OPENAI_API_KEY: '' })), /OPENAI_API_KEY/);
  assert.throws(() => assertStagingEnvironment(validEnvironment({ OPENAI_API_KEY1: 'alias' })), /OPENAI_API_KEY1/);
  assert.throws(() => assertStagingEnvironment(validEnvironment({
    FRONTEND_URL: 'https://kontraplatform.com',
    CORS_ORIGINS: 'https://kontraplatform.com',
  })), /staging origin/);
  assert.throws(() => assertStagingEnvironment(validEnvironment({
    CORS_ORIGINS: 'https://staging.kontra.example,https://www.kontraplatform.com',
  })), /CORS_ORIGINS/);
});

test('staging Stripe remains disabled unless explicitly enabled with test credentials and a webhook secret', () => {
  const env = validEnvironment({
    STAGING_STRIPE_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_staging_example',
  });
  assert.equal(isStagingStripeReady({ ...env, STAGING_STRIPE_ENABLED: 'false' }), false);
  assert.equal(isStagingStripeReady({ ...env, STRIPE_SECRET_KEY: 'sk_live_example' }), false);
  assert.equal(isStagingStripeReady({ ...env, STRIPE_WEBHOOK_SECRET: '' }), false);
  assert.equal(isStagingStripeReady(env), true);
});

test('API wiring disables trial creation, broad CORS, background schedules, and startup DDL in staging', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const db = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const mailHelpers = fs.readFileSync(path.join(__dirname, 'dealRoomHelpers.js'), 'utf8');
  assert.match(api, /app\.post\(\['\/api\/checkout\/demo', '\/api\/checkout\/trial'\][\s\S]{0,350}if \(STAGING_ISOLATION_ENABLED\)/);
  assert.match(api, /app\.post\('\/api\/checkout\/owner-token'[\s\S]{0,300}isStripeWebhookConfigured\(\)/);
  assert.match(api, /STAGING_ISOLATION_ENABLED\s*\?\s*envOrigins/);
  assert.match(api, /if \(process\.env\.NODE_ENV === 'production' && !STAGING_ISOLATION_ENABLED\)\s*\{\s*startJobSchedulers\(\)/);
  assert.match(api, /if \(!STAGING_ISOLATION_ENABLED\) void ensureWorkflowPackIdColumn\(\)/);
  assert.match(db, /else if \(stagingIsolationEnabled\)\s*\{\s*throw new Error/);
  assert.doesNotMatch(mailHelpers, /href="https:\/\/kontraplatform\.com\/deal-room/);
  assert.match(mailHelpers, /href="\$\{FRONTEND_URL\}\/deal-room/);
});
