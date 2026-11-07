'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingEnvironment, STAGING_SUPABASE_URL } = require('./stagingEnvironment');

const valid = () => ({
  NODE_ENV: 'production',
  KONTRA_STAGING_ISOLATION: 'true',
  STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-role-key',
  STAGING_OPENAI_API_KEY: 'synthetic-staging-openai-key',
});

test('staging identity maps only staging credentials and pins the approved project', () => {
  const env = { ...valid(), OPENAI_API_KEY: 'not-used', OPENAI_API_KEY1: 'not-used-either' };
  const result = assertStagingEnvironment(env);
  assert.equal(result.enabled, true);
  assert.equal(env.SUPABASE_URL, STAGING_SUPABASE_URL);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'synthetic-staging-role-key');
  assert.equal(env.OPENAI_API_KEY, 'synthetic-staging-openai-key');
  assert.equal(env.OPENAI_API_KEY1, undefined);
  assert.equal(env.AI_INTEGRATIONS_OPENAI_API_KEY, undefined);
  assert.equal(env.CORS_ORIGINS, undefined);
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

test('staging requires both staging-only credentials and production runtime mode', () => {
  for (const override of [
    { STAGING_SUPABASE_SERVICE_ROLE_KEY: '' },
    { STAGING_OPENAI_API_KEY: '' },
    { NODE_ENV: 'development' },
  ]) {
    assert.throws(
      () => assertStagingEnvironment({ ...valid(), ...override }),
      /Staging environment validation failed/,
    );
  }
});

test('legacy production configuration is unchanged when staging isolation is disabled', () => {
  const env = { NODE_ENV: 'production', OPENAI_API_KEY: 'legacy-key', DATABASE_URL: 'legacy-db' };
  assert.deepEqual(assertStagingEnvironment(env), { enabled: false });
  assert.equal(env.OPENAI_API_KEY, 'legacy-key');
  assert.equal(env.DATABASE_URL, 'legacy-db');
});
