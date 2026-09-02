const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const request = require('supertest');

const API_ENTRY = path.join(__dirname, 'index.js');
const productionEnvironment = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  OPENAI_API_KEY: 'test-openai-key',
};

function startProduction(environment = {}) {
  return spawnSync(process.execPath, [API_ENTRY], {
    cwd: os.tmpdir(),
    env: { ...productionEnvironment, ...environment },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

describe('production startup configuration', () => {
  test.each([
    ['SUPABASE_URL', { SUPABASE_URL: '' }],
    ['SUPABASE_SERVICE_ROLE_KEY', { SUPABASE_SERVICE_ROLE_KEY: '' }],
    ['OPENAI_API_KEY', { OPENAI_API_KEY: '' }],
    ['SUPABASE_SERVICE_ROLE_KEY', { SUPABASE_SERVICE_ROLE_KEY: 'placeholder-key' }],
  ])('rejects missing or placeholder %s', (name, environment) => {
    const result = startProduction(environment);
    const output = `${result.stdout || ''}${result.stderr || ''}`;

    expect(result.status).toBe(1);
    expect(output).toContain(`FATAL: ${name} is required in production`);
  });
});

describe('development health configuration', () => {
  test('reports degraded when required credentials are unavailable', async () => {
    const originalCwd = process.cwd();
    const originalEnvironment = { ...process.env };
    const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-health-'));

    try {
      process.chdir(isolatedCwd);
      for (const name of [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY',
        'OPENAI_API_KEY1',
      ]) {
        delete process.env[name];
      }
      process.env.NODE_ENV = 'development';

      let app;
      jest.isolateModules(() => {
        app = require('./index');
      });

      const response = await request(app).get('/health');
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        ok: false,
        status: 'degraded',
        checks: { configuration: 'missing' },
      });
      expect(response.body.missing_configuration).toEqual(expect.arrayContaining([
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY',
      ]));
    } finally {
      process.chdir(originalCwd);
      for (const name of Object.keys(process.env)) {
        if (!(name in originalEnvironment)) delete process.env[name];
      }
      Object.assign(process.env, originalEnvironment);
      fs.rmSync(isolatedCwd, { recursive: true, force: true });
    }
  });
});