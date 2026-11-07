'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('database and staging secrets are removed before tests load', () => {
  for (const name of [
    'DATABASE_URL',
    'APP_DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'STAGING_DATABASE_URL',
    'STAGING_SUPABASE_SERVICE_ROLE_KEY',
    'PGPASSWORD',
    'POSTGRES_URL',
  ]) {
    assert.equal(process.env[name], undefined, `${name} must be cleared`);
  }
  assert.equal(process.env.OPENAI_API_KEY, 'ci-test-key-not-valid');
});

test('live PostgreSQL and outbound network attempts fail closed', async () => {
  const { Pool } = require('pg');
  assert.throws(() => new Pool().query('select 1'), /Live database connections are blocked/);
  assert.throws(() => fetch('https://example.com'), /Outbound network requests are blocked/);
});

test('test-only preloads refuse production processes', () => {
  const preload = path.join(__dirname, 'isolatedApiTestEnv.cjs');
  const result = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      NODE_OPTIONS: `--require=${preload}`,
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /may only be loaded in NODE_ENV=test/);
});
