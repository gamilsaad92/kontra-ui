'use strict';

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const dgram = require('node:dgram');
const os = require('node:os');
const path = require('node:path');

const PRELOADER = __filename;
const CHILD_MARKER = 'KONTRA_TEST_CHILD_ISOLATION';
const FIXTURE_ENV_MARKER = 'KONTRA_TEST_EXPLICIT_CHILD_FIXTURE_ENV';
const mode = process.env.KONTRA_TEST_ISOLATION_MODE || 'unit';
const localPgMode = mode === 'local-postgres'
  && process.env.KONTRA_CANONICAL_ATOMICITY_PG_TEST === '1';
const isolatedChild = process.env[CHILD_MARKER] === '1';
const preserveExplicitTestFixtures = isolatedChild && process.env[FIXTURE_ENV_MARKER] === '1';

if (process.env.NODE_ENV !== 'test' && !isolatedChild) {
  throw new Error('API test isolation may only be loaded in NODE_ENV=test.');
}
if (mode !== 'unit' && !localPgMode) {
  throw new Error('Unknown API test isolation mode.');
}

const DB_OR_PROVIDER_NAME = /(?:DATABASE|POSTGRES|SUPABASE|NEON|REDIS|MONGO|MYSQL|MARIADB|COCKROACH|CASSANDRA|DYNAMO|FIRESTORE|COSMOS|SQLSERVER|MSSQL|ORACLE|PRISMA|DRIZZLE|KNEX|CLICKHOUSE|ELASTICSEARCH|OPENSEARCH|INFLUXDB|SNOWFLAKE|BIGQUERY|DATABRICKS|SQLITE|OPENAI|ANTHROPIC|STRIPE|RESEND|VERCEL|GITHUB|RENDER|AI_INTEGRATIONS|CONNECTION_STRING|(?:^|_)DB(?:_|$)|^PG[A-Z0-9_]*$)/i;
const SECRET_NAME = /(?:^|_)(?:KEY|API_KEY|SECRET_KEY|SERVICE_ROLE_KEY|ACCESS_KEY|ACCESS_TOKEN|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_SECRET|CREDENTIALS?)$/i;
const looksLikeTestFixture = (name, value) => {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (/(?:URL|URI|HOST|ENDPOINT)$/i.test(name)) {
    try {
      const host = new URL(text).hostname.toLowerCase();
      if (host === 'localhost' || host === '::1' || host.startsWith('127.')
        || host === 'example.com' || host === 'example.org' || host === 'example.net'
        || host.startsWith('example.') || host.endsWith('.invalid') || host.endsWith('.example')) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return /^(?:ci-test|test|synthetic|fake|dummy|placeholder)(?:[-_.]|$)/i.test(text);
};

for (const name of Object.keys(process.env)) {
  const sensitive = DB_OR_PROVIDER_NAME.test(name) || SECRET_NAME.test(name);
  if (sensitive && !(preserveExplicitTestFixtures && looksLikeTestFixture(name, process.env[name]))) {
    delete process.env[name];
  }
}
delete process.env[FIXTURE_ENV_MARKER];
delete process.env.KONTRA_TEST_ALLOWED_LOCAL_PORTS;

process.env.KONTRA_TEST_ISOLATION = 'true';
if (!preserveExplicitTestFixtures && !process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'ci-test-key-not-valid';
}
process.env[CHILD_MARKER] = '1';
process.env.NODE_OPTIONS = `--require=${PRELOADER}`;

const dotenv = require('dotenv');
dotenv.config = () => ({ parsed: Object.create(null) });

const Module = require('node:module');
const blockedNativeDatabaseModules = new Set([
  'pg-native',
  'oracledb',
  'sqlite3',
  'better-sqlite3',
  '@libsql/client',
  'libsql',
  'duckdb',
  '@duckdb/node-api',
]);
const originalModuleLoad = Module._load;
const blockPgClients = pg => {
  const blockConnection = () => {
    throw new Error('[test isolation] Live PostgreSQL database connections are blocked. Direct PostgreSQL clients are blocked.');
  };
  for (const Client of [pg?.Pool, pg?.Client]) {
    if (!Client?.prototype) continue;
    for (const method of ['connect', 'query']) {
      if (typeof Client.prototype[method] === 'function') Client.prototype[method] = blockConnection;
    }
  }
  return pg;
};
Module._load = function isolatedModuleLoad(request, ...args) {
  if (blockedNativeDatabaseModules.has(request)) {
    throw new Error(`[test isolation] Native database client blocked: ${request}`);
  }
  const loaded = originalModuleLoad.call(this, request, ...args);
  return request === 'pg' ? blockPgClients(loaded) : loaded;
};

const isolationMarker = Symbol.for('kontra.apiTestIsolation.networkGuard');
const localPorts = new Set();
const localSockets = new Set();
const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host || '').toLowerCase())
  || String(host || '').startsWith('127.');
