'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingEnvironment, STAGING_SUPABASE_URL } = require('./stagingEnvironment');

const valid = () => ({
  NODE_ENV: 'production',
  KONTRA_STAGING_ISOLATION: 'true',
  STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-role-key-for-tests-only-123456',
  STAGING_OPENAI_API_KEY: 'synthetic-staging-openai-key-for-tests-only-123456',
  STAGING_SESSION_SECRET: 'synthetic-staging-session-secret-for-tests-only-123456',
});

test('staging identity maps only staging credentials and pins the approved project', () => {
  const env = {
    ...valid(),
    OPENAI_API_KEY: 'not-used',
    OPENAI_API_KEY1: 'not-used-either',
    CORS_ORIGINS: 'https://kontraplatform.com',
    FRONTEND_URL: 'https://kontraplatform.com',
  };
  const result = assertStagingEnvironment(env);
  assert.equal(result.enabled, true);
  assert.equal(env.SUPABASE_URL, STAGING_SUPABASE_URL);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'synthetic-staging-role-key-for-tests-only-123456');
  assert.equal(env.OPENAI_API_KEY, 'synthetic-staging-openai-key-for-tests-only-123456');
  assert.equal(env.SESSION_SECRET, 'synthetic-staging-session-secret-for-tests-only-123456');
  assert.equal(env.OPENAI_API_KEY1, undefined);
  assert.equal(env.AI_INTEGRATIONS_OPENAI_API_KEY, undefined);
  assert.equal(env.CORS_ORIGINS, 'https://staging.kontraplatform.com');
  assert.equal(env.FRONTEND_URL, 'https://staging.kontraplatform.com');
});

test('staging rejects database fallbacks and production Supabase URLs', () => {
  for (const override of [
    { DATABASE_URL: 'postgres://not-a-real-credential' },
    { SUPABASE_DB_URL: 'postgres://not-a-real-credential' },
    { SUPABASE_URL: 'https://production-example.supabase.co' },
    { SUPABASE_REPLICA_URL: 'https://production-example.supabase.co' },
  ]) {
    assert.throws(
      () => assertStagingEnvironment({ ...valid(), ...override }),
      /Staging environment validation failed/,
    );
  }
});

test('staging rejects invalid isolation flag values but leaves an absent flag unchanged', () => {
  assert.deepEqual(assertStagingEnvironment({ NODE_ENV: 'production' }), { enabled: false });
  for (const value of ['', 'false', 'TRUE', '1', 'yes']) {
    assert.throws(
      () => assertStagingEnvironment({ KONTRA_STAGING_ISOLATION: value }),
      /KONTRA_STAGING_ISOLATION must be exactly true/,
    );
  }
});

test('staging requires both staging-only credentials and production runtime mode', () => {
  for (const override of [
    { STAGING_SUPABASE_SERVICE_ROLE_KEY: '' },
    { STAGING_OPENAI_API_KEY: '' },
    { STAGING_SESSION_SECRET: '' },
    { STAGING_SESSION_SECRET: 'placeholder-session-secret' },
    { STAGING_SESSION_SECRET: 'too-short' },
    { NODE_ENV: 'development' },
  ]) {
    assert.throws(
      () => assertStagingEnvironment({ ...valid(), ...override }),
      /Staging environment validation failed/,
    );
  }
});

test('staging rejects a session secret reused from another staging credential', () => {
  const env = valid();
  env.STAGING_SESSION_SECRET = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  assert.throws(
    () => assertStagingEnvironment(env),
    /STAGING_SESSION_SECRET must be distinct/,
  );
});

test('a legacy SESSION_SECRET cannot substitute for the required staging secret', () => {
  const env = valid();
  delete env.STAGING_SESSION_SECRET;
  env.SESSION_SECRET = 'synthetic-legacy-session-secret-that-is-not-staging';
  assert.throws(
    () => assertStagingEnvironment(env),
    /STAGING_SESSION_SECRET is required/,
  );
});

test('legacy production configuration is unchanged when staging isolation is disabled', () => {
  const env = { NODE_ENV: 'production', OPENAI_API_KEY: 'legacy-key', DATABASE_URL: 'legacy-db' };
  assert.deepEqual(assertStagingEnvironment(env), { enabled: false });
  assert.equal(env.OPENAI_API_KEY, 'legacy-key');
  assert.equal(env.DATABASE_URL, 'legacy-db');
});
