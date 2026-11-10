'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const API_ENTRY = path.join(__dirname, 'index.js');
const STAGING_LAUNCHER = path.join(__dirname, '..', 'scripts', 'start-staging-api-hosted-isolated.js');
const API_NODE_MODULES = fs.existsSync(path.join(__dirname, 'node_modules', 'express'))
  ? path.join(__dirname, 'node_modules')
  : path.join(__dirname, '..', 'kontra-ui-clone', 'api', 'node_modules');

function makeServiceRoleKey() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    ref: 'jpemuoapbgzwapydqiio',
    role: 'service_role',
  })).toString('base64url');
  return `${header}.${claims}.synthetic-test-signature`;
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return port;
}

function stagingRuntime(port) {
  return {
    PATH: process.env.PATH,
    HOME: os.tmpdir(),
    NODE_PATH: API_NODE_MODULES,
    NODE_ENV: 'production',
    PORT: String(port),
    KONTRA_STAGING_ISOLATION: 'true',
    STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-role-key-for-tests-only',
    STAGING_OPENAI_API_KEY: 'synthetic-test-only-openai-key',
    STAGING_SESSION_SECRET: 'synthetic-test-only-session-secret-32-characters',
  };
}

function hostedInputs(port) {
  return {
    PATH: process.env.PATH,
    HOME: os.tmpdir(),
    NODE_PATH: API_NODE_MODULES,
    NODE_ENV: 'production',
    PORT: String(port),
    KONTRA_STAGING_ISOLATION: 'true',
    STAGING_SUPABASE_SERVICE_ROLE_KEY: makeServiceRoleKey(),
    STAGING_OPENAI_API_KEY: 'synthetic-test-only-openai-key',
    STAGING_SESSION_SECRET: 'synthetic-test-only-session-secret-32-characters',
  };
}

async function getHealthStatus(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/health' }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.setTimeout(500, () => request.destroy(new Error('health request timed out')));
    request.once('error', reject);
  });
}

async function waitForHealthyServer(child, port, output) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API process exited (${child.exitCode}).\n${output()}`);
    }
    try {
      const status = await getHealthStatus(port);
      if (status === 200) return;
      lastError = new Error(`/health returned ${status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`API did not become healthy: ${lastError?.message || 'timeout'}\n${output()}`);
}

async function runListeningProcess(entry, port, env) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-startup-test-'));
  const preloadPath = path.join(tempDir, 'stub-network.cjs');
  fs.writeFileSync(
    preloadPath,
    "globalThis.fetch = async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });\n",
  );
  const child = spawn(process.execPath, ['--require', preloadPath, entry], {
    cwd: path.join(__dirname, '..'),
    env,
  });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
  try {
    await waitForHealthyServer(child, port, () => output);
    return output;
  } finally {
    if (child.exitCode === null) {
      const closed = new Promise(resolve => child.once('close', resolve));
      let shutdownTimeout;
      child.kill('SIGTERM');
      const graceful = await Promise.race([
        closed.then(() => true),
        new Promise(resolve => {
          shutdownTimeout = setTimeout(() => resolve(false), 3_000);
        }),
      ]);
      clearTimeout(shutdownTimeout);
      if (!graceful) {
        child.kill('SIGKILL');
        await closed;
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('API server startup', () => {
  test('requiring the API exposes startup but does not bind a listener', async () => {
    const port = await unusedPort();
    const script = `
      const net = require('net');
      const api = require(${JSON.stringify(API_ENTRY)});
      const socket = net.connect(Number(process.env.PORT), '127.0.0.1');
      socket.once('connect', () => process.exit(3));
      socket.once('error', error => {
        process.exit(error.code === 'ECONNREFUSED' && typeof api.startServer === 'function' ? 0 : 2);
      });
      setTimeout(() => process.exit(4), 1500);
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        NODE_PATH: API_NODE_MODULES,
        NODE_ENV: 'test',
        PORT: String(port),
        OPENAI_API_KEY: 'synthetic-test-only-openai-key',
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (result.status !== 0) {
      throw new Error(`Import behavior check failed (${result.status}).\n${result.stdout || ''}${result.stderr || ''}`);
    }
  }, 35_000);

  test('direct API execution starts the staging server and serves /health', async () => {
    const port = await unusedPort();
    const output = await runListeningProcess(API_ENTRY, port, stagingRuntime(port));
    expect(output).toContain(`Kontra API listening on port ${port}`);
  }, 35_000);

  test('validated staging launcher starts the server and serves /health', async () => {
    const port = await unusedPort();
    const output = await runListeningProcess(
      STAGING_LAUNCHER,
      port,
      hostedInputs(port),
    );
    expect(output).toContain(`Kontra API listening on port ${port}`);
  }, 35_000);

  test('invalid hosted staging configuration is rejected before API startup', () => {
    const result = spawnSync(process.execPath, [STAGING_LAUNCHER], {
      cwd: path.join(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        PORT: '3001',
        KONTRA_STAGING_ISOLATION: 'false',
      },
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'KONTRA_STAGING_ISOLATION must be exactly true when set',
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain('Kontra API listening');
  });
});