const allowedTestPorts = () => {
  const ports = new Set(
    String(process.env.KONTRA_TEST_ALLOWED_LOCAL_PORTS || '')
      .split(',')
      .map(value => Number(value.trim()))
      .filter(value => Number.isInteger(value) && value > 0 && value < 65536),
  );
  const configuredPort = preserveExplicitTestFixtures ? Number(process.env.PORT) : NaN;
  if (Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536) {
    ports.add(configuredPort);
  }
  return ports;
};
if (!net[isolationMarker]) {
  Object.defineProperty(net, isolationMarker, { value: true });
  const localPgPrefix = path.join(os.tmpdir(), 'kontra-canonical-atomicity-');
  const trackedServers = new WeakSet();

  const remember = server => {
    const address = server.address();
    if (typeof address === 'string') localSockets.add(address);
    else if (address?.port) localPorts.add(address.port);
    if (!trackedServers.has(server)) {
      trackedServers.add(server);
      server.once('close', () => forget(server));
    }
  };
  const forget = server => {
    const address = server.address();
    if (typeof address === 'string') localSockets.delete(address);
    else if (address?.port) localPorts.delete(address.port);
  };

  const originalListen = net.Server.prototype.listen;
  net.Server.prototype.listen = function isolatedListen(...args) {
    const callbackIndex = args.findIndex(value => typeof value === 'function');
    if (callbackIndex >= 0) {
      const callback = args[callbackIndex];
      args[callbackIndex] = function rememberOnListening(...callbackArgs) {
        remember(this);
        return callback.apply(this, callbackArgs);
      };
    } else {
      this.once('listening', function rememberOnListening() { remember(this); });
    }
    const result = originalListen.apply(this, args);
    // Supertest listens on port 0 and immediately reads address().port. Record
    // the assigned ephemeral loopback port synchronously when Node has it.
    if (this.address()) remember(this);
    return result;
  };

  const originalClose = net.Server.prototype.close;
  net.Server.prototype.close = function isolatedClose(...args) {
    forget(this);
    return originalClose.apply(this, args);
  };

  const socketTarget = args => {
    const firstArgument = args[0];
    // net.connect() passes Socket.connect() Node's normalized
    // [options, callback] tuple as a single argument.
    const first = Array.isArray(firstArgument) ? firstArgument[0] : firstArgument;
    if (typeof first === 'string') return { path: first };
    if (typeof first === 'number') return { host: args[1] || 'localhost', port: first };
    if (first && typeof first === 'object') {
      return { path: first.path, host: first.host || first.hostname || 'localhost', port: Number(first.port) || null };
    }
    return {};
  };
  const originalConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function isolatedConnect(...args) {
    const target = socketTarget(args);
    const allowed = target.path
      ? localSockets.has(target.path) || (localPgMode && target.path.startsWith(localPgPrefix))
      : loopback(target.host) && (localPorts.has(target.port) || allowedTestPorts().has(target.port));
    if (!allowed) throw new Error('[test isolation] Outbound socket connection blocked.');
    return originalConnect.apply(this, args);
  };

  const requestTarget = (input, options) => {
    if (input instanceof URL) {
      return { host: input.hostname, port: Number(input.port) || (input.protocol === 'https:' ? 443 : 80) };
    }
    if (typeof input === 'string') {
      try { return requestTarget(new URL(input), options); } catch { return {}; }
    }
    if (input && typeof input === 'object') {
      if (typeof input.url === 'string') return requestTarget(input.url, options);
      const opts = options && typeof options === 'object' ? options : input;
      return { host: opts.hostname || opts.host || 'localhost', port: Number(opts.port) || 80 };
    }
    return {};
  };
  const assertLocalRequest = (input, options) => {
    const target = requestTarget(input, options);
    if (!loopback(target.host) || !(localPorts.has(target.port) || allowedTestPorts().has(target.port))) {
      throw new Error('[test isolation] External HTTP request blocked.');
    }
  };
  for (const client of [http, https]) {
    const originalRequest = client.request;
    client.request = function isolatedRequest(input, options, ...rest) {
      assertLocalRequest(input, options && typeof options === 'object' ? options : undefined);
      return originalRequest.call(this, input, options, ...rest);
    };
  }
}

