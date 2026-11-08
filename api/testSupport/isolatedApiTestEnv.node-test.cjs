'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('database and staging secrets are removed before tests load', () => {
  const preload = path.join(__dirname, 'isolatedApiTestEnv.cjs');
  const result = spawnSync(process.execPath, ['-e', `
    process.stdout.write(JSON.stringify({
      databaseUrl: process.env.DATABASE_URL ?? null,
      databaseHost: process.env.DB_HOST ?? null,
      postgresUrl: process.env.POSTGRES_URL ?? null,
      pgPassword: process.env.PGPASSWORD ?? null,
      supabaseUrl: process.env.SUPABASE_URL ?? null,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
      stagingKey: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? null,
      stagingOpenAi: process.env.STAGING_OPENAI_API_KEY ?? null,
      openAi: process.env.OPENAI_API_KEY
    }));
  `], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      NODE_OPTIONS: `--require=${preload}`,
      DATABASE_URL: 'postgres://synthetic.invalid/test',
      DB_HOST: 'synthetic.invalid',
      POSTGRES_URL: 'postgres://synthetic.invalid/test',
      PGPASSWORD: 'synthetic-password',
      SUPABASE_URL: 'https://synthetic.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-role-key',
      STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-key',
      STAGING_OPENAI_API_KEY: 'synthetic-openai-key',
      OPENAI_API_KEY: 'production-looking-key',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    databaseUrl: null,
    databaseHost: null,
    postgresUrl: null,
    pgPassword: null,
    supabaseUrl: null,
    supabaseKey: null,
    stagingKey: null,
    stagingOpenAi: null,
    openAi: 'ci-test-key-not-valid',
  });
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