const fetchMarker = Symbol.for('kontra.apiTestIsolation.fetchGuard');
if (typeof globalThis.fetch === 'function' && !globalThis[fetchMarker]) {
  Object.defineProperty(globalThis, fetchMarker, { value: true });
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, ...args) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    let target;
    try { target = new URL(rawUrl); } catch {
      throw new Error('[test isolation] Invalid outbound URL blocked.');
    }
    const port = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);
    if (!loopback(target.hostname) || !(localPorts.has(port) || allowedTestPorts().has(port))) {
      throw new Error('[test isolation] External or unregistered HTTP request blocked.');
    }
    return originalFetch(input, ...args);
  };
}

const datagramMarker = Symbol.for('kontra.apiTestIsolation.udpGuard');
if (!dgram.Socket.prototype[datagramMarker]) {
  Object.defineProperty(dgram.Socket.prototype, datagramMarker, { value: true });
  dgram.Socket.prototype.send = function blockedDatagramSend() {
    throw new Error('[test isolation] UDP network requests are blocked.');
  };
}

const childProcess = require('node:child_process');
const workerThreads = require('node:worker_threads');
const safeUtilities = new Set(['pdftotext', 'pdfinfo']);
const pgTools = new Set(['initdb', 'pg_ctl', 'psql']);
const execName = file => path.basename(String(file || '')).toLowerCase();
const isNode = file => file === process.execPath || ['node', 'nodejs'].includes(execName(file));
const localPgPrefix = path.join(os.tmpdir(), 'kontra-canonical-atomicity-');

function assertChildAllowed(file, args = []) {
  const name = execName(file);
  if (isNode(file) || safeUtilities.has(name)) return;
  if (!localPgMode || !pgTools.has(name)) throw new Error('[test isolation] Child process blocked.');
  if (name === 'psql') {
    const i = args.indexOf('-h');
    const socket = i >= 0 ? path.resolve(String(args[i + 1] || '')) : '';
    if (!socket.startsWith(localPgPrefix) || !socket.endsWith(`${path.sep}socket`)) {
      throw new Error('[test isolation] PostgreSQL CLI must use the temporary test socket.');
    }
    return;
  }
  const i = args.indexOf('-D');
  const dataDir = i >= 0 ? path.resolve(String(args[i + 1] || '')) : '';
  if (!dataDir.startsWith(localPgPrefix) || !dataDir.endsWith(`${path.sep}data`)) {
    throw new Error('[test isolation] PostgreSQL setup must use a temporary test directory.');
  }
}

function safeChildOptions(options, addPreload) {
  const next = options && typeof options === 'object' ? { ...options } : {};
  const explicitEnv = Boolean(next.env && typeof next.env === 'object');
  const env = { ...(next.env || process.env) };
  for (const name of Object.keys(env)) {
    const sensitive = DB_OR_PROVIDER_NAME.test(name) || SECRET_NAME.test(name);
    if (sensitive && !(addPreload && explicitEnv && looksLikeTestFixture(name, env[name]))) {
      delete env[name];
    }
  }
  if (addPreload) {
    env.NODE_OPTIONS = `--require=${PRELOADER}`;
    env[CHILD_MARKER] = '1';
    if (explicitEnv) env[FIXTURE_ENV_MARKER] = '1';
  }
  next.env = env;
  return next;
}

for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const original = childProcess[name];
  childProcess[name] = function isolatedChild(file, args, options, ...rest) {
    assertChildAllowed(file, Array.isArray(args) ? args : []);
    const nodeChild = isNode(file);
    const safeOptions = safeChildOptions((args && !Array.isArray(args)) ? args : options, nodeChild);
    if (Array.isArray(args)) return original.call(this, file, args, safeOptions, ...rest);
    return original.call(this, file, safeOptions, ...rest);
  };
}
for (const name of ['exec', 'execSync']) {
  childProcess[name] = () => { throw new Error('[test isolation] Shell child processes are blocked.'); };
}
const originalFork = childProcess.fork;
childProcess.fork = function isolatedFork(file, args, options) {
  assertChildAllowed(process.execPath);
  const argv = Array.isArray(args) ? args : [];
  const opts = Array.isArray(args) ? options : args;
  return originalFork.call(this, file, argv, safeChildOptions(opts, true));
};

const OriginalWorker = workerThreads.Worker;
workerThreads.Worker = class IsolatedWorkerBlocked extends OriginalWorker {
  constructor() {
    throw new Error('[test isolation] Worker threads are blocked.');
  }
};
